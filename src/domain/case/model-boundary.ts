import { z } from "zod";
import type { CaseValue, FactTarget, GroundedProposal, ProposedProduct, Source } from "./types";

const patientFields = ["identifier", "ageYears", "sex"] as const;
const eventFields = ["symptoms", "onsetDate", "hospitalized", "hemoglobin", "treatments", "outcome", "dischargeDate"] as const;
const productFields = ["name", "role", "dose", "frequency", "route", "startDate", "stopDate", "indication", "stopped"] as const;

const modelTargetSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("patient"), field: z.enum(patientFields) }).strict(),
  z.object({ entity: z.literal("event"), field: z.enum(eventFields) }).strict(),
  z.object({
    entity: z.literal("product"),
    productReference: z.string().min(1),
    field: z.enum(productFields),
  }).strict(),
]);

const caseValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    qualifier: z.string().min(1).optional(),
  }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("explicitly-absent") }).strict(),
  z.object({ kind: z.literal("inapplicable") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

export const modelProposalOutputSchema = z.object({
  products: z.array(z.object({
    productReference: z.string().min(1),
    groupReference: z.string().min(1),
  }).strict()),
  proposals: z.array(z.object({
    proposalReference: z.string().min(1),
    groupReference: z.string().min(1),
    intent: z.enum(["fact", "correction", "alternative"]),
    target: modelTargetSchema,
    value: caseValueSchema,
    evidenceQuote: z.string().min(1),
  }).strict()).min(1),
}).strict().superRefine((output, context) => {
  reportDuplicates(output.products.map(({ productReference }) => productReference), "productReference", ["products"], context);
  reportDuplicates(output.products.map(({ groupReference }) => groupReference), "product groupReference", ["products"], context);
  reportDuplicates(output.proposals.map(({ proposalReference }) => proposalReference), "proposalReference", ["proposals"], context);
  output.proposals.forEach((proposal, index) => {
    if (!proposal.evidenceQuote.trim()) {
      context.addIssue({ code: "custom", path: ["proposals", index, "evidenceQuote"], message: "Evidence quotation must not be blank" });
    }
  });
});

const inputSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["narrative", "answer", "correction"]),
  text: z.string().min(1),
  recordedAt: z.string().datetime(),
}).strict();

export type ModelProposalOutput = z.infer<typeof modelProposalOutputSchema>;
export type ModelBoundaryIdentityKind = "input" | "product" | "group" | "proposal" | "source";
export type ModelBoundaryIdentityFactory = (kind: ModelBoundaryIdentityKind, responseReference: string) => string;

export interface ParseModelProposalEnvelopeInput {
  turn: "opening" | "correction";
  input: z.infer<typeof inputSchema>;
  existingProductIds?: readonly string[];
  output: unknown;
}

export interface ParsedModelProposalEnvelope {
  products: ProposedProduct[];
  sources: Source[];
  proposals: GroundedProposal[];
}

export function parseModelProposalEnvelope(
  candidate: ParseModelProposalEnvelopeInput,
  createIdentity: ModelBoundaryIdentityFactory,
): ParsedModelProposalEnvelope {
  const input = inputSchema.parse(candidate.input);
  const output = modelProposalOutputSchema.parse(candidate.output);
  const existingProductIds = new Set(candidate.existingProductIds ?? []);
  if (candidate.turn === "opening" && existingProductIds.size > 0) {
    boundaryIssue(["existingProductIds"], "Opening input cannot reference existing products");
  }
  if (candidate.turn === "correction" && output.products.length > 0) {
    boundaryIssue(["products"], "Later input cannot declare new products in this experiment");
  }

  const allocatedByKind = new Map<ModelBoundaryIdentityKind, Set<string>>();
  const allocate = (kind: ModelBoundaryIdentityKind, reference: string): string => {
    const id = createIdentity(kind, reference);
    const allocated = allocatedByKind.get(kind) ?? new Set<string>();
    if (!id.trim() || allocated.has(id) || (kind === "product" && existingProductIds.has(id))) {
      boundaryIssue([], `Application identity factory returned an invalid or duplicate ${kind} ID`);
    }
    allocated.add(id);
    allocatedByKind.set(kind, allocated);
    return id;
  };

  const productByReference = new Map<string, { id: string; groupId: string; groupReference: string }>();
  const groupByReference = new Map<string, string>();
  for (const product of output.products) {
    const groupId = allocate("group", product.groupReference);
    groupByReference.set(product.groupReference, groupId);
    productByReference.set(product.productReference, {
      id: allocate("product", product.productReference),
      groupId,
      groupReference: product.groupReference,
    });
  }

  const sourceByQuote = new Map<string, Source>();
  const proposals: GroundedProposal[] = [];
  const groupTarget = new Map<string, string>();
  output.proposals.forEach((proposal, index) => {
    const path = ["proposals", index] as Array<string | number>;
    const target = resolveTarget(candidate.turn, proposal.target, productByReference, existingProductIds, path);
    const targetIdentity = target.entity === "product" ? `product:${target.entityId}` : target.entity;
    const priorTarget = groupTarget.get(proposal.groupReference);
    if (priorTarget && priorTarget !== targetIdentity) {
      boundaryIssue([...path, "groupReference"], "A proposal group cannot span different case entities");
    }
    groupTarget.set(proposal.groupReference, targetIdentity);

    let groupId: string;
    if (candidate.turn === "opening" && target.entity !== "product") {
      groupId = target.entity;
    } else if (candidate.turn === "opening") {
      const reference = proposal.target.entity === "product" ? proposal.target.productReference : "";
      const declared = productByReference.get(reference);
      if (!declared || declared.groupReference !== proposal.groupReference) {
        boundaryIssue([...path, "groupReference"], "Opening product proposals must use their declared product group");
      }
      groupId = declared.groupId;
    } else {
      groupId = groupByReference.get(proposal.groupReference) ?? allocate("group", proposal.groupReference);
      groupByReference.set(proposal.groupReference, groupId);
    }

    const mismatch = knownValueMismatch(target, proposal.value);
    if (mismatch) boundaryIssue([...path, "value"], mismatch);
    const source = sourceByQuote.get(proposal.evidenceQuote)
      ?? locateEvidence(input, proposal.evidenceQuote, proposal.proposalReference, allocate, path);
    sourceByQuote.set(proposal.evidenceQuote, source);
    proposals.push({
      proposalId: allocate("proposal", proposal.proposalReference),
      groupId,
      intent: proposal.intent,
      target,
      value: proposal.value,
      sourceIds: [source.id],
    });
  });

  for (const [reference] of productByReference) {
    if (!output.proposals.some(({ target }) => target.entity === "product" && target.productReference === reference)) {
      boundaryIssue(["products"], `Declared product ${reference} has no proposals`);
    }
  }

  return {
    products: [...productByReference.values()].map(({ id, groupId }) => ({ id, groupId })),
    sources: [...sourceByQuote.values()],
    proposals,
  };
}

function resolveTarget(
  turn: "opening" | "correction",
  target: ModelProposalOutput["proposals"][number]["target"],
  proposedProducts: Map<string, { id: string }>,
  existingProductIds: Set<string>,
  path: Array<string | number>,
): FactTarget {
  if (target.entity === "patient") return { entity: "patient", entityId: "patient", field: target.field };
  if (target.entity === "event") return { entity: "event", entityId: "event", field: target.field };
  if (turn === "opening") {
    const product = proposedProducts.get(target.productReference);
    if (!product) boundaryIssue([...path, "target", "productReference"], `Unknown proposed product reference ${target.productReference}`);
    return { entity: "product", entityId: product.id, field: target.field };
  }
  if (!existingProductIds.has(target.productReference)) {
    boundaryIssue([...path, "target", "productReference"], `Unknown reviewed product ID ${target.productReference}`);
  }
  return { entity: "product", entityId: target.productReference, field: target.field };
}

function locateEvidence(
  input: z.infer<typeof inputSchema>,
  quote: string,
  responseReference: string,
  allocate: (kind: ModelBoundaryIdentityKind, reference: string) => string,
  path: Array<string | number>,
): Source {
  const start = input.text.indexOf(quote);
  if (start === -1) boundaryIssue([...path, "evidenceQuote"], "Evidence quotation is absent from the clinician input");
  if (input.text.indexOf(quote, start + 1) !== -1) {
    boundaryIssue([...path, "evidenceQuote"], "Evidence quotation occurs more than once in the clinician input");
  }
  return {
    id: allocate("source", responseReference),
    inputId: input.id,
    inputType: input.type,
    excerpt: quote,
    start,
    end: start + quote.length,
    actor: "clinician",
    recordedAt: input.recordedAt,
  };
}

function boundaryIssue(path: Array<string | number>, message: string): never {
  throw new z.ZodError([{ code: "custom", path, message, input: undefined }]);
}

function reportDuplicates(
  values: string[],
  label: string,
  path: Array<string | number>,
  context: z.core.$RefinementCtx<unknown>,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) context.addIssue({ code: "custom", path: [...path, index], message: `Duplicate ${label} ${value}` });
    seen.add(value);
  });
}

function knownValueMismatch(target: FactTarget, value: CaseValue<unknown>): string | undefined {
  if (value.kind !== "known") return undefined;
  const actual = value.value;
  const stringFields = new Set([
    "identifier", "reportType", "onsetDate", "hemoglobin", "outcome", "dischargeDate",
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
  if (target.field === "reportType" && actual !== "adverse-event") return "reportType requires adverse-event";
  return undefined;
}
