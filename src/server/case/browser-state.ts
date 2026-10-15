import { isRaceEthnicitySelections, raceEthnicityValues } from "../../domain/case/race-ethnicity";
import { isCompleteBirthDate } from "../../domain/case/birth-date";
import { z } from "zod";
import type { Fact, SemanticCase } from "../../domain/case/types";
import {
  maximumAskedNeeds,
  maximumCaseProducts,
  maximumRelevantTests,
} from "../../domain/case/limits";
import type { JourneySnapshot, JourneyStage } from "../journey/service";
import { InMemoryCaseRepository, validateRestoredCase } from "./repository";

export const browserStateVersion = "wilson-browser-state-v15";

export interface BrowserJourneyState {
  version: typeof browserStateVersion;
  stage: JourneyStage;
  case: SemanticCase;
  unrepresented: JourneySnapshot["unrepresented"];
}

export interface JourneyResponse {
  state: BrowserJourneyState;
  snapshot: JourneySnapshot;
  provenance: ReturnType<typeof journeyProvenance>;
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
  ageYears: factSchema(z.union([z.number().int().min(0).max(150), z.object({ value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), unit: z.enum(["months", "weeks", "days"]) }).strict()])),
  raceEthnicity: factSchema(z.array(z.enum(raceEthnicityValues)).refine(isRaceEthnicitySelections)),
  dateOfBirth: factSchema(z.string().refine(isCompleteBirthDate)),
  a2Value: factSchema(z.enum(["age", "date-of-birth"])),
  sex: factSchema(z.enum(["female", "male", "intersex"])),
  weight: factSchema(z.object({ value: z.number().positive(), unit: z.enum(["kg", "lb"]) }).strict()),
}).strict();
const eventFactsSchema = z.object({
  reportType: factSchema(z.enum(["adverse-event", "product-problem", "adverse-event-and-product-problem"])),
  reportDate: factSchema(z.iso.date()),
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
  testName: factSchema(z.string()),
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
  ndcOrUniqueId: factSchema(z.string()),
  dose: factSchema(z.string()),
  strength: factSchema(z.string()),
  frequency: factSchema(z.string()),
  route: factSchema(z.string()),
  startDate: factSchema(isoDateSchema),
  stopDate: factSchema(isoDateSchema),
  indication: factSchema(z.string()),
  stopped: factSchema(z.boolean()),
  medicationType: factSchema(z.array(z.enum(["brand", "generic-biosimilar", "otc", "compounded"]))),
  doseReduced: factSchema(z.boolean()),
  improvedAfterChange: factSchema(z.boolean()),
  restarted: factSchema(z.boolean()),
  recurred: factSchema(z.boolean()),
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
    state: z.enum(["proposed", "resolved", "rejected", "withdrawn"]),
    facts: patientFactsSchema,
  }).strict(),
  event: z.object({
    id: z.literal("event"),
    state: z.enum(["proposed", "resolved", "rejected", "withdrawn"]),
    facts: eventFactsSchema,
  }).strict(),
  products: z.array(z.object({
    id: z.string().min(1),
    proposalGroupId: z.string().min(1),
    state: z.enum(["proposed", "resolved", "rejected", "withdrawn"]),
    facts: productFactsSchema,
  }).strict()).max(maximumCaseProducts),
  relevantTests: z.array(z.object({
    id: z.string().min(1),
    proposalGroupId: z.string().min(1),
    state: z.enum(["proposed", "resolved", "rejected", "withdrawn"]),
    facts: relevantTestFactsSchema,
  }).strict()).max(maximumRelevantTests),
  reporter: z.object({ id: z.literal("reporter"), facts: reporterFactsSchema }).strict(),
  askedNeeds: z.array(z.object({
    key: z.enum(["suspect-product-indications", "serious-outcomes", "death-date", "relevant-clinical-context", "device-details", "reporter-details", "medication-history"]),
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
      "withdraw-case-entity",
    ]),
    affectedTargets: z.array(z.string()),
    sourceIds: z.array(z.string()),
    priorRevision: z.number().int().nonnegative(),
    resultingRevision: z.number().int().positive(),
    supersessions: z.array(z.string()),
    resolutions: z.array(z.string()),
  }).strict()),
}).strict();

const preRacePatientFactsSchema = patientFactsSchema.omit({ raceEthnicity: true });
const v14CaseSchema = caseSchema.extend({ patient: caseSchema.shape.patient.extend({ facts: preRacePatientFactsSchema }) });
const preDobPatientFactsSchema = preRacePatientFactsSchema.omit({ dateOfBirth: true, a2Value: true });
const v13CaseSchema = caseSchema.extend({ patient: caseSchema.shape.patient.extend({ facts: preDobPatientFactsSchema }) });
const v12PatientSchema = caseSchema.shape.patient.extend({
  facts: preDobPatientFactsSchema.extend({
    ageYears: factSchema(z.union([
      z.number().int().min(0).max(150),
      z.object({ value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), unit: z.enum(["months", "days"]) }).strict(),
    ])),
  }),
});
const v12CaseSchema = caseSchema.extend({ patient: v12PatientSchema });
const legacyPatientSchema = caseSchema.shape.patient.extend({ facts: preDobPatientFactsSchema.extend({ ageYears: factSchema(z.number().int().min(0).max(150)) }) });
const v11CaseSchema = caseSchema.extend({ patient: legacyPatientSchema });
const v10ProductFactsSchema = productFactsSchema.omit({ ndcOrUniqueId: true });
const v10CaseSchema = v11CaseSchema.extend({
  products: z.array(caseSchema.shape.products.element.extend({ facts: v10ProductFactsSchema })).max(maximumCaseProducts),
});
const v9ProductFactsSchema = v10ProductFactsSchema.omit({ medicationType: true, doseReduced: true, improvedAfterChange: true, restarted: true, recurred: true });
const v9CaseSchema = v11CaseSchema.extend({
  products: z.array(caseSchema.shape.products.element.extend({ facts: v9ProductFactsSchema })).max(maximumCaseProducts),
});
const v8CaseSchema = v9CaseSchema.extend({
  relevantTests: z.array(caseSchema.shape.relevantTests.element.extend({ facts: relevantTestFactsSchema.omit({ testName: true }) })).max(maximumRelevantTests),
});
const legacyCaseSchema = v8CaseSchema.extend({
  event: caseSchema.shape.event.extend({ facts: eventFactsSchema.omit({ reportDate: true }) }),
  products: z.array(caseSchema.shape.products.element.extend({ facts: v9ProductFactsSchema.omit({ strength: true }) })).max(maximumCaseProducts),
});

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
      "test-limit",
      "invalid-source-reference",
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
  if (![browserStateVersion, "wilson-browser-state-v14", "wilson-browser-state-v13", "wilson-browser-state-v12", "wilson-browser-state-v11", "wilson-browser-state-v10", "wilson-browser-state-v9", "wilson-browser-state-v8", "wilson-browser-state-v7"].includes(version.data.version)) {
    throw new BrowserStateError("The saved synthetic preview state is incompatible", "incompatible-browser-state");
  }
  const envelope = stateSchema.safeParse(input);
  if (!envelope.success) {
    throw new BrowserStateError("The saved synthetic preview state is malformed", "malformed-browser-state");
  }
  let candidate = envelope.data.case;
  if (version.data.version === "wilson-browser-state-v7") {
    const legacy = legacyCaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = {
      ...legacy.data,
      event: { ...legacy.data.event, facts: { ...legacy.data.event.facts, reportDate: emptyAddedFact() } },
      products: legacy.data.products.map((product) => ({ ...product, facts: { ...product.facts, strength: emptyAddedFact() } })),
    };
  }
  if (["wilson-browser-state-v7", "wilson-browser-state-v8"].includes(version.data.version)) {
    const legacy = v8CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    // Preserve legacy combined text verbatim; splitting it would guess clinical identity.
    candidate = { ...legacy.data, relevantTests: legacy.data.relevantTests.map((test) => ({
      ...test, facts: { ...test.facts, testName: emptyAddedFact() },
    })) };
  }
  if (["wilson-browser-state-v7", "wilson-browser-state-v8", "wilson-browser-state-v9"].includes(version.data.version)) {
    const legacy = v9CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, products: legacy.data.products.map((product) => ({
      ...product, facts: { ...product.facts, medicationType: emptyAddedFact(), doseReduced: emptyAddedFact(), improvedAfterChange: emptyAddedFact(), restarted: emptyAddedFact(), recurred: emptyAddedFact() },
    })) };
  }
  if (["wilson-browser-state-v7", "wilson-browser-state-v8", "wilson-browser-state-v9", "wilson-browser-state-v10"].includes(version.data.version)) {
    const legacy = v10CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, products: legacy.data.products.map((product) => ({
      ...product, facts: { ...product.facts, ndcOrUniqueId: emptyAddedFact() },
    })) };
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v14" && version.data.version !== "wilson-browser-state-v12" && version.data.version !== "wilson-browser-state-v13") {
    const legacy = v11CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = legacy.data; // Numeric years and all fact/draft target identities stay unchanged.
  }
  if (version.data.version === "wilson-browser-state-v12") {
    const legacy = v12CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = legacy.data; // Existing atomic months/days and their full history remain unchanged.
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v14") {
    const legacy = v13CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, patient: { ...legacy.data.patient, facts: { ...legacy.data.patient.facts, dateOfBirth: emptyAddedFact(), a2Value: emptyAddedFact() } } };
  }
  if (version.data.version !== browserStateVersion) {
    const legacy = v14CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, patient: { ...legacy.data.patient, facts: { ...legacy.data.patient.facts, raceEthnicity: emptyAddedFact() } } };
  }
  const parsedCase = caseSchema.safeParse(candidate);
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
    provenance: journeyProvenance(),
  };
}

/** Only a public commit identity may cross this boundary; never expose raw environment values. */
export function journeyProvenance(commit = process.env.VERCEL_GIT_COMMIT_SHA) {
  return {
    stateVersion: browserStateVersion,
    release: typeof commit === "string" && commit.length === 40 && /^[a-f0-9]{40}$/i.test(commit) ? commit.toLowerCase() : null,
  };
}

export function assertStoredStage(state: BrowserJourneyState, snapshot: JourneySnapshot): void {
  if (state.stage !== snapshot.stage || state.case.revision !== snapshot.revision) {
    throw new BrowserStateError("The saved synthetic preview stage is stale", "stale-browser-state");
  }
}

function emptyAddedFact(): Fact<string> {
  return { state: "empty", proposedValues: [], conflictingValues: [], sourceIds: [], supersededValues: [] };
}
