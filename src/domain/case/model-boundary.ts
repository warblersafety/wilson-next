import { z } from "zod";
import type { FactTarget, GroundedProposal, ProposedProduct, ProposedRelevantTest, Source } from "./types";
import { knownValueMismatch, modelKnownValueGuidance } from "./value-contract";
import { resolveSourceReferences, type SourcePassage } from "./source-passages";
import { maximumCaseProducts, maximumRelevantTests } from "./limits";

const patientFields = ["identifier", "ageYears", "sex", "weight"] as const;
const eventFields = ["problemDescription", "symptoms", "onsetDate", "death", "deathDate", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious", "relevantTestsAvailable", "relevantHistory", "treatments", "outcome", "dischargeDate", "productAvailability", "productReturnDate"] as const;
const productFields = ["name", "productType", "role", "manufacturer", "lotNumber", "dose", "strength", "frequency", "route", "startDate", "stopDate", "indication", "stopped", "medicationType", "doseReduced", "improvedAfterChange", "restarted", "recurred", "commonName", "procode", "modelNumber", "catalogNumber", "expirationDate", "serialNumber", "udi", "deviceOperator", "implanted", "implantDate", "explantDate", "reprocessedSingleUse", "reprocessor", "servicedByThirdParty"] as const;
const relevantTestFields = ["testName", "testResult", "lowRange", "highRange", "date"] as const;

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
  evidenceReferences: z.array(z.string().min(1)).min(1).describe(
    "Select code-supplied passage references from the current input. Include every passage needed for subject, shared dates, negation, correction, alternatives and uncertainty. Never return copied quotations or invent references.",
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
  evidenceReferences: z.unknown().optional(),
}).passthrough().superRefine((proposal, context) => {
  if (!Object.hasOwn(proposal, "value")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Proposal value is required" });
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
  | "test-limit"
  | "invalid-source-reference"
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
  existingTestCount?: number;
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
  evidence: SourcePassage[];
}

export function parseModelProposalEnvelope(
  candidate: ParseModelProposalEnvelopeInput,
  createIdentity: ModelBoundaryIdentityFactory,
): ParsedModelProposalEnvelope {
  const input = inputSchema.parse(candidate.input);
  const output = modelProposalEnvelopeSchema.parse(candidate.output);
  const existingProductIds = new Set(candidate.existingProductIds ?? []);
  const existingTestIds = new Set(candidate.existingTestIds ?? []);
  // An exact supplied ID still identifies the existing observation, even if
  // echoed in the declaration list. Only response-local references create tests.
  const outputTests = (output.tests ?? []).filter(({ testReference }) => !existingTestIds.has(testReference));
  if (candidate.turn === "opening" && (existingProductIds.size > 0 || existingTestIds.size > 0)) {
    boundaryIssue(["existingProductIds"], "Opening input cannot reference existing entities");
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
  for (const product of (candidate.turn === "opening" ? output.products.slice(0, maximumCaseProducts) : [])) {
    const groupId = allocate("group", product.groupReference);
    groupByReference.set(product.groupReference, groupId);
    productByReference.set(product.productReference, {
      id: allocate("product", product.productReference), groupId, groupReference: product.groupReference,
    });
  }
  const testByReference = new Map<string, DeclaredEntity>();
  const excessTestReferences = new Set(outputTests.slice(Math.max(0, maximumRelevantTests - (candidate.existingTestCount ?? existingTestIds.size))).map(({ testReference }) => testReference));
  for (const test of outputTests.filter(({ testReference }) => !excessTestReferences.has(testReference))) {
    const groupId = allocate("group", test.groupReference);
    groupByReference.set(test.groupReference, groupId);
    testByReference.set(test.testReference, {
      id: allocate("test", test.testReference), groupId, groupReference: test.groupReference,
    });
  }

  assertResponseLevelProposalConsistency(output.proposals, declaredProductByReference, testByReference);

  const unrepresented: UnrepresentedModelProposal[] = [];
  const prepared: PreparedProposal[] = [];
  const quarantineProposal = (proposal: QuarantinableProposal | ModelProposal, reason: UnrepresentedProposalReason) => quarantine(proposal, reason, input.text);
  for (const [index, rawProposal] of output.proposals.entries()) {
    const parsed = modelProposalSchema.safeParse(rawProposal);
    if (!parsed.success) {
      unrepresented.push(quarantineProposal(rawProposal, proposalSchemaReason(parsed.error)));
      continue;
    }
    const proposal = parsed.data;
    if (proposal.target.entity === "product" && excessProductReferences.has(proposal.target.productReference)) {
      unrepresented.push(quarantineProposal(rawProposal, "product-limit"));
      continue;
    }
    if (proposal.target.entity === "test" && excessTestReferences.has(proposal.target.testReference)) {
      unrepresented.push(quarantineProposal(rawProposal, "test-limit"));
      continue;
    }
    const target = resolveTarget(
      candidate.turn, proposal.target, productByReference, existingProductIds, testByReference, existingTestIds,
    );
    if (!target) {
      unrepresented.push(quarantineProposal(rawProposal, "unresolved-entity"));
      continue;
    }
    const groupId = resolveGroupId(
      candidate.turn, proposal, target, productByReference, testByReference,
      groupByReference, allocate, ["proposals", index],
    );
    if (knownValueMismatch(target, proposal.value)) {
      unrepresented.push(quarantineProposal(rawProposal, "incompatible-value"));
      continue;
    }
    const evidence = resolveSourceReferences(input.text, proposal.evidenceReferences);
    if (!evidence) {
      unrepresented.push(quarantineProposal(rawProposal, "invalid-source-reference"));
      continue;
    }
    prepared.push({ proposal, target, groupId, evidence });
  }

  if (prepared.length === 0) boundaryIssue(["proposals"], "Every proposal was unrepresentable");

  const sourceByReference = new Map<string, Source>();
  const proposals: GroundedProposal[] = prepared.map(({ proposal, target, groupId, evidence }) => {
    const sources = evidence.map((passage) => {
      const source = sourceByReference.get(passage.reference) ?? {
        id: allocate("source", `${input.id}-${passage.reference}`),
        inputId: input.id,
        inputType: input.type,
        excerpt: input.text.slice(passage.start, passage.end),
        start: passage.start,
        end: passage.end,
        actor: "clinician" as const,
        recordedAt: input.recordedAt,
      };
      sourceByReference.set(passage.reference, source);
      return source;
    });
    return {
      proposalId: allocate("proposal", proposal.proposalReference), groupId, intent: proposal.intent,
      target, value: proposal.value, sourceIds: sources.map(({ id }) => id),
    };
  });

  const retainedProductIds = new Set(proposals.filter(({ target }) => target.entity === "product").map(({ target }) => target.entityId));
  const retainedTestIds = new Set(proposals.filter(({ target }) => target.entity === "test").map(({ target }) => target.entityId));

  return {
    products: [...productByReference.values()].filter(({ id }) => retainedProductIds.has(id)).map(({ id, groupId }) => ({ id, groupId })),
    relevantTests: [...testByReference.values()].filter(({ id }) => retainedTestIds.has(id)).map(({ id, groupId }) => ({ id, groupId })),
    sources: [...sourceByReference.values()],
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
    const test = proposedTests.get(target.testReference);
    if (test) return { entity: "test", entityId: test.id, field: target.field };
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
  if (proposal.target.entity === "test" && proposedTests.has(proposal.target.testReference)) return proposedTests.get(proposal.target.testReference)!.groupId;
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

function quarantine(proposal: QuarantinableProposal | ModelProposal, reason: UnrepresentedProposalReason, text: string): UnrepresentedModelProposal {
  const references = proposal.evidenceReferences;
  const passages = Array.isArray(references) && references.every((reference) => typeof reference === "string")
    ? resolveSourceReferences(text, references) : undefined;
  return { entity: proposal.target.entity, field: proposal.target.field,
    evidenceQuote: passages?.map(({ text }) => text).join("\n") ?? "Supporting text could not be identified. Restate the missing information below.", reason };
}

function proposalSchemaReason(error: z.ZodError): UnrepresentedProposalReason {
  if (error.issues.some(({ path }) => path[0] === "target")) return "unsupported-target";
  if (error.issues.some(({ path }) => path[0] === "value")) return "incompatible-value";
  if (error.issues.some(({ path }) => path[0] === "evidenceReferences")) return "invalid-source-reference";
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
