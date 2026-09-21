import { sourcePassages } from "../../domain/case/source-passages";
import { randomUUID } from "node:crypto";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  modelProposalEnvelopeSchema,
  modelProposalOutputSchema,
  parseModelProposalEnvelope,
  type ModelBoundaryIdentityFactory,
} from "../../domain/case/model-boundary";
import { ModelCallFailure } from "./journey-model";
import type {
  JourneyModel,
  ModelCallMetrics,
  ModelDiagnosticIssue,
  ModelFailureDiagnostic,
  ModelTurn,
  ReviewedCaseModelContext,
} from "./journey-model";

export const ANTHROPIC_MODEL_ID = "claude-sonnet-5";
export const MODEL_PROMPT_REVISION = "wilson-source-references-recovery-v3";
export const MODEL_SCHEMA_REVISION = "wilson-grounded-proposals-v14-references";
export const PROVIDER_MAX_OUTPUT_TOKENS = 128_000;
export const MODEL_MAX_RETRIES = 0;

const INPUT_USD_PER_MILLION_TOKENS = 2;
const OUTPUT_USD_PER_MILLION_TOKENS = 10;

type ProviderOutputFormat = Pick<
  ReturnType<typeof zodOutputFormat<typeof modelProposalOutputSchema>>,
  "type" | "schema"
>;

export interface AnthropicModelRequest {
  model: typeof ANTHROPIC_MODEL_ID;
  max_tokens: typeof PROVIDER_MAX_OUTPUT_TOKENS;
  system: string;
  messages: [{ role: "user"; content: string }];
  output_config: { format: ProviderOutputFormat };
}

export interface AnthropicModelResponse {
  id: string;
  model: string;
  stop_reason: string | null;
  content: unknown[];
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number | null;
    cache_read_input_tokens: number | null;
    output_tokens: number;
  };
}

export type AnthropicRequester = (request: AnthropicModelRequest) => Promise<AnthropicModelResponse>;
export type AnthropicResponseRecorder = (
  turn: ModelTurn,
  response: AnthropicModelResponse,
) => Promise<string>;

export interface AnthropicStreamingClient {
  messages: {
    stream(request: AnthropicModelRequest): {
      finalMessage(): Promise<AnthropicModelResponse>;
    };
  };
}

const SYSTEM_PROMPT = `You extract grounded semantic proposals from one synthetic clinician input for Wilson's bounded adult medication, single-device adverse-event or product-problem, and non-device product-quality scope.

Rules:
- Propose only facts explicitly supported by the current clinician input. Do not diagnose, infer causality, classify, fill gaps, or establish truth.
- The supported targets are the patient, event or product problem, relevant-test, medication or non-device product, and single suspect-device fields represented by the response schema. Preserve uncertainty, negation, correction, alternatives, unknown, explicitly absent, inapplicable, and declined meanings.
- Distinguish not mentioned from explicitly unavailable: omit a field only when the input does not address it. When the clinician says a test name, result, unit, range or collection date is unknown, unavailable, not known or not at hand, preserve that uncertainty. Use kind unknown for an unavailable name, result, range or date; a missing date is not explicitly absent. Use explicitly-absent only for a stated absence of the thing itself, never for lack of knowledge about it. Keep a known numeric result without units when units are unavailable; do not invent a unit. Do not declare a test entity for a test explicitly stated not to have been performed; do not turn that statement into a partial observation with an absent result.
- Relevant tests are stable entities. On opening input, declare each distinct observation once, keeping testName (the stated test identity, including specimen/context) separate from testResult (numeric or qualitative result, with any stated units and modifiers). Retain all tests, including partial observations with only identity or only result. Attach ranges and explicitly stated test dates to the same reference. Never infer a test name, unit, range, or test date from the result, event date, another test, or clinical conventions. Omit unmentioned fields; explicitly unavailable fields use unknown as described above. Do not interpret or classify a result, expand an abbreviation, or silently repair an unfamiliar/garbled clinical term; preserve the clinician's wording for review.
- On later input, use the supplied stable IDs to correct or complete an existing test, including a pending unnamed test. Declare a new test with response-local references only for a genuinely additional or entirely omitted observation. Never duplicate a supplied test just to correct it. Correct only stated fields; preserve its other facts. A new measurement is not a correction unless the input says so. Mark corrections to pending as well as accepted facts with intent correction.
- Product dose is the amount actually taken each time; strength is the stated amount per tablet/capsule or concentration on the label. Extract them independently, retaining units and descriptive wording. Never infer strength from dose, multiply tablet counts, divide concentrations, or convert units. If only dose is stated, omit strength. Report date is entered directly by the clinician, never extracted.
- For every declared product, propose its supported productType ("drug-or-biologic", "device", or "other") and role. For product roles, emit only "suspect" or "concomitant". A reported suspect role is clinician input, not your causality judgment. For a device, preserve explicitly stated implanted and reprocessed-single-use status so Wilson can determine whether related Section E details are applicable.
- A medicine or other product named only as treatment administered in response to the adverse event belongs in event.treatments. Propose it as a report product only when the clinician separately describes it as suspect, concomitant, or otherwise involved in the report.
- Use normalized ISO dates (YYYY-MM-DD) and "oral" for "by mouth". Otherwise preserve explicitly stated descriptive detail in known values; do not compress away modifiers that make a clinical statement more specific. Retain measurement values with their units.
- On opening input, declare each mentioned product once using arbitrary response-local productReference and groupReference values. Use those references for its proposals. Wilson—not you—assigns stable case identity.
- On later input, declare no products. Refer to an existing product only by an exact application-supplied product ID from the reviewed-case context. A repeated name or alias does not create identity.
- proposalReference and groupReference are response-local linkage values, not case IDs. Every declared test and product requires its own distinct groupReference; never reuse one group for different tests or products. All proposals for that entity use its declared groupReference. Keep later update groups within one existing case entity as well.
- Every proposal must select evidenceReferences from the code-labelled current input passages. Return their reference IDs, never copied quotations, offsets, or invented IDs. Include multiple passages when a subject, shared date, negation, correction or uncertainty spans passages. Select enough context to support the complete claim, not merely a matching number. References establish source existence, not semantic support: you must still interpret attribution carefully.
- Case context includes accepted and explicitly marked pending proposals only to link mentions and distinguish corrections or alternatives. Pending values are not accepted knowledge. Never cite context as current clinician evidence.
- Omit unsupported facts. Every proposal remains unaccepted until ordinary human review.`;

export function createAnthropicRequest(
  turn: ModelTurn,
  text: string,
  reviewedCase?: ReviewedCaseModelContext,
): AnthropicModelRequest {
  if (!text.trim()) throw new Error("Clinician input is required");
  const context = reviewedContextBlock(turn, reviewedCase);
  const turnInstruction = turn === "opening"
    ? "This is opening input. Declare newly mentioned products with response-local references."
    : "This is later input. Declare no products and use only supplied stable product IDs.";
  return {
    model: ANTHROPIC_MODEL_ID,
    max_tokens: PROVIDER_MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `${turnInstruction}${context}\n\nClinician input:\n<input>\n${JSON.stringify(sourcePassages(text).map(({ reference, text }) => ({ reference, text })))}\n</input>`,
    }],
    output_config: { format: providerOutputFormat() },
  };
}

export function createAnthropicJourneyModel(
  requester: AnthropicRequester = defaultRequester(),
  now: () => number = Date.now,
  recordResponse?: AnthropicResponseRecorder,
  createIdentity: ModelBoundaryIdentityFactory = defaultIdentityFactory,
  recordedAt: () => string = () => new Date().toISOString(),
): JourneyModel {
  return {
    async propose(turn, text, reviewedCase) {
      const request = createAnthropicRequest(turn, text, reviewedCase);
      const startedAt = now();
      let response: AnthropicModelResponse;
      try {
        response = await requester(request);
      } catch (error) {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
          requestFailureDiagnostic(error),
        );
      }
      const latencyMs = Math.max(0, now() - startedAt);
      const inputTokens = response.usage.input_tokens
        + (response.usage.cache_creation_input_tokens ?? 0)
        + (response.usage.cache_read_input_tokens ?? 0);
      const metrics: ModelCallMetrics = {
        model: response.model,
        promptRevision: MODEL_PROMPT_REVISION,
        schemaRevision: MODEL_SCHEMA_REVISION,
        inputTokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
        estimatedCostUsd: estimateCost(inputTokens, response.usage.output_tokens),
      };

      let responseArtifact: string | undefined;
      if (recordResponse) {
        try {
          responseArtifact = await recordResponse(turn, response);
        } catch (error) {
          throw new ModelCallFailure(
            "Wilson could not retain the fictional model response for diagnosis. Accepted case knowledge is unchanged.",
            { phase: "response-capture", errorName: errorName(error) },
            metrics,
            response,
          );
        }
      }
      if (response.stop_reason !== "end_turn") {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
          {
            phase: "provider-stop",
            requestId: response.id,
            stopReason: response.stop_reason ?? "missing",
            responseArtifact,
          },
          metrics,
          response,
        );
      }

      const responseText = response.content.filter(isTextBlock).map(({ text }) => text).join("");
      let decoded: unknown;
      try {
        decoded = JSON.parse(responseText);
      } catch (error) {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
          {
            phase: "structured-json",
            requestId: response.id,
            errorName: errorName(error),
            responseArtifact,
            issues: [{
              path: "content",
              code: "invalid_json",
              message: responseText.length === 0 ? "The response contained no text block." : "The response text was not valid JSON.",
            }],
          },
          metrics,
          response,
        );
      }
      const structured = modelProposalEnvelopeSchema.safeParse(decoded);
      if (!structured.success) {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
          {
            phase: "structured-schema",
            requestId: response.id,
            responseArtifact,
            issues: zodIssues(structured.error),
          },
          metrics,
          response,
        );
      }

      try {
        const envelope = parseModelProposalEnvelope({
          turn,
          input: {
            id: createIdentity("input", turn),
            type: turn === "opening" ? "narrative" : "correction",
            text,
            recordedAt: recordedAt(),
          },
          existingProductIds: reviewedCase?.products.map(({ id }) => id),
          existingTestIds: reviewedCase?.relevantTests.map(({ id }) => id),
          existingTestCount: reviewedCase?.totalTestCount,
          output: structured.data,
        }, createIdentity);
        return { envelope, metrics, responseArtifact, diagnosticResponse: response };
      } catch (error) {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
          {
            phase: "domain-boundary",
            requestId: response.id,
            responseArtifact,
            errorName: errorName(error),
            issues: error instanceof z.ZodError ? zodIssues(error) : undefined,
          },
          metrics,
          response,
        );
      }
    },
  };
}

function defaultRequester(): AnthropicRequester {
  const client = new Anthropic({ maxRetries: MODEL_MAX_RETRIES, logLevel: "off" });
  return createStreamingRequester(client);
}

export function createStreamingRequester(client: AnthropicStreamingClient): AnthropicRequester {
  return async (request) => client.messages.stream(request).finalMessage();
}

function providerOutputFormat(): ProviderOutputFormat {
  const format = zodOutputFormat(modelProposalOutputSchema);
  return { type: format.type, schema: format.schema };
}

function reviewedContextBlock(
  turn: ModelTurn,
  context: ReviewedCaseModelContext | undefined,
): string {
  if (turn === "opening") return "";
  if (!context) throw new Error("Reviewed case context is required for later input");
  return `\n\nReviewed case context (not clinician evidence; never quote it):\n${JSON.stringify(context)}`;
}

function defaultIdentityFactory(kind: Parameters<ModelBoundaryIdentityFactory>[0]): string {
  return `${kind}-${randomUUID()}`;
}

function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  if (typeof block !== "object" || block === null) return false;
  const candidate = block as { type?: unknown; text?: unknown };
  return candidate.type === "text" && typeof candidate.text === "string";
}

function requestFailureDiagnostic(error: unknown): ModelFailureDiagnostic {
  if (error instanceof APIError) {
    return {
      phase: "provider-request",
      providerStatus: error.status,
      providerType: error.type ?? undefined,
      requestId: error.requestID ?? undefined,
      errorName: errorName(error),
    };
  }
  return { phase: "provider-request", errorName: errorName(error) };
}

function zodIssues(error: z.ZodError): ModelDiagnosticIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
    message: issue.message,
  }));
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens * INPUT_USD_PER_MILLION_TOKENS)
    + (outputTokens * OUTPUT_USD_PER_MILLION_TOKENS)) / 1_000_000;
}
