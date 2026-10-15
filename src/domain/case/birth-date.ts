import type { Fact, SemanticCase } from "./types";
function knownValue<T>(fact: Fact<T>): T | undefined {
  return fact.state === "resolved" && fact.resolvedValue?.value.kind === "known" ? fact.resolvedValue.value.value : undefined;
}

/** Complete Gregorian calendar date only. No age, timezone or current-date calculation. */
export function isCompleteBirthDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function patientA2ChoiceIssue(caseState: SemanticCase): string | undefined {
  const facts = caseState.patient.facts;
  const age = knownValue(facts.ageYears), dob = knownValue(facts.dateOfBirth), choice = knownValue(facts.a2Value);
  if (choice === "age" && age === undefined) return "Age is selected for A2 but no known age is available. Supply age or explicitly choose date of birth.";
  if (choice === "date-of-birth" && dob === undefined) return "Date of birth is selected for A2 but no known date is available. Supply a complete date or explicitly choose age.";
  if (age !== undefined && dob !== undefined && choice === undefined) return "Both age and date of birth are retained. Choose the A2 value to print in Patient details; Wilson does not calculate or discard either fact.";
  return undefined;
}
