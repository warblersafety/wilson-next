import type { ProductFacts } from "./types";
export const durationUnits = ["minutes", "hours", "days", "weeks", "months", "years"] as const;
export const durationNativeLabels = { minutes: "Minute(s)", hours: "Hour(s)", days: "Day(s)", weeks: "Week(s)", months: "Month(s)", years: "Year(s)" } as const;
export type TreatmentDuration = { value: string; unit: typeof durationUnits[number] };
export const durationNativeUnits = { minutes: "7", hours: "6", days: "5", weeks: "4", months: "3", years: "2" } as const;
/** Keep the supplied positive decimal spelling; no numeric coercion or conversion. */
export function isTreatmentDuration(value: unknown): value is TreatmentDuration {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string,unknown>;
  return Object.keys(v).length === 2 && typeof v.value === "string" && /^(?:\d+)(?:\.\d+)?$/.test(v.value) && /[1-9]/.test(v.value)
    && typeof v.unit === "string" && durationUnits.includes(v.unit as TreatmentDuration["unit"]);
}
function known<T>(fact: import("./types").Fact<T>): T | undefined {
  return fact.state === "resolved" && fact.resolvedValue?.value.kind === "known" ? fact.resolvedValue.value.value : undefined;
}
export const d3DateFields = ["startDate", "stopDate", "doseReductionDate"] as const;
export function d3ChoiceIssue(facts: ProductFacts): string | undefined {
  const dates = d3DateFields.some(field => known(facts[field]) !== undefined), duration = known(facts.treatmentDuration), choice = known(facts.d3Value);
  if (choice === "dates" && !dates) return "Dates are selected for D3 but no known treatment date is available. Supply dates, choose a known duration, or clear the D3 print choice.";
  if (choice === "duration" && !duration) return "Duration is selected for D3 but no known duration is available. Supply duration, choose known dates, or clear the D3 print choice.";
  if (dates && duration && !choice) return "Treatment dates and duration are both retained. Choose the D3 value to print; Wilson does not calculate, compare or discard either alternative.";
  return undefined;
}
export function d3Eligible(facts: ProductFacts): boolean {
  return known(facts.role) === "suspect" && ["drug-or-biologic", "other"].includes(known(facts.productType) ?? "");
}
export function d3Notice(facts: ProductFacts): string | undefined {
  if (!d3Eligible(facts)) return undefined;
  const issue = d3ChoiceIssue(facts);
  if (issue) return issue;
  if (known(facts.treatmentDuration) && d3DateFields.some(field => known(facts[field]) !== undefined)) return "Treatment dates and duration are both retained as supplied. D3 prints only your selected alternative; Wilson has not calculated or reconciled them.";
  return undefined;
}
