import { z } from "zod";
import type { CaseValue } from "../domain/case/types";
import type { JourneySnapshot } from "../server/journey/service";
import type { JsonObject } from "./active-case-store";
import { DraftDecodeError } from "./draft-error";
import { decodeJourneyTextDrafts, initialJourneyTextDrafts, journeyTextDraftSchema, reduceJourneyTextDrafts, type TextDraftAction } from "./journey-text-drafts";

const rawSuppliedDate=z.union([z.string(),z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict()]);
const choice = z.enum(["known", "unknown", "declined"]);
const deviceChoice = z.enum(["known", "unknown", "inapplicable", "declined"]);
const nonKnown = z.union([z.object({ kind: z.literal("unknown") }).strict(), z.object({ kind: z.literal("declined") }).strict(), z.object({ kind: z.literal("inapplicable") }).strict(), z.object({ kind: z.literal("explicitly-absent") }).strict()]);
const editableValue = z.union([nonKnown, z.object({ kind: z.literal("known"), value: z.union([z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict(),z.object({wording:z.string()}).strict(),z.string(), z.number(), z.boolean(), z.array(z.string()), z.object({ value: z.number(), unit: z.enum(["kg", "lb"]) }).strict(), z.object({ value: z.number(), unit: z.enum(["months", "weeks", "days"]) }).strict(), z.object({ value: z.string(), unit: z.string() }).strict()]), qualifier: z.string().optional() }).strict()]);
const booleanAnswer = z.union([nonKnown, z.object({ kind: z.literal("known"), value: z.boolean(), qualifier: z.string().optional() }).strict()]);
const dateAnswer = z.union([nonKnown, z.object({ kind: z.literal("known"), value: z.string(), qualifier: z.string().optional() }).strict()]);
const reporterValues = z.object({ firstName: z.string(), lastName: z.string(), address: z.string(), city: z.string(), state: z.string(), postalCode: z.string(), country: z.string(), phone: z.string(), email: z.string(), occupation: z.string() }).strict();
export const componentDraftSchemas = {
  "legacy-date-recovery": z.object({drafts:z.record(z.string(),editableValue),qualifierControls:z.record(z.string(),z.boolean())}).strict(),
  indications: z.object({ choices: z.record(z.string(), choice), texts: z.record(z.string(), z.string()) }).strict(),
  "serious-outcomes": z.object({ selected: z.array(z.enum(["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"])) }).strict(),
  "death-date": z.object({ date: rawSuppliedDate }).strict(),
  "clinical-context": z.object({ testChoice: z.enum(["known", "explicitly-absent", "unknown", "declined"]).optional(), historyChoice: z.enum(["known", "explicitly-absent", "unknown", "declined"]).optional(), testName: z.string(), testResult: z.string(), lowRange: z.string(), highRange: z.string(), testDate: rawSuppliedDate, history: z.string() }).strict(),
  "device-details": z.object({ implantChoice: deviceChoice.optional(), explantChoice: deviceChoice.optional(), reprocessorChoice: choice.optional(), implantDate: rawSuppliedDate, explantDate: rawSuppliedDate, reprocessor: z.string() }).strict(),
  "medication-history": z.object({ answers: z.object({ stopped: booleanAnswer.optional(), doseReduced: booleanAnswer.optional(), stopDate: z.union([nonKnown,z.object({kind:z.literal("known"),value:z.union([z.string(),z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict()]),qualifier:z.string().optional()}).strict()]).optional(), improvedAfterChange: booleanAnswer.optional(), restarted: booleanAnswer.optional(), recurred: booleanAnswer.optional() }).strict() }).strict(),
  reporter: z.object({ values: reporterValues, reportDate: z.string(), healthProfessional: z.boolean(), reportedTo: z.array(z.enum(["manufacturer", "user-facility", "distributor-importer", "packer"])), doNotDiscloseIdentity: z.boolean(), baseline: z.string() }).strict(),
  card: z.object({ showMore: z.boolean(), showOutcomes: z.boolean(), editing: z.string().optional(), drafts: z.record(z.string(), editableValue), qualifierControls: z.record(z.string(), z.boolean()), factVersions: z.record(z.string(), z.string()) }).strict(),
};
/** Keep raw qualifier edits in UI state; the existing command contract omits
 * blank qualifiers only when the user explicitly submits a correction. */
export function editValueForSubmission<T>(value: CaseValue<T>): CaseValue<T> {
  if (value.kind !== "known" || value.qualifier === undefined || value.qualifier.trim()) return value;
  const { qualifier: _qualifier, ...unqualified } = value;
  return unqualified;
}
export type DraftKind = keyof typeof componentDraftSchemas;
export type DraftData<K extends DraftKind> = z.infer<(typeof componentDraftSchemas)[K]>;
export type ComponentDraft = { [K in DraftKind]: { kind: K; scope: string; dependency: string; data: DraftData<K> } }[DraftKind];
const recordSchema = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("legacy-date-recovery"),scope:z.string(),dependency:z.string(),data:componentDraftSchemas["legacy-date-recovery"]}).strict(),
  z.object({ kind: z.literal("indications"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas.indications }).strict(),
  z.object({ kind: z.literal("serious-outcomes"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas["serious-outcomes"] }).strict(),
  z.object({ kind: z.literal("death-date"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas["death-date"] }).strict(),
  z.object({ kind: z.literal("clinical-context"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas["clinical-context"] }).strict(),
  z.object({ kind: z.literal("device-details"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas["device-details"] }).strict(),
  z.object({ kind: z.literal("medication-history"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas["medication-history"] }).strict(),
  z.object({ kind: z.literal("reporter"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas.reporter }).strict(),
  z.object({ kind: z.literal("card"), scope: z.string(), dependency: z.string(), data: componentDraftSchemas.card }).strict(),
]);
export const screenSchema = z.enum(["describe", "details", "reporter", "save"]);
const snapshotSchema = z.object({ version: z.literal(1), caseId: z.string().min(1).nullable(), screen: screenSchema, text: journeyTextDraftSchema, conversation: z.array(z.object({ id: z.string().min(1), kind: z.enum(["opening", "update"]), text: z.string(), revision: z.number().int().nonnegative() }).strict()), records: z.record(z.string(), recordSchema) }).strict();
export type UiDraftSnapshot = z.infer<typeof snapshotSchema>;
export const draftRecordKey = (kind: DraftKind, scope: string) => JSON.stringify([kind, scope]);
export function initialUiDrafts(caseId: string | null = null): UiDraftSnapshot {
  return { version: 1, caseId, screen: "describe", text: initialJourneyTextDrafts(), conversation: [], records: {} };
}
export function decodeUiDrafts(value: unknown, expectedCaseId?: string): UiDraftSnapshot {
  if (value && typeof value === "object" && "version" in value && typeof value.version === "number" && value.version !== 1) throw new DraftDecodeError("incompatible", "The unfinished work uses an unsupported version.");
  if (value && typeof value === "object" && "text" in value) decodeJourneyTextDrafts(value.text);
  if (value && typeof value === "object" && "records" in value && value.records && typeof value.records === "object") {
    for (const record of Object.values(value.records)) {
      if (record && typeof record === "object" && "kind" in record && typeof record.kind === "string" && !Object.hasOwn(componentDraftSchemas, record.kind)) throw new DraftDecodeError("incompatible", "An unfinished task needs a compatible version.");
    }
  }
  const result = snapshotSchema.safeParse(value);
  if (!result.success || (expectedCaseId !== undefined && result.data.caseId !== expectedCaseId)) throw new DraftDecodeError("corrupt", "The unfinished work record is invalid or belongs to another case.");
  if (new Set(result.data.conversation.map(input => input.id)).size !== result.data.conversation.length
    || result.data.conversation.filter(input => input.kind === "opening").length > 1) throw new DraftDecodeError("corrupt", "The submitted input history has an invalid identity.");
  for (const [key, record] of Object.entries(result.data.records)) {
    if (key !== draftRecordKey(record.kind, record.scope)) throw new DraftDecodeError("corrupt", "An unfinished task has an invalid identity.");
  }
  return result.data;
}
/** Undefined optional choices mean unselected. JSON omits them; empty strings,
 * false and empty arrays are preserved. No coercion of user text occurs. */
export function encodeUiDrafts(value: UiDraftSnapshot): JsonObject {
  return JSON.parse(JSON.stringify(decodeUiDrafts(value))) as JsonObject;
}
export function clinicalDraftKey(snapshot: JourneySnapshot): string {
  const q = snapshot.clarification;
  if (!q) return "none";
  const product = q.kind === "medication-history" ? snapshot.understanding.products.find(({ id }) => id === q.productId)
    : q.kind === "device-details" ? snapshot.understanding.products.find(({ id }) => id === q.deviceId) : undefined;
  return JSON.stringify([q.key, q.targetIds, product && [product.state, ...["name", "role", "productType", "stopped", "doseReduced", "restarted", "implanted", "reprocessedSingleUse"].map(field => product.facts[field].resolved)]]);
}
export const reporterDraftKey = (snapshot: JourneySnapshot) => JSON.stringify([snapshot.understanding.reporter, snapshot.understanding.event.reportDate.resolved]);
export const factVersions = (facts: JourneySnapshot["understanding"]["patient"]) => Object.fromEntries(Object.entries(facts).map(([field, fact]) => [field, JSON.stringify([fact.resolved, fact.history, fact.conflicts])]));
/** Same prerequisite invalidation for an active editor and a restored editor. */
export function invalidatedCardFields(facts: JourneySnapshot["understanding"]["patient"], previous: Record<string, string>, entity: string): Set<string> {
  const current = factVersions(facts);
  const changed = [...new Set([...Object.keys(current), ...Object.keys(previous)])].filter(field => current[field] !== previous[field]);
  const invalid = new Set(changed);
  if (entity === "product" && changed.some(field => ["name", "productType", "role", "stopped", "doseReduced", "restarted"].includes(field))) {
    for (const field of ["stopped", "doseReduced", "stopDate", "improvedAfterChange", "restarted", "recurred"]) invalid.add(field);
  }
  if (entity === "product" && changed.some(field => ["productType", "role", "implanted", "reprocessedSingleUse"].includes(field))) {
    for (const field of ["implantDate", "explantDate", "reprocessor"]) invalid.add(field);
  }
  return invalid;
}
export type DraftAction =
  | { type: "text"; action: TextDraftAction }
  | { type: "submitted"; caseId: string; id: string; kind: "opening" | "update"; text: string; revision: number }
  | { type: "screen"; value: UiDraftSnapshot["screen"] }
  | { type: "response"; caseId: string; snapshot: JourneySnapshot }
  | { type: "reset"; caseId: string }
  | { type: "replace"; snapshot: UiDraftSnapshot }
  | { type: "component"; kind: DraftKind; scope: string; dependency: string; initial: unknown; update?: (current: unknown) => unknown };
export function reduceUiDrafts(state: UiDraftSnapshot, action: DraftAction): UiDraftSnapshot {
  if (action.type === "text") return { ...state, text: reduceJourneyTextDrafts(state.text, action.action) };
  if (action.type === "submitted") {
    if (state.caseId !== action.caseId) throw new DraftDecodeError("corrupt", "Submitted input belongs to another case.");
    if (state.conversation.some(input => input.id === action.id)) return state;
    if (action.kind === "opening" && state.conversation.some(input => input.kind === "opening")) throw new DraftDecodeError("corrupt", "A starting description is already recorded.");
    return { ...state, text: reduceJourneyTextDrafts(state.text, { type: action.kind === "opening" ? "opening-submitted" : "update-submitted", text: action.text }), conversation: [...state.conversation, { id: action.id, kind: action.kind, text: action.text, revision: action.revision }] };
  }
  if (action.type === "screen") return state.screen === action.value ? state : { ...state, screen: action.value };
  if (action.type === "reset") return initialUiDrafts(action.caseId);
  // Replacement DTOs are decoded by the owner input boundary before dispatch.
  if (action.type === "replace") return action.snapshot;
  if (action.type === "response") {
    const base = state.caseId && state.caseId !== action.caseId ? initialUiDrafts(action.caseId) : { ...state, caseId: action.caseId };
    const q = action.snapshot.clarification;
    const records = Object.fromEntries(Object.entries(base.records).filter(([, record]) => (record.kind === "card" || record.kind === "legacy-date-recovery")
      || (record.kind === "reporter" ? record.dependency === reporterDraftKey(action.snapshot)
        : q && q.kind === record.kind && q.key === record.scope && record.dependency === clinicalDraftKey(action.snapshot))));
    return { ...base, records };
  }
  const key = draftRecordKey(action.kind, action.scope), previous = state.records[key];
  if (!action.update && previous?.dependency === action.dependency) return state;
  const before = previous?.dependency === action.dependency ? previous.data : action.initial;
  const data = componentDraftSchemas[action.kind].parse(action.update ? action.update(before) : before);
  const record = { kind: action.kind, scope: action.scope, dependency: action.dependency, data } as ComponentDraft;
  return { ...state, records: { ...state.records, [key]: record } };
}
