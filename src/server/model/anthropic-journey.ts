import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { parseModelProposalEnvelope } from "../../domain/case/model-boundary";
import {
  correctionAccount,
  fixedRecordedAt,
  openingAccount,
} from "../../experiment/fixed-inputs";
import { ModelCallFailure } from "./journey-model";
import type {
  JourneyModel,
  ModelCallMetrics,
  ModelDiagnosticIssue,
  ModelFailureDiagnostic,
  ModelTurn,
} from "./journey-model";

export const ANTHROPIC_MODEL_ID = "claude-sonnet-5";
export const MODEL_PROMPT_REVISION = "wilson-experiment-1-extraction-v1";
export const MODEL_SCHEMA_REVISION = "wilson-grounded-proposals-v1";
// The Messages API requires max_tokens. Use Sonnet 5's full provider output
// capacity here so Wilson imposes no development/verification token budget.
export const PROVIDER_MAX_OUTPUT_TOKENS = 128_000;
export const MODEL_MAX_RETRIES = 0;

const INPUT_USD_PER_MILLION_TOKENS = 2;
const OUTPUT_USD_PER_MILLION_TOKENS = 10;

const modelTargetSchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("patient"),
    entityId: z.literal("patient"),
    field: z.enum(["identifier", "ageYears", "sex"]),
  }).strict(),
  z.object({
    entity: z.literal("event"),
    entityId: z.literal("event"),
    field: z.enum([
      "symptoms",
      "onsetDate",
      "hospitalized",
      "hemoglobin",
      "treatments",
      "outcome",
      "dischargeDate",
    ]),
  }).strict(),
  z.object({
    entity: z.literal("product"),
    entityId: z.enum(["product-apixaban", "product-naproxen", "product-lisinopril"]),
    field: z.enum([
      "name",
      "role",
      "dose",
      "frequency",
      "route",
      "startDate",
      "stopDate",
      "indication",
      "stopped",
    ]),
  }).strict(),
]);

const modelOutputSchema = z.object({
  products: z.array(z.object({
    id: z.enum(["product-apixaban", "product-naproxen", "product-lisinopril"]),
    groupId: z.enum(["product-apixaban", "product-naproxen", "product-lisinopril"]),
  }).strict()),
  proposals: z.array(z.object({
    proposalId: z.string(),
    groupId: z.string(),
    intent: z.enum(["fact", "correction", "alternative"]),
    target: modelTargetSchema,
    value: z.object({
      kind: z.literal("known"),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    }).strict(),
    source: z.object({
      id: z.string(),
      start: z.number().int(),
      end: z.number().int(),
    }).strict(),
  }).strict()).min(1),
}).strict();

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

export type AnthropicRequester = (
  request: AnthropicModelRequest,
) => Promise<AnthropicModelResponse>;

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

const SYSTEM_PROMPT = `You extract grounded semantic proposals from one fictional clinician input for Wilson Experiment 1.

Rules:
- Propose only facts explicitly supported by the supplied input. Do not diagnose, infer causality, classify, fill gaps, or establish truth.
- Keep each medicine attached to its exact stable product ID. "I suspect" establishes a reported role; it is not your causality judgment.
- Use normalized ISO dates (YYYY-MM-DD), "oral" for "by mouth", and the literal frequency wording "twice daily" or "daily".
- Every proposal must cite the smallest exact supporting substring using zero-based start-inclusive/end-exclusive character offsets into the clinician input. Offsets must select non-empty text exactly.
- Use only the proposal IDs, groups, targets, and intents listed for the requested turn. Emit every listed proposal that the input explicitly supports and no others.
- Products are declarations for newly proposed product entities, not accepted case knowledge.`;

const OPENING_CATALOG = `Declare these products in this order, with matching groupId: product-apixaban, product-naproxen, product-lisinopril.

Allowed proposals (proposalId | groupId | intent | target):
patient-id | patient | fact | patient.identifier
patient-age | patient | fact | patient.ageYears
patient-sex | patient | fact | patient.sex
event-symptoms | event | fact | event.symptoms
event-onset | event | fact | event.onsetDate
event-hospitalized | event | fact | event.hospitalized
event-hemoglobin | event | fact | event.hemoglobin
event-treatment | event | fact | event.treatments
event-outcome | event | fact | event.outcome
event-discharge | event | fact | event.dischargeDate
apixaban-name | product-apixaban | fact | product-apixaban.name
apixaban-role | product-apixaban | fact | product-apixaban.role
apixaban-dose | product-apixaban | fact | product-apixaban.dose
apixaban-frequency | product-apixaban | fact | product-apixaban.frequency
apixaban-route | product-apixaban | fact | product-apixaban.route
apixaban-start | product-apixaban | fact | product-apixaban.startDate
naproxen-name | product-naproxen | fact | product-naproxen.name
naproxen-role | product-naproxen | fact | product-naproxen.role
naproxen-dose | product-naproxen | fact | product-naproxen.dose
naproxen-frequency | product-naproxen | fact | product-naproxen.frequency
naproxen-route | product-naproxen | fact | product-naproxen.route
naproxen-start | product-naproxen | fact | product-naproxen.startDate
lisinopril-name | product-lisinopril | fact | product-lisinopril.name
lisinopril-role | product-lisinopril | fact | product-lisinopril.role
lisinopril-dose | product-lisinopril | fact | product-lisinopril.dose
lisinopril-frequency | product-lisinopril | fact | product-lisinopril.frequency
lisinopril-route | product-lisinopril | fact | product-lisinopril.route
apixaban-stopped | product-apixaban | fact | product-apixaban.stopped
naproxen-stopped | product-naproxen | fact | product-naproxen.stopped`;

const CORRECTION_CATALOG = `Declare no new products.

Allowed proposals (proposalId | groupId | intent | target):
naproxen-dose-correction | naproxen-dose-correction | correction | product-naproxen.dose
apixaban-date-alternative | apixaban-date-conflict | alternative | product-apixaban.startDate`;

type ProviderOutputFormat = Pick<
  ReturnType<typeof zodOutputFormat<typeof modelOutputSchema>>,
  "type" | "schema"
>;

export function createAnthropicRequest(turn: ModelTurn, text: string): AnthropicModelRequest {
  requireFixedInput(turn, text);
  const catalog = turn === "opening" ? OPENING_CATALOG : CORRECTION_CATALOG;
  return {
    model: ANTHROPIC_MODEL_ID,
    max_tokens: PROVIDER_MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `${catalog}\n\nClinician input:\n<input>\n${text}\n</input>`,
    }],
    output_config: { format: providerOutputFormat() },
  };
}

export function createAnthropicJourneyModel(
  requester: AnthropicRequester = defaultRequester(),
  now: () => number = Date.now,
  recordResponse?: AnthropicResponseRecorder,
): JourneyModel {
  return {
    async propose(turn, text) {
      const request = createAnthropicRequest(turn, text);
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
        );
      }

      const responseText = response.content
        .filter(isTextBlock)
        .map(({ text }) => text)
        .join("");
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
        );
      }
      const structured = modelOutputSchema.safeParse(decoded);
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
        );
      }

      try {
        return {
          envelope: parseModelProposalEnvelope({
            input: {
              id: turn === "opening" ? "input-opening" : "input-correction",
              type: turn === "opening" ? "narrative" : "correction",
              text,
              recordedAt: fixedRecordedAt,
            },
            ...structured.data,
          }),
          metrics,
          responseArtifact,
        };
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
  const format = zodOutputFormat(modelOutputSchema);
  return { type: format.type, schema: format.schema };
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

function requireFixedInput(turn: ModelTurn, text: string): void {
  const expected = turn === "opening" ? openingAccount : correctionAccount;
  if (text !== expected) {
    throw new Error("This experiment accepts only the displayed fictional account");
  }
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * INPUT_USD_PER_MILLION_TOKENS)
    + (outputTokens * OUTPUT_USD_PER_MILLION_TOKENS)
  ) / 1_000_000;
}
