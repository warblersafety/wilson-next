import { z } from "zod";
import type {
  CaseValue,
  FactTarget,
  GroundedProposal,
  ProposedProduct,
  Source,
} from "./types";

const targetSchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("patient"),
    entityId: z.literal("patient"),
    field: z.enum(["identifier", "ageYears", "sex"]),
  }),
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
  }),
  z.object({
    entity: z.literal("product"),
    entityId: z.string().min(1),
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
  }),
]);

const caseValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.unknown(), qualifier: z.string().min(1).optional() }),
  z.object({ kind: z.literal("unknown") }),
  z.object({ kind: z.literal("explicitly-absent") }),
  z.object({ kind: z.literal("inapplicable") }),
  z.object({ kind: z.literal("declined") }),
]);

const modelProposalEnvelopeSchema = z.object({
  input: z.object({
    id: z.string().min(1),
    type: z.enum(["narrative", "answer", "correction"]),
    text: z.string().min(1),
    recordedAt: z.string().datetime(),
  }),
  products: z.array(z.object({ id: z.string().min(1), groupId: z.string().min(1) })),
  proposals: z.array(z.object({
    proposalId: z.string().min(1),
    groupId: z.string().min(1),
    intent: z.enum(["fact", "correction", "alternative"]),
    target: targetSchema,
    value: caseValueSchema,
    source: z.object({ id: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive() }),
  })).min(1),
}).superRefine((envelope, context) => {
  const productIds = new Set<string>();
  for (const product of envelope.products) {
    if (productIds.has(product.id)) {
      context.addIssue({ code: "custom", message: `Duplicate proposed product ${product.id}` });
    }
    productIds.add(product.id);
  }

  const proposalIds = new Set<string>();
  const sourceSpans = new Map<string, string>();
  for (const proposal of envelope.proposals) {
    if (proposalIds.has(proposal.proposalId)) {
      context.addIssue({ code: "custom", message: `Duplicate proposal ${proposal.proposalId}` });
    }
    proposalIds.add(proposal.proposalId);

    const { start, end, id } = proposal.source;
    if (end > envelope.input.text.length || end <= start) {
      context.addIssue({ code: "custom", message: `Invalid source span ${id}` });
    } else if (!envelope.input.text.slice(start, end).trim()) {
      context.addIssue({ code: "custom", message: `Empty source span ${id}` });
    }
    const spanKey = `${start}:${end}`;
    const prior = sourceSpans.get(id);
    if (prior && prior !== spanKey) {
      context.addIssue({ code: "custom", message: `Source ${id} identifies different excerpts` });
    }
    sourceSpans.set(id, spanKey);

    const mismatch = knownValueMismatch(proposal.target, proposal.value);
    if (mismatch) context.addIssue({ code: "custom", message: mismatch });
  }
});

export interface ParsedModelProposalEnvelope {
  products: ProposedProduct[];
  sources: Source[];
  proposals: GroundedProposal[];
}

export function parseModelProposalEnvelope(input: unknown): ParsedModelProposalEnvelope {
  const parsed = modelProposalEnvelopeSchema.parse(input);
  const sources = new Map<string, Source>();

  for (const proposal of parsed.proposals) {
    const { id, start, end } = proposal.source;
    sources.set(id, {
      id,
      inputId: parsed.input.id,
      inputType: parsed.input.type,
      excerpt: parsed.input.text.slice(start, end),
      start,
      end,
      actor: "clinician",
      recordedAt: parsed.input.recordedAt,
    });
  }

  return {
    products: parsed.products,
    sources: [...sources.values()],
    proposals: parsed.proposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      groupId: proposal.groupId,
      intent: proposal.intent,
      target: proposal.target,
      value: proposal.value,
      sourceIds: [proposal.source.id],
    })),
  };
}

function knownValueMismatch(target: FactTarget, value: CaseValue<unknown>): string | undefined {
  if (value.kind !== "known") return undefined;
  const actual = value.value;
  const stringFields = new Set([
    "identifier", "onsetDate", "hemoglobin", "outcome", "dischargeDate",
    "name", "dose", "frequency", "route", "startDate", "stopDate", "indication",
  ]);
  if (stringFields.has(target.field) && typeof actual !== "string") return `${target.field} requires a string`;
  if (["onsetDate", "dischargeDate", "startDate", "stopDate"].includes(target.field)
    && (typeof actual !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(actual))) return `${target.field} requires an ISO calendar date`;
  if (target.field === "ageYears" && (!Number.isInteger(actual) || (actual as number) < 0 || (actual as number) > 150)) return "ageYears requires a valid age";
  if (target.field === "sex" && !["female", "male", "intersex"].includes(actual as string)) return "sex requires a supported value";
  if (["symptoms", "treatments"].includes(target.field) && (!Array.isArray(actual) || actual.some((item) => typeof item !== "string"))) return `${target.field} requires a string array`;
  if (["hospitalized", "stopped"].includes(target.field) && typeof actual !== "boolean") return `${target.field} requires a boolean`;
  if (target.field === "role" && !["suspect", "concomitant"].includes(actual as string)) return "role requires suspect or concomitant";
  return undefined;
}
