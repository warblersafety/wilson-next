import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { parseModelProposalEnvelope } from "../../domain/case/model-boundary";
import type { ParsedModelProposalEnvelope } from "../../domain/case/model-boundary";
import {
  correctionAccount,
  fixedRecordedAt,
  openingAccount,
} from "../../experiment/fixed-inputs";
import { ModelCallFailure } from "./journey-model";
import {
  parseFixedCorrectionResponse,
  parseFixedOpeningResponse,
} from "./fixed-journey";
import type {
  JourneyModel,
  ModelCallMetrics,
  ModelDiagnosticIssue,
  ModelFailureDiagnostic,
  ModelTurn,
} from "./journey-model";

export const ANTHROPIC_MODEL_ID = "claude-sonnet-5";
export const MODEL_PROMPT_REVISION = "wilson-experiment-1-extraction-v3";
export const MODEL_SCHEMA_REVISION = "wilson-grounded-proposals-v4";
// The Messages API requires max_tokens. Use Sonnet 5's full provider output
// capacity here so Wilson imposes no development/verification token budget.
export const PROVIDER_MAX_OUTPUT_TOKENS = 128_000;
export const MODEL_MAX_RETRIES = 0;

const INPUT_USD_PER_MILLION_TOKENS = 2;
const OUTPUT_USD_PER_MILLION_TOKENS = 10;
const CANONICAL_PRODUCT_ROLES = ["suspect", "concomitant"] as const;
const PRODUCT_ROLE_SCHEMA_GUIDANCE = 'When target.field is "role", value.value must be exactly "suspect" or "concomitant"; do not inflect or otherwise vary these canonical literals.';

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

const modelProposalSchema = z.object({
  proposalId: z.string(),
  groupId: z.string(),
  intent: z.enum(["fact", "correction", "alternative"]),
  target: modelTargetSchema,
  value: z.object({
    kind: z.literal("known"),
    value: z.union([
      z.string().describe(PRODUCT_ROLE_SCHEMA_GUIDANCE),
      z.number(),
      z.boolean(),
      z.array(z.string()),
    ]),
  }).strict(),
  source: z.object({
    start: z.number().int(),
    end: z.number().int(),
  }).strict(),
}).strict().superRefine((proposal, context) => {
  if (proposal.target.field !== "role") return;
  if (typeof proposal.value.value === "string"
    && CANONICAL_PRODUCT_ROLES.some((role) => role === proposal.value.value)) return;
  context.addIssue({
    code: "custom",
    path: ["value", "value"],
    message: "Role value must be the canonical literal suspect or concomitant",
  });
});

const modelOutputSchema = z.object({
  products: z.array(z.object({
    id: z.enum(["product-apixaban", "product-naproxen", "product-lisinopril"]),
    groupId: z.enum(["product-apixaban", "product-naproxen", "product-lisinopril"]),
  }).strict()),
  proposals: z.array(modelProposalSchema).min(1),
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
- Keep each medicine attached to its exact stable product ID. For product roles, emit only the canonical literal "suspect" or "concomitant". Map statements such as "I suspect ..." to "suspect"; do not inflect or otherwise vary either literal. A reported suspect role is not your causality judgment.
- Use normalized ISO dates (YYYY-MM-DD), "oral" for "by mouth", and the literal frequency wording "twice daily" or "daily".
- Preserve a measurement's value and unit together as a string, for example "7.8 g/dL" rather than 7.8.
- Every proposal must cite the smallest exact supporting substring using zero-based start-inclusive/end-exclusive character offsets into the clinician input. Offsets must select non-empty text exactly.
- Supply only the source offsets. Wilson assigns stable source identity; the model does not.
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

interface FixedSourceRule {
  within: string;
  includes: string[];
}

const FIXED_SOURCE_RULES: Record<string, FixedSourceRule> = {
  "patient-id": { within: "Patient TEST-57", includes: ["TEST-57"] },
  "patient-age": { within: "a 57-year-old woman", includes: ["57-year-old"] },
  "patient-sex": { within: "a 57-year-old woman", includes: ["woman"] },
  "event-symptoms": { within: "melena and dizziness", includes: ["melena", "dizziness"] },
  "event-onset": { within: "On 18-Aug-2026 she developed", includes: ["18-Aug-2026"] },
  "event-hospitalized": { within: "and was hospitalized", includes: ["hospitalized"] },
  "event-hemoglobin": { within: "Her hemoglobin was 7.8 g/dL", includes: ["7.8 g/dL"] },
  "event-treatment": { within: "she received two units of packed red cells", includes: ["two units of packed red cells"] },
  "event-outcome": { within: "she recovered", includes: ["recovered"] },
  "event-discharge": { within: "was discharged on 21-Aug-2026", includes: ["21-Aug-2026"] },
  "apixaban-name": { within: "apixaban 5 mg by mouth twice daily", includes: ["apixaban"] },
  "apixaban-role": { within: "I suspect apixaban and naproxen", includes: ["suspect", "apixaban"] },
  "apixaban-dose": { within: "apixaban 5 mg by mouth twice daily", includes: ["5 mg"] },
  "apixaban-frequency": { within: "apixaban 5 mg by mouth twice daily", includes: ["twice daily"] },
  "apixaban-route": { within: "apixaban 5 mg by mouth twice daily", includes: ["by mouth"] },
  "apixaban-start": { within: "I recorded the start as 12-Aug-2026", includes: ["12-Aug-2026"] },
  "naproxen-name": { within: "naproxen 500 mg by mouth twice daily", includes: ["naproxen"] },
  "naproxen-role": { within: "I suspect apixaban and naproxen", includes: ["suspect", "naproxen"] },
  "naproxen-dose": { within: "naproxen 500 mg by mouth twice daily", includes: ["500 mg"] },
  "naproxen-frequency": { within: "naproxen 500 mg by mouth twice daily", includes: ["twice daily"] },
  "naproxen-route": { within: "naproxen 500 mg by mouth twice daily", includes: ["by mouth"] },
  "naproxen-start": { within: "naproxen 500 mg by mouth twice daily starting 10-Aug-2026", includes: ["10-Aug-2026"] },
  "lisinopril-name": { within: "lisinopril 10 mg by mouth daily", includes: ["lisinopril"] },
  "lisinopril-role": { within: "lisinopril 10 mg by mouth daily as a concomitant medicine", includes: ["concomitant"] },
  "lisinopril-dose": { within: "lisinopril 10 mg by mouth daily", includes: ["10 mg"] },
  "lisinopril-frequency": { within: "lisinopril 10 mg by mouth daily", includes: ["daily"] },
  "lisinopril-route": { within: "lisinopril 10 mg by mouth daily", includes: ["by mouth"] },
  "apixaban-stopped": { within: "Apixaban and naproxen were stopped", includes: ["apixaban", "stopped"] },
  "naproxen-stopped": { within: "Apixaban and naproxen were stopped", includes: ["naproxen", "stopped"] },
  "naproxen-dose-correction": {
    within: "the naproxen dose was 250 mg twice daily, not 500 mg twice daily",
    includes: ["naproxen", "250 mg", "500 mg"],
  },
  "apixaban-date-alternative": {
    within: "the medication administration record lists apixaban starting 13-Aug-2026",
    includes: ["medication administration record", "apixaban", "13-Aug-2026"],
  },
};

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
          response,
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
          response,
        );
      }

      try {
        const envelope = parseModelProposalEnvelope({
          input: {
            id: turn === "opening" ? "input-opening" : "input-correction",
            type: turn === "opening" ? "narrative" : "correction",
            text,
            recordedAt: fixedRecordedAt,
          },
          ...structured.data,
          proposals: structured.data.proposals.map((proposal) => ({
            ...proposal,
            source: {
              id: `source-${proposal.proposalId}`,
              start: proposal.source.start,
              end: proposal.source.end,
            },
          })),
        });
        requireFixedSemantics(turn, envelope);
        return {
          envelope,
          metrics,
          responseArtifact,
          diagnosticResponse: response,
        };
      } catch (error) {
        throw new ModelCallFailure(
          "Wilson could not interpret the fictional account. Accepted case knowledge is unchanged.",
          {
            phase: "domain-boundary",
            requestId: response.id,
            responseArtifact,
            errorName: errorName(error),
            issues: error instanceof z.ZodError
              ? zodIssues(error)
              : error instanceof FixedSemanticOutputError
                ? error.issues
                : undefined,
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

class FixedSemanticOutputError extends Error {
  constructor(readonly issues: ModelDiagnosticIssue[]) {
    super("The response did not match the fixed experiment's grounded semantic contract");
    this.name = "FixedSemanticOutputError";
  }
}

function requireFixedSemantics(turn: ModelTurn, actual: ParsedModelProposalEnvelope): void {
  const expected = turn === "opening"
    ? parseFixedOpeningResponse(openingAccount)
    : parseFixedCorrectionResponse(correctionAccount);
  const issues: ModelDiagnosticIssue[] = [];

  if (!sameJson(actual.products, expected.products)) {
    issues.push({
      path: "products",
      code: "fixed_semantic_mismatch",
      message: "Products do not match the fixed experiment catalog",
    });
  }

  const actualProposals = new Map(actual.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const expectedProposals = new Map(expected.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const actualSources = new Map(actual.sources.map((source) => [source.id, source]));
  const inputText = turn === "opening" ? openingAccount : correctionAccount;

  for (const [proposalId, expectedProposal] of expectedProposals) {
    const proposal = actualProposals.get(proposalId);
    if (!proposal) {
      issues.push({
        path: `proposals.${proposalId}`,
        code: "fixed_semantic_mismatch",
        message: `Required proposal ${proposalId} is missing`,
      });
      continue;
    }
    if (!sameJson(proposal, expectedProposal)) {
      issues.push({
        path: `proposals.${proposalId}`,
        code: "fixed_semantic_mismatch",
        message: `Proposal ${proposalId} does not match the fixed semantic expectation`,
      });
    }

    const expectedSourceId = expectedProposal.sourceIds[0];
    if (!sourceSupportsProposal(
      actualSources.get(expectedSourceId),
      FIXED_SOURCE_RULES[proposalId],
      inputText,
    )) {
      issues.push({
        path: `sources.${expectedSourceId}`,
        code: "fixed_semantic_mismatch",
        message: `Proposal ${proposalId} source span does not ground the fixed semantic expectation`,
      });
    }
  }

  for (const proposalId of actualProposals.keys()) {
    if (!expectedProposals.has(proposalId)) {
      issues.push({
        path: `proposals.${proposalId}`,
        code: "fixed_semantic_mismatch",
        message: `Unexpected proposal ${proposalId} is outside the fixed experiment catalog`,
      });
    }
  }

  if (issues.length > 0) throw new FixedSemanticOutputError(issues);
}

function sourceSupportsProposal(
  source: ParsedModelProposalEnvelope["sources"][number] | undefined,
  rule: FixedSourceRule | undefined,
  inputText: string,
): boolean {
  if (!source || !rule) return false;
  const containerStart = inputText.indexOf(rule.within);
  if (containerStart < 0) return false;
  const containerEnd = containerStart + rule.within.length;
  if (source.start < containerStart || source.end > containerEnd) return false;
  const excerpt = source.excerpt.toLowerCase();
  return rule.includes.every((required) => excerpt.includes(required.toLowerCase()));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * INPUT_USD_PER_MILLION_TOKENS)
    + (outputTokens * OUTPUT_USD_PER_MILLION_TOKENS)
  ) / 1_000_000;
}
