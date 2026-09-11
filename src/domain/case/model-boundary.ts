import { z } from "zod";
import type { CaseValue, FactTarget, GroundedProposal, ProposedProduct, ProposedRelevantTest, Source } from "./types";
import {
  knownValueMismatch,
  modelTargetValueContracts,
  type KnownValueContract,
} from "./value-contract";

const patientFields = ["identifier", "ageYears", "sex", "weight"] as const;
const eventFields = ["problemDescription", "symptoms", "onsetDate", "death", "deathDate", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious", "relevantTestsAvailable", "relevantHistory", "treatments", "outcome", "dischargeDate", "productAvailability", "productReturnDate"] as const;
const productFields = ["name", "productType", "role", "manufacturer", "lotNumber", "dose", "frequency", "route", "startDate", "stopDate", "indication", "stopped", "commonName", "procode", "modelNumber", "catalogNumber", "expirationDate", "serialNumber", "udi", "deviceOperator", "implanted", "implantDate", "explantDate", "reprocessedSingleUse", "reprocessor", "servicedByThirdParty"] as const;
const relevantTestFields = ["testResult", "lowRange", "highRange", "date"] as const;
const modelEntities = ["patient", "event", "product", "test"] as const;
type ModelEntity = typeof modelEntities[number];

const modelTargetSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("patient"), field: z.enum(patientFields) }).strict(),
  z.object({ entity: z.literal("event"), field: z.enum(eventFields) }).strict(),
  z.object({
    entity: z.literal("test"),
    testReference: z.string().min(1),
    field: z.enum(relevantTestFields),
  }).strict(),
  z.object({
    entity: z.literal("product"),
    productReference: z.string().min(1),
    field: z.enum(productFields),
  }).strict(),
]);

const caseValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.object({ value: z.number().positive(), unit: z.enum(["kg", "lb"]) }).strict()])
      .describe("Preserve explicitly stated descriptive detail; normalize only conventions defined by the model instructions."),
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
  tests: z.array(z.object({
    testReference: z.string().min(1),
    groupReference: z.string().min(1),
  }).strict()).optional(),
  proposals: z.array(z.object({
    proposalReference: z.string().min(1),
    groupReference: z.string().min(1),
    intent: z.enum(["fact", "correction", "alternative"]),
    target: modelTargetSchema,
    value: caseValueSchema,
    evidenceQuote: z.string().min(1).describe(
      "An exact contiguous quotation that independently identifies the subject and complete claim. Completeness outranks brevity, including wording needed for negation, correction, alternatives, or unresolved uncertainty.",
    ),
  }).strict()).min(1),
}).strict().superRefine((output, context) => {
  reportDuplicates(output.products.map(({ productReference }) => productReference), "productReference", ["products"], context);
  reportDuplicates(output.products.map(({ groupReference }) => groupReference), "product groupReference", ["products"], context);
  reportDuplicates((output.tests ?? []).map(({ testReference }) => testReference), "testReference", ["tests"], context);
  reportDuplicates((output.tests ?? []).map(({ groupReference }) => groupReference), "test groupReference", ["tests"], context);
  reportDuplicates(output.proposals.map(({ proposalReference }) => proposalReference), "proposalReference", ["proposals"], context);
  output.proposals.forEach((proposal, index) => {
    if (!proposal.evidenceQuote.trim()) {
      context.addIssue({ code: "custom", path: ["proposals", index, "evidenceQuote"], message: "Evidence quotation must not be blank" });
    }
    const mismatch = knownValueMismatch(modelFactTarget(proposal.target), proposal.value);
    if (mismatch) {
      context.addIssue({ code: "custom", path: ["proposals", index, "value"], message: mismatch });
    }
  });
});

export const providerModelProposalOutputSchema = createProviderModelProposalOutputSchema();

const inputSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["narrative", "answer", "correction"]),
  text: z.string().min(1),
  recordedAt: z.string().datetime(),
}).strict();

export type ModelProposalOutput = z.infer<typeof modelProposalOutputSchema>;
export type ModelBoundaryIdentityKind = "input" | "product" | "test" | "group" | "proposal" | "source";
export type ModelBoundaryIdentityFactory = (kind: ModelBoundaryIdentityKind, responseReference: string) => string;

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
}

export function parseModelProposalEnvelope(
  candidate: ParseModelProposalEnvelopeInput,
  createIdentity: ModelBoundaryIdentityFactory,
): ParsedModelProposalEnvelope {
  const input = inputSchema.parse(candidate.input);
  const output = modelProposalOutputSchema.parse(candidate.output);
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
    // Opening inputs cannot receive existing product IDs, and later inputs
    // cannot declare products, so product allocation cannot collide across turns.
    if (!id.trim() || allocated.has(id)) {
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
  const testByReference = new Map<string, { id: string; groupId: string; groupReference: string }>();
  for (const test of outputTests) {
    const groupId = allocate("group", test.groupReference);
    groupByReference.set(test.groupReference, groupId);
    testByReference.set(test.testReference, {
      id: allocate("test", test.testReference),
      groupId,
      groupReference: test.groupReference,
    });
  }

  const sourceByQuote = new Map<string, Source>();
  const proposals: GroundedProposal[] = [];
  const groupTarget = new Map<string, string>();
  output.proposals.forEach((proposal, index) => {
    const path = ["proposals", index] as Array<string | number>;
    const target = resolveTarget(candidate.turn, proposal.target, productByReference, existingProductIds, testByReference, existingTestIds, path);
    const targetIdentity = ["product", "test"].includes(target.entity) ? `${target.entity}:${target.entityId}` : target.entity;
    const priorTarget = groupTarget.get(proposal.groupReference);
    if (priorTarget && priorTarget !== targetIdentity) {
      boundaryIssue([...path, "groupReference"], "A proposal group cannot span different case entities");
    }
    groupTarget.set(proposal.groupReference, targetIdentity);

    let groupId: string;
    if (candidate.turn === "opening" && target.entity !== "product" && target.entity !== "test") {
      groupId = target.entity;
    } else if (candidate.turn === "opening") {
      const reference = proposal.target.entity === "product" ? proposal.target.productReference
        : proposal.target.entity === "test" ? proposal.target.testReference : "";
      const declared = proposal.target.entity === "product" ? productByReference.get(reference) : testByReference.get(reference);
      if (!declared || declared.groupReference !== proposal.groupReference) {
        boundaryIssue([...path, "groupReference"], "Opening entity proposals must use their declared group");
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
  for (const [reference] of testByReference) {
    if (!output.proposals.some(({ target }) => target.entity === "test" && target.testReference === reference)) {
      boundaryIssue(["tests"], `Declared relevant test ${reference} has no proposals`);
    }
  }

  return {
    products: [...productByReference.values()].map(({ id, groupId }) => ({ id, groupId })),
    relevantTests: [...testByReference.values()].map(({ id, groupId }) => ({ id, groupId })),
    sources: [...sourceByQuote.values()],
    proposals,
  };
}

function resolveTarget(
  turn: "opening" | "correction",
  target: ModelProposalOutput["proposals"][number]["target"],
  proposedProducts: Map<string, { id: string }>,
  existingProductIds: Set<string>,
  proposedTests: Map<string, { id: string }>,
  existingTestIds: Set<string>,
  path: Array<string | number>,
): FactTarget {
  if (target.entity === "patient") return { entity: "patient", entityId: "patient", field: target.field };
  if (target.entity === "event") return { entity: "event", entityId: "event", field: target.field };
  if (target.entity === "test") {
    if (turn === "opening") {
      const test = proposedTests.get(target.testReference);
      if (!test) boundaryIssue([...path, "target", "testReference"], `Unknown proposed test reference ${target.testReference}`);
      return { entity: "test", entityId: test.id, field: target.field };
    }
    if (!existingTestIds.has(target.testReference)) {
      boundaryIssue([...path, "target", "testReference"], `Unknown reviewed test ID ${target.testReference}`);
    }
    return { entity: "test", entityId: target.testReference, field: target.field };
  }
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

function modelFactTarget(target: ModelProposalOutput["proposals"][number]["target"]): FactTarget {
  if (target.entity === "patient") return { entity: "patient", entityId: "patient", field: target.field };
  if (target.entity === "event") return { entity: "event", entityId: "event", field: target.field };
  if (target.entity === "product") return { entity: "product", entityId: target.productReference, field: target.field };
  return { entity: "test", entityId: target.testReference, field: target.field };
}

type ProviderSchema = Record<string, unknown>;

interface ProviderProposalBucket {
  name: string;
  contract: KnownValueContract;
  fields: string[];
}

interface ProviderProposalMetadata {
  proposalReference: string;
  groupReference: string;
  intent: "fact" | "correction" | "alternative";
  evidenceQuote: string;
}

interface ProviderKnownProposalWire {
  metadata: ProviderProposalMetadata;
  field: string;
  productReference?: string;
  testReference?: string;
  value: unknown;
  qualifier?: unknown;
}

interface ProviderNonKnownProposalWire extends Omit<ProviderKnownProposalWire, "value" | "qualifier"> {
  kind: unknown;
}

function createProviderModelProposalOutputSchema(): ProviderSchema {
  const entitySchemas = Object.fromEntries(modelEntities.map((entity) => [providerEntityKey(entity), {
    type: "object",
    properties: {
      ...Object.fromEntries(providerProposalBuckets(entity).map(({ name, contract, fields }) => [name, {
        type: "array",
        description: `Known ${entity} ${providerBucketDescription(contract)} proposals; empty when unused.`,
        items: providerKnownProposalSchema(entity, fields, contract),
      }])),
      nonKnownProposals: {
        type: "array",
        description: `Non-known ${entity} proposals; empty when unused.`,
        items: providerNonKnownProposalSchema(entity, Object.keys(modelTargetValueContracts[entity])),
      },
    },
    required: [...providerProposalBuckets(entity).map(({ name }) => name), "nonKnownProposals"],
    additionalProperties: false,
  }]));

  return {
    type: "object",
    $defs: {
      nonEmptyString: nonEmptyStringGuidance(),
      intent: { type: "string", enum: ["fact", "correction", "alternative"] },
      evidenceQuote: {
        ...nonEmptyStringGuidance(),
        description: "An exact contiguous quotation that independently identifies the subject and complete claim. Completeness outranks brevity, including wording needed for negation, correction, alternatives, or unresolved uncertainty. Wilson validates presence and uniqueness locally.",
      },
      proposalMetadata: {
        type: "object",
        properties: {
          proposalReference: providerDefinitionReference("nonEmptyString"),
          groupReference: providerDefinitionReference("nonEmptyString"),
          intent: providerDefinitionReference("intent"),
          evidenceQuote: providerDefinitionReference("evidenceQuote"),
        },
        required: ["proposalReference", "groupReference", "intent", "evidenceQuote"],
        additionalProperties: false,
      },
    },
    properties: {
      products: { type: "array", items: declarationSchema("productReference") },
      tests: { type: "array", items: declarationSchema("testReference") },
      ...entitySchemas,
    },
    required: ["products", "tests", ...modelEntities.map(providerEntityKey)],
    additionalProperties: false,
  };
}

const providerMetadataDecoder = z.object({
  proposalReference: z.string(),
  groupReference: z.string(),
  intent: z.enum(["fact", "correction", "alternative"]),
  evidenceQuote: z.string(),
}).strict();

function providerWireItemDecoder(entity: ModelEntity, known: boolean): z.ZodObject {
  const reference = entity === "product" ? { productReference: z.string() }
    : entity === "test" ? { testReference: z.string() } : {};
  return known
    ? z.object({ metadata: providerMetadataDecoder, field: z.string(), ...reference, value: z.unknown(), qualifier: z.unknown().optional() }).strict()
    : z.object({ metadata: providerMetadataDecoder, field: z.string(), ...reference, kind: z.unknown() }).strict();
}

const providerWireOutputSchema = z.object({
  products: z.array(z.unknown()),
  tests: z.array(z.unknown()),
  ...Object.fromEntries(modelEntities.map((entity) => [providerEntityKey(entity), z.object({
    ...Object.fromEntries(providerProposalBuckets(entity).map(({ name }) => [name, z.array(providerWireItemDecoder(entity, true))])),
    nonKnownProposals: z.array(providerWireItemDecoder(entity, false)),
  }).strict()])),
}).strict();

export function decodeProviderModelProposalOutput(output: unknown): ModelProposalOutput {
  const decoded = providerWireOutputSchema.parse(output) as Record<string, unknown>;
  const proposals: unknown[] = [];
  for (const entity of modelEntities) {
    const entityOutput = decoded[providerEntityKey(entity)] as Record<string, unknown[]>;
    for (const { name } of providerProposalBuckets(entity)) {
      proposals.push(...entityOutput[name].map((item) => decodeProviderProposal(entity, item as ProviderKnownProposalWire, true)));
    }
    proposals.push(...entityOutput.nonKnownProposals.map((item) => (
      decodeProviderProposal(entity, item as ProviderNonKnownProposalWire, false)
    )));
  }
  return modelProposalOutputSchema.parse({ products: decoded.products, tests: decoded.tests, proposals });
}

export function encodeProviderModelProposalOutput(output: ModelProposalOutput): Record<string, unknown> {
  const entityOutputs = Object.fromEntries(modelEntities.map((entity) => [providerEntityKey(entity), {
    ...Object.fromEntries(providerProposalBuckets(entity).map(({ name }) => [name, [] as unknown[]])),
    nonKnownProposals: [] as unknown[],
  }])) as Record<string, Record<string, unknown[]>>;

  for (const proposal of output.proposals) {
    const entityOutput = entityOutputs[providerEntityKey(proposal.target.entity)];
    const item = encodeProviderProposal(proposal);
    if (proposal.value.kind === "known") {
      const contracts = modelTargetValueContracts[proposal.target.entity] as Record<string, KnownValueContract>;
      entityOutput[providerBucketName(contracts[proposal.target.field])].push(item);
    } else {
      entityOutput.nonKnownProposals.push(item);
    }
  }
  return { products: output.products, tests: output.tests ?? [], ...entityOutputs };
}

function decodeProviderProposal(
  entity: ModelEntity,
  item: ProviderKnownProposalWire | ProviderNonKnownProposalWire,
  known: boolean,
): unknown {
  const target = {
    entity,
    ...(entity === "product" ? { productReference: item.productReference } : {}),
    ...(entity === "test" ? { testReference: item.testReference } : {}),
    field: item.field,
  };
  const knownItem = item as ProviderKnownProposalWire;
  const value = known
    ? { kind: "known", value: knownItem.value,
      ...(knownItem.qualifier === undefined ? {} : { qualifier: knownItem.qualifier }) }
    : { kind: (item as ProviderNonKnownProposalWire).kind };
  return { ...item.metadata, target, value };
}

function encodeProviderProposal(proposal: ModelProposalOutput["proposals"][number]): ProviderKnownProposalWire | ProviderNonKnownProposalWire {
  const metadata = {
    proposalReference: proposal.proposalReference,
    groupReference: proposal.groupReference,
    intent: proposal.intent,
    evidenceQuote: proposal.evidenceQuote,
  };
  const common = {
    metadata,
    field: proposal.target.field,
    ...(proposal.target.entity === "product" ? { productReference: proposal.target.productReference } : {}),
    ...(proposal.target.entity === "test" ? { testReference: proposal.target.testReference } : {}),
  };
  if (proposal.value.kind !== "known") return { ...common, kind: proposal.value.kind };
  return {
    ...common,
    value: proposal.value.value,
    ...(proposal.value.qualifier === undefined ? {} : { qualifier: proposal.value.qualifier }),
  };
}

function providerProposalBuckets(entity: ModelEntity): ProviderProposalBucket[] {
  const groups = new Map<string, ProviderProposalBucket>();
  for (const [field, contract] of Object.entries(modelTargetValueContracts[entity]) as Array<[string, KnownValueContract]>) {
    const name = providerBucketName(contract);
    const group = groups.get(name) ?? { name, contract, fields: [] };
    group.fields.push(field);
    groups.set(name, group);
  }
  return [...groups.values()];
}

function providerEntityKey(entity: ModelEntity): string {
  return `${entity}Proposals`;
}

function providerBucketName(contract: KnownValueContract): string {
  switch (contract.shape) {
    case "string": return "stringProposals";
    case "iso-date": return "dateProposals";
    case "integer": return "ageProposals";
    case "boolean": return "booleanProposals";
    case "string-array": return "stringArrayProposals";
    case "measurement": return "measurementProposals";
    case "enum-array": return "enumArrayProposals";
    case "enum": {
      const values = contract.values.join("|");
      if (values === "female|male|intersex") return "sexProposals";
      if (values === "available|not-available|returned-to-manufacturer") return "productAvailabilityProposals";
      if (values === "drug-or-biologic|device|other") return "productTypeProposals";
      if (values === "suspect|concomitant") return "productRoleProposals";
      if (values === "health-professional|patient-consumer|other") return "deviceOperatorProposals";
      if (values === "yes|no|unknown") return "serviceStatusProposals";
      throw new Error(`Unsupported provider enum contract: ${values}`);
    }
  }
}

function providerBucketDescription(contract: KnownValueContract): string {
  if (contract.shape === "enum") return `${providerBucketName(contract).replace(/Proposals$/, "")} enum`;
  return contract.shape;
}

function providerKnownProposalSchema(entity: ModelEntity, fields: string[], contract: KnownValueContract): ProviderSchema {
  const valueSchema = providerValueSchema(contract);
  const valueDescription = [
    valueSchema.description,
    "Preserve explicit detail; normalize only as instructed.",
  ].filter(Boolean).join(" ");
  const reference = entity === "product" ? "productReference" : entity === "test" ? "testReference" : undefined;
  return {
    type: "object",
    properties: {
      metadata: providerDefinitionReference("proposalMetadata"),
      ...(reference ? { [reference]: providerDefinitionReference("nonEmptyString") } : {}),
      field: { type: "string", enum: fields },
      value: { ...valueSchema, description: valueDescription },
      qualifier: providerDefinitionReference("nonEmptyString"),
    },
    required: ["metadata", ...(reference ? [reference] : []), "field", "value"],
    additionalProperties: false,
  };
}

function providerNonKnownProposalSchema(entity: ModelEntity, fields: string[]): ProviderSchema {
  const reference = entity === "product" ? "productReference" : entity === "test" ? "testReference" : undefined;
  return {
    type: "object",
    properties: {
      metadata: providerDefinitionReference("proposalMetadata"),
      ...(reference ? { [reference]: providerDefinitionReference("nonEmptyString") } : {}),
      field: { type: "string", enum: fields },
      kind: { type: "string", enum: ["unknown", "explicitly-absent", "inapplicable", "declined"] },
    },
    required: ["metadata", ...(reference ? [reference] : []), "field", "kind"],
    additionalProperties: false,
  };
}

function providerValueSchema(contract: KnownValueContract): ProviderSchema {
  switch (contract.shape) {
    case "string": return { type: "string" };
    case "iso-date": return { type: "string", format: "date" };
    case "integer": return {
      type: "integer",
      description: `Must be between ${contract.minimum} and ${contract.maximum}, inclusive; Wilson validates the bounds locally.`,
    };
    case "boolean": return { type: "boolean" };
    case "string-array": return { type: "array", items: { type: "string" } };
    case "measurement": return {
      type: "object",
      properties: {
        value: { type: "number", description: "Must be positive; Wilson validates this locally." },
        unit: { type: "string", enum: [...contract.units] },
      },
      required: ["value", "unit"],
      additionalProperties: false,
    };
    case "enum": return { type: "string", enum: [...contract.values] };
    case "enum-array": return { type: "array", items: { type: "string", enum: [...contract.values] } };
  }
}

function declarationSchema(reference: "productReference" | "testReference"): ProviderSchema {
  return {
    type: "object",
    properties: {
      [reference]: providerDefinitionReference("nonEmptyString"),
      groupReference: providerDefinitionReference("nonEmptyString"),
    },
    required: [reference, "groupReference"],
    additionalProperties: false,
  };
}

function nonEmptyStringGuidance(): ProviderSchema {
  return { type: "string", description: "Must be non-empty; Wilson validates this locally." };
}

function providerDefinitionReference(name: string): ProviderSchema {
  return { $ref: `#/$defs/${name}` };
}
