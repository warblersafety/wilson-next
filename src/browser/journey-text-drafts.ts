import type { ReportType } from "../domain/case/types";

/** Only top-level text/selection drafts. This is not a complete UI snapshot or
 * clinical state, and is not wired to durable storage. Null means no selection. */
export interface JourneyTextDrafts {
  version: 1;
  opening: string;
  reportType: ReportType | null;
  update: string;
}
export function initialJourneyTextDrafts(): JourneyTextDrafts {
  return { version: 1, opening: "", reportType: "adverse-event", update: "" };
}
export function decodeJourneyTextDrafts(value: unknown): JourneyTextDrafts {
  const types: unknown[] = [null, "adverse-event", "product-problem", "adverse-event-and-product-problem"];
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("Invalid text draft record");
  const record = value as Record<string, unknown>;
  const expected = ["version", "opening", "reportType", "update"];
  if (Object.keys(record).length !== expected.length || !expected.every(key => Object.hasOwn(record, key))
    || record.version !== 1 || typeof record.opening !== "string" || typeof record.update !== "string"
    || !types.includes(record.reportType)) throw new Error("Invalid or unsupported text draft record");
  return { version: 1, opening: record.opening, reportType: record.reportType as ReportType | null, update: record.update };
}
export type TextDraftAction =
  | { type: "opening"; value: string }
  | { type: "report-type"; value: ReportType | null }
  | { type: "update"; value: string }
  | { type: "update-submitted"; text: string }
  | { type: "new-case" };

export function reduceJourneyTextDrafts(state: JourneyTextDrafts, action: TextDraftAction): JourneyTextDrafts {
  switch (action.type) {
    case "opening": return { ...state, opening: action.value };
    case "report-type": return { ...state, reportType: action.value };
    case "update": return { ...state, update: action.value };
    // Acknowledging an older request must never erase later typing.
    case "update-submitted": return state.update === action.text ? { ...state, update: "" } : state;
    case "new-case": return initialJourneyTextDrafts();
  }
}
