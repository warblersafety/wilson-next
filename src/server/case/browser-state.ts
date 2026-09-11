import { z } from "zod";
import type { SemanticCase } from "../../domain/case/types";
import {
  maximumAskedNeeds,
  maximumCaseProducts,
  maximumRelevantTests,
} from "../../domain/case/limits";
import type { JourneySnapshot, JourneyStage } from "../journey/service";
import { InMemoryCaseRepository, validateRestoredCase } from "./repository";

export const browserStateVersion = "wilson-browser-state-v6";

export interface BrowserJourneyState {
  version: typeof browserStateVersion;
  stage: JourneyStage;
  case: SemanticCase;
  unrepresented: JourneySnapshot["unrepresented"];
}

export interface JourneyResponse {
  state: BrowserJourneyState;
  snapshot: JourneySnapshot;
}

export class BrowserStateError extends Error {
  constructor(
    message: string,
    readonly code: "incompatible-browser-state" | "malformed-browser-state" | "stale-browser-state",
  ) {
    super(message);
    this.name = "BrowserStateError";
  }
}

const nonKnownValueSchema = z.union([
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("explicitly-absent") }).strict(),
  z.object({ kind: z.literal("inapplicable") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

function caseValueSchema<T extends z.ZodType>(value: T) {
  return z.union([
    z.object({ kind: z.literal("known"), value, qualifier: z.string().optional() }).strict(),
    nonKnownValueSchema,
  ]);
}

function factSchema<T extends z.ZodType>(value: T) {
  const grounded = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    intent: z.enum(["fact", "correction", "alternative"]),
    value: caseValueSchema(value),
    sourceIds: z.array(z.string().min(1)).min(1),
  }).strict();
  return z.object({
    state: z.enum(["empty", "proposed", "resolved", "conflicted"]),
    proposedValues: z.array(grounded),
    resolvedValue: grounded.optional(),
    conflictingValues: z.array(grounded),
    sourceIds: z.array(z.string().min(1)),
    supersededValues: z.array(grounded),
  }).strict();
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const patientFactsSchema = z.object({
  identifier: factSchema(z.string()),
  ageYears: factSchema(z.number().int().min(0).max(150)),
  sex: factSchema(z.enum(["female", "male", "intersex"])),
  weight: factSchema(z.object({ value: z.number().positive(), unit: z.enum(["kg", "lb"]) }).strict()),
}).strict();
const eventFactsSchema = z.object({
  reportType: factSchema(z.enum(["adverse-event", "product-problem", "adverse-event-and-product-problem"])),
  problemDescription: factSchema(z.string()),
  symptoms: factSchema(z.array(z.string())),
  onsetDate: factSchema(isoDateSchema),
  death: factSchema(z.boolean()),
  deathDate: factSchema(isoDateSchema),
  lifeThreatening: factSchema(z.boolean()),
  hospitalized: factSchema(z.boolean()),
  disability: factSchema(z.boolean()),
  requiredIntervention: factSchema(z.boolean()),
  congenitalAnomaly: factSchema(z.boolean()),
  otherSerious: factSchema(z.boolean()),
  relevantTestsAvailable: factSchema(z.boolean()),
  relevantHistory: factSchema(z.string()),
  treatments: factSchema(z.array(z.string())),
  outcome: factSchema(z.string()),
  dischargeDate: factSchema(isoDateSchema),
  productAvailability: factSchema(z.enum(["available", "not-available", "returned-to-manufacturer"])),
  productReturnDate: factSchema(isoDateSchema),
}).strict();
const relevantTestFactsSchema = z.object({
  testResult: factSchema(z.string()),
  lowRange: factSchema(z.string()),
  highRange: factSchema(z.string()),
  date: factSchema(isoDateSchema),
}).strict();
const reporterFactsSchema = z.object({
  lastName: factSchema(z.string()), firstName: factSchema(z.string()), address: factSchema(z.string()),
  city: factSchema(z.string()), state: factSchema(z.string()), postalCode: factSchema(z.string()),
  country: factSchema(z.string()), phone: factSchema(z.string()), email: factSchema(z.string()),
  healthProfessional: factSchema(z.boolean()), occupation: factSchema(z.string()),
  reportedTo: factSchema(z.array(z.enum(["manufacturer", "user-facility", "distributor-importer", "packer"]))),
  doNotDiscloseIdentity: factSchema(z.boolean()),
}).strict();
const productFactsSchema = z.object({
  name: factSchema(z.string()),
  productType: factSchema(z.enum(["drug-or-biologic", "device", "other"])),
  role: factSchema(z.enum(["suspect", "concomitant"])),
  manufacturer: factSchema(z.string()),
  lotNumber: factSchema(z.string()),
  dose: factSchema(z.string()),
  frequency: factSchema(z.string()),
  route: factSchema(z.string()),
  startDate: factSchema(isoDateSchema),
  stopDate: factSchema(isoDateSchema),
  indication: factSchema(z.string()),
  stopped: factSchema(z.boolean()),
  commonName: factSchema(z.string()),
  procode: factSchema(z.string()),
  modelNumber: factSchema(z.string()),
  catalogNumber: factSchema(z.string()),
  expirationDate: factSchema(isoDateSchema),
  serialNumber: factSchema(z.string()),
  udi: factSchema(z.string()),
  deviceOperator: factSchema(z.enum(["health-professional", "patient-consumer", "other"])),
  implanted: factSchema(z.boolean()),
  implantDate: factSchema(isoDateSchema),
  explantDate: factSchema(isoDateSchema),
  reprocessedSingleUse: factSchema(z.boolean()),
  reprocessor: factSchema(z.string()),
  servicedByThirdParty: factSchema(z.enum(["yes", "no", "unknown"])),
}).strict();

const sourceSchema = z.object({
  id: z.string().min(1),
  inputId: z.string().min(1),
  inputType: z.enum(["narrative", "selection", "answer", "correction", "resolution", "reporter-entry"]),
  excerpt: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  actor: z.literal("clinician"),
  recordedAt: z.string().datetime(),
}).strict();

const caseSchema = z.object({
  id: z.string().regex(/^case-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  revision: z.number().int().nonnegative(),
  patient: z.object({
    id: z.literal("patient"),
    state: z.enum(["proposed", "resolved", "rejected"]),
    facts: patientFactsSchema,
  }).strict(),
  event: z.object({
    id: z.literal("event"),
    state: z.enum(["proposed", "resolved", "rejected"]),
    facts: eventFactsSchema,
  }).strict(),
  products: z.array(z.object({
    id: z.string().min(1),
    proposalGroupId: z.string().min(1),
    state: z.enum(["proposed", "resolved", "rejected"]),
    facts: productFactsSchema,
  }).strict()).max(maximumCaseProducts),
  relevantTests: z.array(z.object({
    id: z.string().min(1),
    proposalGroupId: z.string().min(1),
    state: z.enum(["proposed", "resolved", "rejected"]),
    facts: relevantTestFactsSchema,
  }).strict()).max(maximumRelevantTests),
  reporter: z.object({ id: z.literal("reporter"), facts: reporterFactsSchema }).strict(),
  askedNeeds: z.array(z.object({
    key: z.enum(["suspect-product-indications", "serious-outcomes", "death-date", "relevant-clinical-context", "device-details", "reporter-details"]),
    targetIds: z.array(z.string().min(1)),
    status: z.enum(["open", "answered", "declined"]),
  }).strict()).max(maximumAskedNeeds),
  sources: z.array(sourceSchema),
  changes: z.array(z.object({
    commandId: z.string().min(1),
    type: z.enum([
      "attach-grounded-proposals",
      "review-proposal-groups",
      "record-clinician-facts",
      "record-asked-need",
      "resolve-conflict",
    ]),
    affectedTargets: z.array(z.string()),
    sourceIds: z.array(z.string()),
    priorRevision: z.number().int().nonnegative(),
    resultingRevision: z.number().int().positive(),
    supersessions: z.array(z.string()),
    resolutions: z.array(z.string()),
  }).strict()),
}).strict();

const stateSchema = z.object({
  version: z.string(),
  stage: z.enum([
    "describe",
    "understanding",
    "clarify",
    "review-update",
    "output",
  ]),
  case: z.unknown(),
  unrepresented: z.array(z.object({
    entity: z.string().min(1),
    field: z.string().min(1),
    evidenceQuote: z.string().min(1),
    reason: z.enum([
      "unsupported-proposal",
      "unsupported-target",
      "product-limit",
      "incompatible-value",
      "unresolved-entity",
      "evidence-not-found",
      "evidence-ambiguous",
      "incomplete-relevant-test",
    ]),
  }).strict()),
}).strict();

export function parseBrowserJourneyState(input: unknown): BrowserJourneyState {
  const version = z.object({ version: z.string() }).passthrough().safeParse(input);
  if (!version.success) {
    throw new BrowserStateError("The saved synthetic preview state is malformed", "malformed-browser-state");
  }
  if (version.data.version !== browserStateVersion) {
    throw new BrowserStateError("The saved synthetic preview state is incompatible", "incompatible-browser-state");
  }
  const envelope = stateSchema.safeParse(input);
  if (!envelope.success) {
    throw new BrowserStateError("The saved synthetic preview state is malformed", "malformed-browser-state");
  }
  const parsedCase = caseSchema.safeParse(envelope.data.case);
  if (!parsedCase.success) {
    throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
  }
  const caseState = parsedCase.data as SemanticCase;
  try {
    validateRestoredCase(caseState);
  } catch {
    throw new BrowserStateError("The saved synthetic preview case failed validation", "malformed-browser-state");
  }
  return {
    version: browserStateVersion,
    stage: envelope.data.stage,
    case: caseState,
    unrepresented: envelope.data.unrepresented,
  };
}

export function repositoryForBrowserState(state: BrowserJourneyState): InMemoryCaseRepository {
  return new InMemoryCaseRepository({ initialCase: state.case, maxCases: 1 });
}

export function assertExpectedBrowserRevision(state: BrowserJourneyState, expectedRevision: number): void {
  if (expectedRevision !== state.case.revision) {
    throw new BrowserStateError("The saved synthetic preview revision is stale", "stale-browser-state");
  }
}

export async function journeyResponse(
  repository: InMemoryCaseRepository,
  snapshot: JourneySnapshot,
): Promise<JourneyResponse> {
  const caseState = await repository.loadByOnlyCase();
  if (!caseState) throw new Error("The request-local case is unavailable");
  return {
    state: {
      version: browserStateVersion,
      stage: snapshot.stage,
      case: caseState,
      unrepresented: snapshot.unrepresented,
    },
    snapshot,
  };
}

export function assertStoredStage(state: BrowserJourneyState, snapshot: JourneySnapshot): void {
  if (state.stage !== snapshot.stage || state.case.revision !== snapshot.revision) {
    throw new BrowserStateError("The saved synthetic preview stage is stale", "stale-browser-state");
  }
}
