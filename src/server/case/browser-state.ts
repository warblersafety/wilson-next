import {isPartialExpiration} from "../../domain/case/expiration";
import { isOtherProductTypes, otherProductTypeValues } from "../../domain/case/other-product-types";
import { isTreatmentDuration } from "../../domain/case/duration";
import { isCompleteCalendarDate } from "../../domain/case/calendar-date";
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

export const browserStateVersion = "wilson-browser-state-v30";

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
  therapyOngoing: factSchema(z.boolean()),
  indication: factSchema(z.string()),
  stopped: factSchema(z.boolean()),
  cosmeticUse: factSchema(z.enum(["professional-use-only", "retail"])),
  medicationType: factSchema(z.array(z.enum(["brand", "generic-biosimilar", "otc", "compounded"]))),
  doseReduced: factSchema(z.boolean()),
  doseReductionDate: factSchema(z.string().refine(isCompleteCalendarDate)),
  treatmentDuration: factSchema(z.object({ value: z.string(), unit: z.string() }).strict().refine(isTreatmentDuration)),
  d3Value: factSchema(z.enum(["dates", "duration"])),
  improvedAfterChange: factSchema(z.boolean()),
  restarted: factSchema(z.boolean()),
  recurred: factSchema(z.boolean()),
  commonName: factSchema(z.string()),
  procode: factSchema(z.string()),
  modelNumber: factSchema(z.string()),
  catalogNumber: factSchema(z.string()),
  purchaseSellerName: factSchema(z.string()),
  purchaseSellerAddress: factSchema(z.string()),
  purchaseSellerCity: factSchema(z.string()),
  purchaseSellerRegion: factSchema(z.string()),
  purchaseSellerPostalCode: factSchema(z.string()),
  purchaseSellerCountry: factSchema(z.string()),
  purchaseWebsite: factSchema(z.string()),
  purchaseDate: factSchema(z.string().refine(isCompleteCalendarDate)),
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

// Keep the v21 case shape frozen for strict legacy validation; only v22 adds involvement.
const v22CaseSchema = caseSchema.extend({ patient: caseSchema.shape.patient.extend({ facts: patientFactsSchema.extend({ involvement: factSchema(z.enum(["present", "none"])) }) }) });

const v23CaseSchema = v22CaseSchema.extend({ event: v22CaseSchema.shape.event.extend({ facts: eventFactsSchema.extend({ additionalComments: factSchema(z.string().refine(value => value.trim().length > 0)) }) }) });

const v24CaseSchema = v23CaseSchema.extend({ products: z.array(v23CaseSchema.shape.products.element.extend({ facts: productFactsSchema.extend({ otherProductTypes: factSchema(z.array(z.enum(otherProductTypeValues)).refine(isOtherProductTypes)) }) })).max(maximumCaseProducts) });

const v25CaseSchema=v24CaseSchema.extend({products:z.array(v24CaseSchema.shape.products.element.extend({facts:v24CaseSchema.shape.products.element.shape.facts.extend({expirationDate:factSchema(z.union([isoDateSchema,z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict().refine(isPartialExpiration)]))})})).max(maximumCaseProducts)});
const suppliedDateSchema=z.union([isoDateSchema,z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict().refine(isPartialExpiration)]);
const v26CaseSchema=v25CaseSchema.extend({products:z.array(v25CaseSchema.shape.products.element.extend({facts:v25CaseSchema.shape.products.element.shape.facts.extend({purchaseDate:factSchema(z.union([z.string().refine(isCompleteCalendarDate),suppliedDateSchema.options[1]])),startDate:factSchema(suppliedDateSchema),stopDate:factSchema(suppliedDateSchema),doseReductionDate:factSchema(z.union([z.string().refine(isCompleteCalendarDate),suppliedDateSchema.options[1]]))})})).max(maximumCaseProducts)});
const v27CaseSchema=v26CaseSchema.extend({products:z.array(v26CaseSchema.shape.products.element.extend({facts:v26CaseSchema.shape.products.element.shape.facts.extend({implantDate:factSchema(suppliedDateSchema),explantDate:factSchema(suppliedDateSchema)})})).max(maximumCaseProducts)});
const v28CaseSchema=v27CaseSchema.extend({relevantTests:z.array(v27CaseSchema.shape.relevantTests.element.extend({facts:v27CaseSchema.shape.relevantTests.element.shape.facts.extend({date:factSchema(suppliedDateSchema)})})).max(maximumRelevantTests)});
const v29CaseSchema=v28CaseSchema.extend({event:v28CaseSchema.shape.event.extend({facts:v28CaseSchema.shape.event.shape.facts.extend({onsetDate:factSchema(suppliedDateSchema),deathDate:factSchema(suppliedDateSchema),dischargeDate:factSchema(suppliedDateSchema)})})});
const currentCaseSchema=v29CaseSchema.extend({event:v29CaseSchema.shape.event.extend({facts:v29CaseSchema.shape.event.shape.facts.extend({productReturnDate:factSchema(suppliedDateSchema)})})});

const prePurchaseDetailsProductFactsSchema = productFactsSchema.omit({purchaseSellerName: true, purchaseSellerAddress: true, purchaseSellerCity: true, purchaseSellerRegion: true, purchaseSellerPostalCode: true, purchaseSellerCountry: true, purchaseWebsite: true});
const v20CaseSchema = caseSchema.extend({products:z.array(caseSchema.shape.products.element.extend({facts:prePurchaseDetailsProductFactsSchema})).max(maximumCaseProducts)});
const preCosmeticProductFactsSchema = prePurchaseDetailsProductFactsSchema.omit({ cosmeticUse: true });
const v19CaseSchema = caseSchema.extend({products: z.array(caseSchema.shape.products.element.extend({facts: preCosmeticProductFactsSchema})).max(maximumCaseProducts)});
const prePurchaseProductFactsSchema = preCosmeticProductFactsSchema.omit({ purchaseDate: true });
const v18CaseSchema = caseSchema.extend({products: z.array(caseSchema.shape.products.element.extend({facts: prePurchaseProductFactsSchema})).max(maximumCaseProducts)});
const preDurationProductFactsSchema = prePurchaseProductFactsSchema.omit({ treatmentDuration: true, d3Value: true });
const v17CaseSchema = caseSchema.extend({
  products: z.array(caseSchema.shape.products.element.extend({facts: preDurationProductFactsSchema})).max(maximumCaseProducts),
});
const preReductionProductFactsSchema = preDurationProductFactsSchema.omit({ doseReductionDate: true });
const v16CaseSchema = caseSchema.extend({
  products: z.array(caseSchema.shape.products.element.extend({ facts: preReductionProductFactsSchema })).max(maximumCaseProducts),
});
const preOngoingProductFactsSchema = preReductionProductFactsSchema.omit({ therapyOngoing: true });
const v15CaseSchema = caseSchema.extend({
  products: z.array(caseSchema.shape.products.element.extend({ facts: preOngoingProductFactsSchema })).max(maximumCaseProducts),
});
const preRacePatientFactsSchema = patientFactsSchema.omit({ raceEthnicity: true });
const v14CaseSchema = v15CaseSchema.extend({ patient: v15CaseSchema.shape.patient.extend({ facts: preRacePatientFactsSchema }) });
const preDobPatientFactsSchema = preRacePatientFactsSchema.omit({ dateOfBirth: true, a2Value: true });
const v13CaseSchema = v15CaseSchema.extend({ patient: v15CaseSchema.shape.patient.extend({ facts: preDobPatientFactsSchema }) });
const v12PatientSchema = v15CaseSchema.shape.patient.extend({
  facts: preDobPatientFactsSchema.extend({
    ageYears: factSchema(z.union([
      z.number().int().min(0).max(150),
      z.object({ value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), unit: z.enum(["months", "days"]) }).strict(),
    ])),
  }),
});
const v12CaseSchema = v15CaseSchema.extend({ patient: v12PatientSchema });
const legacyPatientSchema = v15CaseSchema.shape.patient.extend({ facts: preDobPatientFactsSchema.extend({ ageYears: factSchema(z.number().int().min(0).max(150)) }) });
const v11CaseSchema = v15CaseSchema.extend({ patient: legacyPatientSchema });
const v10ProductFactsSchema = preOngoingProductFactsSchema.omit({ ndcOrUniqueId: true });
const v10CaseSchema = v11CaseSchema.extend({
  products: z.array(v15CaseSchema.shape.products.element.extend({ facts: v10ProductFactsSchema })).max(maximumCaseProducts),
});
const v9ProductFactsSchema = v10ProductFactsSchema.omit({ medicationType: true, doseReduced: true, improvedAfterChange: true, restarted: true, recurred: true });
const v9CaseSchema = v11CaseSchema.extend({
  products: z.array(v15CaseSchema.shape.products.element.extend({ facts: v9ProductFactsSchema })).max(maximumCaseProducts),
});
const v8CaseSchema = v9CaseSchema.extend({
  relevantTests: z.array(v15CaseSchema.shape.relevantTests.element.extend({ facts: relevantTestFactsSchema.omit({ testName: true }) })).max(maximumRelevantTests),
});
const legacyCaseSchema = v8CaseSchema.extend({
  event: v15CaseSchema.shape.event.extend({ facts: eventFactsSchema.omit({ reportDate: true }) }),
  products: z.array(v15CaseSchema.shape.products.element.extend({ facts: v9ProductFactsSchema.omit({ strength: true }) })).max(maximumCaseProducts),
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
  if (![browserStateVersion, "wilson-browser-state-v29", "wilson-browser-state-v28", "wilson-browser-state-v27", "wilson-browser-state-v26", "wilson-browser-state-v25", "wilson-browser-state-v24", "wilson-browser-state-v23", "wilson-browser-state-v22", "wilson-browser-state-v21", "wilson-browser-state-v20", "wilson-browser-state-v19", "wilson-browser-state-v18", "wilson-browser-state-v17", "wilson-browser-state-v16", "wilson-browser-state-v15", "wilson-browser-state-v14", "wilson-browser-state-v13", "wilson-browser-state-v12", "wilson-browser-state-v11", "wilson-browser-state-v10", "wilson-browser-state-v9", "wilson-browser-state-v8", "wilson-browser-state-v7"].includes(version.data.version)) {
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
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20" && version.data.version !== "wilson-browser-state-v19" && version.data.version !== "wilson-browser-state-v18" && version.data.version !== "wilson-browser-state-v17" && version.data.version !== "wilson-browser-state-v16" && version.data.version !== "wilson-browser-state-v15" && version.data.version !== "wilson-browser-state-v14" && version.data.version !== "wilson-browser-state-v12" && version.data.version !== "wilson-browser-state-v13") {
    const legacy = v11CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = legacy.data; // Numeric years and all fact/draft target identities stay unchanged.
  }
  if (version.data.version === "wilson-browser-state-v12") {
    const legacy = v12CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = legacy.data; // Existing atomic months/days and their full history remain unchanged.
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20" && version.data.version !== "wilson-browser-state-v19" && version.data.version !== "wilson-browser-state-v18" && version.data.version !== "wilson-browser-state-v17" && version.data.version !== "wilson-browser-state-v16" && version.data.version !== "wilson-browser-state-v15" && version.data.version !== "wilson-browser-state-v14") {
    const legacy = v13CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, patient: { ...legacy.data.patient, facts: { ...legacy.data.patient.facts, dateOfBirth: emptyAddedFact(), a2Value: emptyAddedFact() } } };
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20" && version.data.version !== "wilson-browser-state-v19" && version.data.version !== "wilson-browser-state-v18" && version.data.version !== "wilson-browser-state-v17" && version.data.version !== "wilson-browser-state-v16" && version.data.version !== "wilson-browser-state-v15") {
    const legacy = v14CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, patient: { ...legacy.data.patient, facts: { ...legacy.data.patient.facts, raceEthnicity: emptyAddedFact() } } };
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20" && version.data.version !== "wilson-browser-state-v19" && version.data.version !== "wilson-browser-state-v18" && version.data.version !== "wilson-browser-state-v17" && version.data.version !== "wilson-browser-state-v16") {
    const legacy = v15CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, products: legacy.data.products.map(product => ({ ...product, facts: { ...product.facts, therapyOngoing: emptyAddedFact() } })) };
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20" && version.data.version !== "wilson-browser-state-v19" && version.data.version !== "wilson-browser-state-v18" && version.data.version !== "wilson-browser-state-v17") {
    const legacy = v16CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, products: legacy.data.products.map(product => ({ ...product, facts: { ...product.facts, doseReductionDate: emptyAddedFact() } })) };
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20" && version.data.version !== "wilson-browser-state-v19" && version.data.version !== "wilson-browser-state-v18") {
    const legacy = v17CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = {...legacy.data, products: legacy.data.products.map(p => ({...p, facts:{...p.facts,treatmentDuration:emptyAddedFact(),d3Value:emptyAddedFact()}}))};
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20" && version.data.version !== "wilson-browser-state-v19") {
    const legacy = v18CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = {...legacy.data, products: legacy.data.products.map(p => ({...p,facts:{...p.facts,purchaseDate:emptyAddedFact()}}))};
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22" && version.data.version !== "wilson-browser-state-v21" && version.data.version !== "wilson-browser-state-v20") {
    const legacy = v19CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = {...legacy.data, products: legacy.data.products.map(p => ({...p,facts:{...p.facts,cosmeticUse:emptyAddedFact()}}))};
  }
  if(version.data.version!==browserStateVersion && version.data.version!=="wilson-browser-state-v29" && version.data.version!=="wilson-browser-state-v28" && version.data.version!=="wilson-browser-state-v27" && version.data.version!=="wilson-browser-state-v26" && version.data.version!=="wilson-browser-state-v25" && version.data.version!=="wilson-browser-state-v24" && version.data.version!=="wilson-browser-state-v23" && version.data.version!=="wilson-browser-state-v22" && version.data.version!=="wilson-browser-state-v21"){
    const legacy=v20CaseSchema.safeParse(candidate);
    if(!legacy.success)throw new BrowserStateError("The saved synthetic preview case is malformed","malformed-browser-state");
    candidate={...legacy.data,products:legacy.data.products.map(p=>({...p,facts:{...p.facts,purchaseSellerName:emptyAddedFact(),purchaseSellerAddress:emptyAddedFact(),purchaseSellerCity:emptyAddedFact(),purchaseSellerRegion:emptyAddedFact(),purchaseSellerPostalCode:emptyAddedFact(),purchaseSellerCountry:emptyAddedFact(),purchaseWebsite:emptyAddedFact()}}))};
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23" && version.data.version !== "wilson-browser-state-v22") {
    const legacy = caseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, patient: { ...legacy.data.patient, facts: { ...legacy.data.patient.facts, involvement: emptyAddedFact() } } };
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24" && version.data.version !== "wilson-browser-state-v23") {
    const legacy = v22CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, event: { ...legacy.data.event, facts: { ...legacy.data.event.facts, additionalComments: emptyAddedFact() } } };
  }
  if (version.data.version !== browserStateVersion && version.data.version !== "wilson-browser-state-v29" && version.data.version !== "wilson-browser-state-v28" && version.data.version !== "wilson-browser-state-v27" && version.data.version !== "wilson-browser-state-v26" && version.data.version !== "wilson-browser-state-v25" && version.data.version !== "wilson-browser-state-v24") {
    const legacy = v23CaseSchema.safeParse(candidate);
    if (!legacy.success) throw new BrowserStateError("The saved synthetic preview case is malformed", "malformed-browser-state");
    candidate = { ...legacy.data, products: legacy.data.products.map(product => ({ ...product, facts: { ...product.facts, otherProductTypes: emptyAddedFact() } })) };
  }
  if(version.data.version === "wilson-browser-state-v24" && !v24CaseSchema.safeParse(candidate).success) throw new BrowserStateError("The saved synthetic preview case is malformed","malformed-browser-state");
  if(version.data.version === "wilson-browser-state-v29" && !v29CaseSchema.safeParse(candidate).success) throw new BrowserStateError("The saved synthetic preview case is malformed","malformed-browser-state");
  if(version.data.version === "wilson-browser-state-v28" && !v28CaseSchema.safeParse(candidate).success) throw new BrowserStateError("The saved synthetic preview case is malformed","malformed-browser-state");
  if(version.data.version === "wilson-browser-state-v27" && !v27CaseSchema.safeParse(candidate).success) throw new BrowserStateError("The saved synthetic preview case is malformed","malformed-browser-state");
  if(version.data.version === "wilson-browser-state-v26" && !v26CaseSchema.safeParse(candidate).success) throw new BrowserStateError("The saved synthetic preview case is malformed","malformed-browser-state");
  if(version.data.version === "wilson-browser-state-v25" && !v25CaseSchema.safeParse(candidate).success) throw new BrowserStateError("The saved synthetic preview case is malformed","malformed-browser-state");
  const parsedCase = currentCaseSchema.safeParse(candidate);
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
