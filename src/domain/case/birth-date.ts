import type { Fact, SemanticCase } from "./types";
function knownValue<T>(fact: Fact<T>): T | undefined {
  return fact.state === "resolved" && fact.resolvedValue?.value.kind === "known" ? fact.resolvedValue.value.value : undefined;
}

export { isCompleteCalendarDate as isCompleteBirthDate } from "./calendar-date";
export function patientA2ChoiceIssue(caseState: SemanticCase): string | undefined {
  const facts = caseState.patient.facts;
  const age = knownValue(facts.ageYears), dob = knownValue(facts.dateOfBirth), choice = knownValue(facts.a2Value);
  if (choice === "age" && age === undefined) return "Age is selected for A2 but no known age is available. Supply age, explicitly choose a known date of birth, or clear the A2 print choice (No print preference) if neither value is known.";
  if (choice === "date-of-birth" && dob === undefined) return "Date of birth is selected for A2 but no known date is available. Supply a date at its stated precision, explicitly choose a known age, or clear the A2 print choice (No print preference) if neither value is known.";
  if (age !== undefined && dob !== undefined && choice === undefined) return "Both age and date of birth are retained. Choose the A2 value to print in Patient details; Wilson does not calculate or discard either fact.";
  return undefined;
}
