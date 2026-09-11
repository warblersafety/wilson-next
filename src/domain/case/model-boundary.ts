import { z } from "zod";
import type { FactTarget, GroundedProposal, ProposedProduct, ProposedRelevantTest, Source } from "./types";
import { knownValueMismatch, maximumCaseProducts, modelKnownValueGuidance } from "./value-contract";

const patientFields = ["identifier", "ageYears", "sex", "weight"] as const;
const eventFields = ["problemDescription", "symptoms", "onsetDate", "death", "deathDate", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious", "relevantTestsAvailable", "relevantHistory", "treatments", "outcome", "dischargeDate", "productAvailability", "productReturnDate"] as const;
const productFields = ["name", "productType", "role", "manufacturer", "lotNumber", "dose", "frequency", "route", "startDate", "stopDate", "indication", "stopped", "commonName", "procode", "modelNumber", "catalogNumber", "expirationDate", "serialNumber", "udi", "deviceOperator", "implanted", "implantDate", "explantDate", "reprocessedSingleUse", "reprocessor", "servicedByThirdParty"] as const;
const relevantTestFields = ["testResult", "lowRange", "highRange", "date"] as const;

const modelTargetSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("patient"), field: z.enum(patientFields) }).strict(),
  z.object({ entity: z.literal("event"), field: z.enum(eventFields) }).strict(),
  z.object({ entity: z.literal("test"), testReference: z.string().min(1), field: z.enum(relevantTestFields) }).strict(),
  z.object({ entity: z.literal("product"), productReference: z.string().min(1), field: z.enum(productFields) }).strict(),
]);

const caseValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.object({ value: z.number().positive(), unit: z.enum(["kg", "lb"]) }).strict()])
      .describe(`${modelKnownValueGuidance()} Preserve explicitly stated descriptive detail; normalize only conventions defined by the model instructions.`),
    qualifier: z.string().min(1).optional(),
  }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("explicitly-absent") }).strict(),
  z.object({ kind: z.literal("inapplicable") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

const productDeclarationSchema = z.object({
  productReference: z.string().min(1),
  groupReference: z.string().min(1),
}).strict();

const testDeclarationSchema = z.object({
  testReference: z.string().min(1),
  groupReference: z.string().min(1),
}).strict();

const modelProposalSchema = z.object({
  proposalReference: z.string().min(1),
  groupReference: z.string().min(1),
  intent: z.enum(["fact", "correction", "alternative"]),
  target: modelTargetSchema,
  value: caseValueSchema,
  evidenceQuote: z.string().min(1).describe(
    "An exact contiguous quotation that independently identifies the subject and complete claim. Completeness outranks brevity, including wording needed for negation, correction, alternatives, or unresolved uncertainty.",
  ),
}).strict();

export const modelProposalOutputSchema = withEnvelopeChecks(z.object({
  products: z.array(productDeclarationSchema),
  tests: z.array(testDeclarationSchema).optional(),
  proposals: z.array(modelProposalSchema).min(1),
}).strict());

const quarantinableProposalSchema = z.object({
  proposalReference: z.string().min(1),
  groupReference: z.string().min(1),
  intent: z.unknown(),
  target: z.object({
    entity: z.string().min(1),
    field: z.string().min(1),
    productReference: z.string().min(1).optional(),
    testReference: z.string().min(1).optional(),
  }).passthrough(),
  value: z.unknown(),
  evidenceQuote: z.string().min(1),
}).passthrough().superRefine((proposal, context) => {
  if (!Object.hasOwn(proposal, "value")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Proposal value is required" });
  }
  if (!proposal.evidenceQuote.trim()) {
    context.addIssue({ code: "custom", path: ["evidenceQuote"], message: "Evidence quotation must not be blank" });
  }
});

export const modelProposalEnvelopeSchema = withEnvelopeChecks(z.object({
  products: z.array(productDeclarationSchema),
  tests: z.array(testDeclarationSchema).optional(),
  proposals: z.array(quarantinableProposalSchema).min(1),
}).strict());

const inputSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["narrative", "answer", "correction"]),
  text: z.string().min(1),
  recordedAt: z.string().datetime(),
}).strict();

export type ModelProposalOutput = z.infer<typeof modelProposalOutputSchema>;
type ModelProposal = z.infer<typeof modelProposalSchema>;
type QuarantinableProposal = z.infer<typeof quarantinableProposalSchema>;
export type ModelBoundaryIdentityKind = "input" | "product" | "test" | "group" | "proposal" | "source";
export type ModelBoundaryIdentityFactory = (kind: ModelBoundaryIdentityKind, responseReference: string) => string;

export type UnrepresentedProposalReason =
  | "unsupported-proposal"
  | "unsupported-target"
  | "product-limit"
  | "incompatible-value"
  | "unresolved-entity"
  | "evidence-not-found"
  | "evidence-ambiguous"
  | "incomplete-relevant-test";

export interface UnrepresentedModelProposal {
  entity: string;
  field: string;
  evidenceQuote: string;
  reason: UnrepresentedProposalReason;
}

export interface ParseModelProposalEnvelopeInput {
  turn: "opening" | "correction";
  input: z.infer<typeof inputSchema>;
  existingProductIds?: readonly string[];
  existingTestIds?: readonly string[];
  output: unknown;
}

export interface ParsedModelProposalEnvelope {
  products: ProposedProduct[];
  relevantTests: ProposedRelevantTest[];
  sources: Source[];
  proposals: GroundedProposal[];
  unrepresented: UnrepresentedModelProposal[];
}

interface DeclaredEntity {
  id: string;
  groupId: string;
  groupReference: string;
}

interface PreparedProposal {
  proposal: ModelProposal;
  target: FactTarget;
  groupId: string;
  evidenceStart: number;
}

export function parseModelProposalEnvelope(
  candidate: ParseModelProposalEnvelopeInput,
  createIdentity: ModelBoundaryIdentityFactory,
): ParsedModelProposalEnvelope {
  const input = inputSchema.parse(candidate.input);
  const output = modelProposalEnvelopeSchema.parse(candidate.output);
  const outputTests = output.tests ?? [];
  const existingProductIds = new Set(candidate.existingProductIds ?? []);
  const existingTestIds = new Set(candidate.existingTestIds ?? []);
  if (candidate.turn === "opening" && (existingProductIds.size > 0 || existingTestIds.size > 0)) {
    boundaryIssue(["existingProductIds"], "Opening input cannot reference existing entities");
  }
  if (candidate.turn === "correction" && (output.products.length > 0 || outputTests.length > 0)) {
    boundaryIssue(["products"], "Later input cannot declare new entities in this experiment");
  }

  const allocatedByKind = new Map<ModelBoundaryIdentityKind, Set<string>>();
  const allocate = (kind: ModelBoundaryIdentityKind, reference: string): string => {
    const id = createIdentity(kind, reference);
    const allocated = allocatedByKind.get(kind) ?? new Set<string>();
    if (!id.trim() || allocated.has(id)) {
      boundaryIssue([], `Application identity factory returned an invalid or duplicate ${kind} ID`);
    }
    allocated.add(id);
    allocatedByKind.set(kind, allocated);
    return id;
  };

  const declaredProductByReference = new Map(output.products.map((product) => [product.productReference, product]));
  const productByReference = new Map<string, DeclaredEntity>();
  const excessProductReferences = new Set(
    output.products.slice(maximumCaseProducts).map(({ productReference }) => productReference),
  );
  const groupByReference = new Map<string, string>();
  for (const product of output.products.slice(0, maximumCaseProducts)) {
    const groupId = allocate("group", product.groupReference);
    groupByReference.set(product.groupReference, groupId);
    productByReference.set(product.productReference, {
      id: allocate("product", product.productReference), groupId, groupReference: product.groupReference,
    });
  }
  const testByReference = new Map<string, DeclaredEntity>();
  for (const test of outputTests) {
    const groupId = allocate("group", test.groupReference);
    groupByReference.set(test.groupReference, groupId);
    testByReference.set(test.testReference, {
      id: allocate("test", test.testReference), groupId, groupReference: test.groupReference,
    });
  }

  assertResponseLevelProposalConsistency(output.proposals, declaredProductByReference, testByReference);

  const unrepresented: UnrepresentedModelProposal[] = [];
  let prepared: PreparedProposal[] = [];
  for (const [index, rawProposal] of output.proposals.entries()) {
    const parsed = modelProposalSchema.safeParse(rawProposal);
    if (!parsed.success) {
      unrepresented.push(quarantine(rawProposal, proposalSchemaReason(parsed.error)));
      continue;
    }
    const proposal = parsed.data;
    if (proposal.target.entity === "product" && excessProductReferences.has(proposal.target.productReference)) {
      unrepresented.push(quarantine(rawProposal, "product-limit"));
      continue;
    }
    const target = resolveTarget(
      candidate.turn, proposal.target, productByReference, existingProductIds, testByReference, existingTestIds,
    );
    if (!target) {
      unrepresented.push(quarantine(rawProposal, "unresolved-entity"));
      continue;
    }
    const groupId = resolveGroupId(
      candidate.turn, proposal, target, productByReference, testByReference,
      groupByReference, allocate, ["proposals", index],
    );
    if (knownValueMismatch(target, proposal.value)) {
      unrepresented.push(quarantine(rawProposal, "incompatible-value"));
      continue;
    }
    const evidence = locateEvidence(input.text, proposal.evidenceQuote);
    if (evidence === "not-found") {
      unrepresented.push(quarantine(rawProposal, "evidence-not-found"));
      continue;
    }
    if (evidence === "ambiguous") {
      unrepresented.push(quarantine(rawProposal, "evidence-ambiguous"));
      continue;
    }
    prepared.push({ proposal, target, groupId, evidenceStart: evidence });
  }

  for (const [reference, declaration] of testByReference) {
    const forTest = prepared.filter(({ target }) => target.entity === "test" && target.entityId === declaration.id);
    if (forTest.length > 0 && !forTest.some(({ target }) => target.field === "testResult")) {
      for (const item of forTest) unrepresented.push(quarantine(item.proposal, "incomplete-relevant-test"));
      prepared = prepared.filter(({ target }) => target.entity !== "test" || target.entityId !== declaration.id);
    }
    if (!output.proposals.some(({ target }) => target.entity === "test" && target.testReference === reference)) {
      boundaryIssue(["tests"], `Declared relevant test ${reference} has no proposals`);
    }
  }
  for (const { productReference: reference } of output.products) {
    if (!output.proposals.some(({ target }) => target.entity === "product" && target.productReference === reference)) {
      boundaryIssue(["products"], `Declared product ${reference} has no proposals`);
    }
  }

  if (prepared.length === 0) boundaryIssue(["proposals"], "Every proposal was unrepresentable");

  const sourceByQuote = new Map<string, Source>();
  const proposals: GroundedProposal[] = prepared.map(({ proposal, target, groupId, evidenceStart }) => {
    const source = sourceByQuote.get(proposal.evidenceQuote) ?? {
      id: allocate("source", proposal.proposalReference),
      inputId: input.id,
      inputType: input.type,
      excerpt: proposal.evidenceQuote,
      start: evidenceStart,
      end: evidenceStart + proposal.evidenceQuote.length,
      actor: "clinician" as const,
      recordedAt: input.recordedAt,
    };
    sourceByQuote.set(proposal.evidenceQuote, source);
    return {
      proposalId: allocate("proposal", proposal.proposalReference), groupId, intent: proposal.intent,
      target, value: proposal.value, sourceIds: [source.id],
    };
  });

  const retainedProductIds = new Set(proposals.filter(({ target }) => target.entity === "product").map(({ target }) => target.entityId));
  const retainedTestIds = new Set(proposals.filter(({ target }) => target.entity === "test").map(({ target }) => target.entityId));

  return {
    products: [...productByReference.values()].filter(({ id }) => retainedProductIds.has(id)).map(({ id, groupId }) => ({ id, groupId })),
    relevantTests: [...testByReference.values()].filter(({ id }) => retainedTestIds.has(id)).map(({ id, groupId }) => ({ id, groupId })),
    sources: [...sourceByQuote.values()],
    proposals,
    unrepresented,
  };
}

function resolveTarget(
  turn: "opening" | "correction",
  target: ModelProposal["target"],
  proposedProducts: Map<string, DeclaredEntity>,
  existingProductIds: Set<string>,
  proposedTests: Map<string, DeclaredEntity>,
  existingTestIds: Set<string>,
): FactTarget | undefined {
  if (target.entity === "patient") return { entity: "patient", entityId: "patient", field: target.field };
  if (target.entity === "event") return { entity: "event", entityId: "event", field: target.field };
  if (target.entity === "test") {
    if (turn === "opening") {
      const test = proposedTests.get(target.testReference);
      return test ? { entity: "test", entityId: test.id, field: target.field } : undefined;
    }
    return existingTestIds.has(target.testReference) ? { entity: "test", entityId: target.testReference, field: target.field } : undefined;
  }
  if (turn === "opening") {
    const product = proposedProducts.get(target.productReference);
    return product ? { entity: "product", entityId: product.id, field: target.field } : undefined;
  }
  return existingProductIds.has(target.productReference) ? { entity: "product", entityId: target.productReference, field: target.field } : undefined;
}

function resolveGroupId(
  turn: "opening" | "correction",
  proposal: ModelProposal,
  target: FactTarget,
  proposedProducts: Map<string, DeclaredEntity>,
  proposedTests: Map<string, DeclaredEntity>,
  groupByReference: Map<string, string>,
  allocate: (kind: ModelBoundaryIdentityKind, reference: string) => string,
  path: Array<string | number>,
): string {
  if (turn === "opening" && target.entity !== "product" && target.entity !== "test") return target.entity;
  if (turn === "opening") {
    const declared = proposal.target.entity === "product"
      ? proposedProducts.get(proposal.target.productReference)
      : proposal.target.entity === "test"
        ? proposedTests.get(proposal.target.testReference)
        : undefined;
    if (!declared || declared.groupReference !== proposal.groupReference) {
      boundaryIssue([...path, "groupReference"], "Opening entity proposals must use their declared group");
    }
    return declared.groupId;
  }
  const groupId = groupByReference.get(proposal.groupReference) ?? allocate("group", proposal.groupReference);
  groupByReference.set(proposal.groupReference, groupId);
  return groupId;
}

function assertResponseLevelProposalConsistency(
  proposals: QuarantinableProposal[],
  proposedProducts: Map<string, { groupReference: string }>,
  proposedTests: Map<string, DeclaredEntity>,
): void {
  const groupTargets = new Map<string, string>();
  proposals.forEach((proposal, index) => {
    const identity = rawTargetIdentity(proposal.target);
    const prior = groupTargets.get(proposal.groupReference);
    if (prior && prior !== identity) {
      boundaryIssue(["proposals", index, "groupReference"], "A proposal group cannot span different case entities");
    }
    groupTargets.set(proposal.groupReference, identity);
    if (proposal.target.entity === "product" && proposal.target.productReference) {
      const declared = proposedProducts.get(proposal.target.productReference);
      if (declared && declared.groupReference !== proposal.groupReference) {
        boundaryIssue(["proposals", index, "groupReference"], "Opening entity proposals must use their declared group");
      }
    }
    if (proposal.target.entity === "test" && proposal.target.testReference) {
      const declared = proposedTests.get(proposal.target.testReference);
      if (declared && declared.groupReference !== proposal.groupReference) {
        boundaryIssue(["proposals", index, "groupReference"], "Opening entity proposals must use their declared group");
      }
    }
  });
}

function rawTargetIdentity(target: QuarantinableProposal["target"]): string {
  if (target.entity === "product") return `product:${target.productReference ?? "unresolved"}`;
  if (target.entity === "test") return `test:${target.testReference ?? "unresolved"}`;
  return target.entity;
}

function locateEvidence(text: string, quote: string): number | "not-found" | "ambiguous" {
  const start = text.indexOf(quote);
  if (start === -1) return "not-found";
  return text.indexOf(quote, start + 1) === -1 ? start : "ambiguous";
}

function quarantine(proposal: QuarantinableProposal | ModelProposal, reason: UnrepresentedProposalReason): UnrepresentedModelProposal {
  return { entity: proposal.target.entity, field: proposal.target.field, evidenceQuote: proposal.evidenceQuote, reason };
}

function proposalSchemaReason(error: z.ZodError): UnrepresentedProposalReason {
  if (error.issues.some(({ path }) => path[0] === "target")) return "unsupported-target";
  if (error.issues.some(({ path }) => path[0] === "value")) return "incompatible-value";
  return "unsupported-proposal";
}

function boundaryIssue(path: Array<string | number>, message: string): never {
  throw new z.ZodError([{ code: "custom", path, message, input: undefined }]);
}

function withEnvelopeChecks<T extends z.ZodType<{
  products: Array<{ productReference: string; groupReference: string }>;
  tests?: Array<{ testReference: string; groupReference: string }>;
  proposals: Array<{ proposalReference: string }>;
}>>(schema: T): T {
  return schema.superRefine((output, context) => {
    reportDuplicates(output.products.map(({ productReference }) => productReference), "productReference", ["products"], context);
    reportDuplicates(output.products.map(({ groupReference }) => groupReference), "product groupReference", ["products"], context);
    reportDuplicates((output.tests ?? []).map(({ testReference }) => testReference), "testReference", ["tests"], context);
    reportDuplicates((output.tests ?? []).map(({ groupReference }) => groupReference), "test groupReference", ["tests"], context);
    reportDuplicates(output.proposals.map(({ proposalReference }) => proposalReference), "proposalReference", ["proposals"], context);
  }) as T;
}

function reportDuplicates(
  values: string[], label: string, path: Array<string | number>, context: z.core.$RefinementCtx<unknown>,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) context.addIssue({ code: "custom", path: [...path, index], message: `Duplicate ${label} ${value}` });
    seen.add(value);
  });
}
