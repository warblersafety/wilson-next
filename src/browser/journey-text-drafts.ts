import type { ReportType } from "../domain/case/types";
import { z } from "zod";
import { DraftDecodeError } from "./draft-error";

export const journeyTextDraftSchema = z.object({ version: z.literal(1), opening: z.string(), reportType: z.enum(["adverse-event", "product-problem", "adverse-event-and-product-problem"]).nullable(), update: z.string() }).strict();

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
  if (value && typeof value === "object" && "version" in value && typeof value.version === "number" && value.version !== 1) {
    throw new DraftDecodeError("incompatible", "The unfinished text uses an unsupported version.");
  }
  const parsed = journeyTextDraftSchema.safeParse(value);
  if (!parsed.success) throw new DraftDecodeError("corrupt", "The unfinished text record is invalid.");
  return parsed.data;
}
export type TextDraftAction =
  | { type: "opening"; value: string }
  | { type: "report-type"; value: ReportType | null }
  | { type: "update"; value: string }
  | { type: "update-submitted"; text: string }
  | { type: "opening-submitted"; text: string }
  | { type: "new-case" };

export function reduceJourneyTextDrafts(state: JourneyTextDrafts, action: TextDraftAction): JourneyTextDrafts {
  switch (action.type) {
    case "opening": return { ...state, opening: action.value };
    case "report-type": return { ...state, reportType: action.value };
    case "update": return { ...state, update: action.value };
    // Acknowledging an older request must never erase later typing.
    case "opening-submitted": return state.opening === action.text ? { ...state, opening: "" } : state;
    case "update-submitted": return state.update === action.text ? { ...state, update: "" } : state;
    case "new-case": return initialJourneyTextDrafts();
  }
}
