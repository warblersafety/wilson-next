import { randomUUID } from "node:crypto";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
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
export const MODEL_PROMPT_REVISION = "wilson-medication-completion-v1";
export const MODEL_SCHEMA_REVISION = "wilson-grounded-proposals-v8";
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

const SYSTEM_PROMPT = `You extract grounded semantic proposals from one synthetic clinician input for Wilson's bounded adult medication adverse-event scope.

Rules:
- Propose only facts explicitly supported by the current clinician input. Do not diagnose, infer causality, classify, fill gaps, or establish truth.
- The supported targets are the patient, adverse event, relevant-test, and medication fields represented by the response schema. Preserve uncertainty, negation, correction, alternatives, unknown, explicitly absent, inapplicable, and declined meanings.
- Relevant tests are stable entities. On opening input, declare each distinct relevant test or laboratory result once and attach its test/result text, optional ranges, and date to that test reference. Do not interpret or classify a result.
- For product roles, emit only "suspect" or "concomitant". A reported suspect role is clinician input, not your causality judgment.
- Use normalized ISO dates (YYYY-MM-DD) and "oral" for "by mouth". Otherwise preserve explicitly stated descriptive detail in known values; do not compress away modifiers that make a clinical statement more specific. Retain measurement values with their units.
- On opening input, declare each mentioned product once using arbitrary response-local productReference and groupReference values. Use those references for its proposals. Wilson—not you—assigns stable case identity.
- On later input, declare no products. Refer to an existing product only by an exact application-supplied product ID from the reviewed-case context. A repeated name or alias does not create identity.
- proposalReference and groupReference are response-local linkage values, not case IDs. Keep a group within one case entity.
- Every proposal must include an exact, contiguous, self-contained evidenceQuote from the current clinician input that lets a reviewer identify both the subject and the complete claim without relying on target metadata. Include all wording needed to support negation, correction, alternatives, or unresolved uncertainty. Completeness outranks brevity; only then choose the shortest sufficient quotation. Return the quotation itself, never character offsets or a source ID.
- Reviewed-case context is supplied only to link later mentions and distinguish accepted knowledge from corrections or alternatives. Never cite context as clinician evidence.
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
      content: `${turnInstruction}${context}\n\nClinician input:\n<input>\n${text}\n</input>`,
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
      const structured = modelProposalOutputSchema.safeParse(decoded);
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
