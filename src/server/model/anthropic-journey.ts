import Anthropic from "@anthropic-ai/sdk";
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

type ModelOutput = z.infer<typeof modelOutputSchema>;

export interface AnthropicModelRequest {
  model: typeof ANTHROPIC_MODEL_ID;
  max_tokens: typeof PROVIDER_MAX_OUTPUT_TOKENS;
  system: string;
  messages: [{ role: "user"; content: string }];
  output_config: { format: ReturnType<typeof zodOutputFormat<typeof modelOutputSchema>> };
}

export interface AnthropicModelResponse {
  model: string;
  stop_reason: string | null;
  parsed_output: ModelOutput | null;
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
    output_config: { format: zodOutputFormat(modelOutputSchema) },
  };
}

export function createAnthropicJourneyModel(
  requester: AnthropicRequester = defaultRequester(),
  now: () => number = Date.now,
): JourneyModel {
  return {
    async propose(turn, text) {
      const request = createAnthropicRequest(turn, text);
      const startedAt = now();
      let response: AnthropicModelResponse;
      try {
        response = await requester(request);
      } catch {
        throw new ModelCallFailure("Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.");
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
      if (response.stop_reason !== "end_turn" || response.parsed_output === null) {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
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
            ...response.parsed_output,
          }),
          metrics,
        };
      } catch {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
          metrics,
        );
      }
    },
  };
}

function defaultRequester(): AnthropicRequester {
  const client = new Anthropic({ maxRetries: MODEL_MAX_RETRIES, logLevel: "off" });
  return async (request) => client.messages.parse(request);
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
