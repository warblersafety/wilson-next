import { z } from "zod";
import type { SemanticCase } from "../../domain/case/types";
import type { JourneySnapshot, JourneyStage } from "../journey/service";
import { InMemoryCaseRepository, validateRestoredCase } from "./repository";

export const browserStateVersion = "wilson-browser-state-v1";

export interface BrowserJourneyState {
  version: typeof browserStateVersion;
  stage: JourneyStage;
  case: SemanticCase;
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
  ageYears: factSchema(z.number().int().min(0).max(130)),
  sex: factSchema(z.enum(["female", "male", "intersex"])),
}).strict();
const eventFactsSchema = z.object({
  reportType: factSchema(z.literal("adverse-event")),
  symptoms: factSchema(z.array(z.string())),
  onsetDate: factSchema(isoDateSchema),
  hospitalized: factSchema(z.boolean()),
  hemoglobin: factSchema(z.string()),
  treatments: factSchema(z.array(z.string())),
  outcome: factSchema(z.string()),
  dischargeDate: factSchema(isoDateSchema),
}).strict();
const productFactsSchema = z.object({
  name: factSchema(z.string()),
  role: factSchema(z.enum(["suspect", "concomitant"])),
  dose: factSchema(z.string()),
  frequency: factSchema(z.string()),
  route: factSchema(z.string()),
  startDate: factSchema(isoDateSchema),
  stopDate: factSchema(isoDateSchema),
  indication: factSchema(z.string()),
  stopped: factSchema(z.boolean()),
}).strict();

const sourceSchema = z.object({
  id: z.string().min(1),
  inputId: z.string().min(1),
  inputType: z.enum(["narrative", "selection", "answer", "correction", "resolution"]),
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
  }).strict()).max(3),
  askedNeeds: z.array(z.object({
    key: z.literal("suspect-product-indications"),
    productIds: z.array(z.string().min(1)),
    status: z.enum(["open", "answered", "declined"]),
  }).strict()).max(1),
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
    "update",
    "correct",
    "output-unresolved",
    "output-resolved",
  ]),
  case: z.unknown(),
}).strict();

export function parseBrowserJourneyState(input: unknown): BrowserJourneyState {
  const envelope = stateSchema.safeParse(input);
  if (!envelope.success) {
    throw new BrowserStateError("The saved synthetic preview state is malformed", "malformed-browser-state");
  }
  if (envelope.data.version !== browserStateVersion) {
    throw new BrowserStateError("The saved synthetic preview state is incompatible", "incompatible-browser-state");
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
  return { version: browserStateVersion, stage: envelope.data.stage, case: caseState };
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
    state: { version: browserStateVersion, stage: snapshot.stage, case: caseState },
    snapshot,
  };
}

export function assertStoredStage(state: BrowserJourneyState, snapshot: JourneySnapshot): void {
  if (state.stage !== snapshot.stage || state.case.revision !== snapshot.revision) {
    throw new BrowserStateError("The saved synthetic preview stage is stale", "stale-browser-state");
  }
}
