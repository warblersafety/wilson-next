import type { Fact, ProductFacts, ProductFactKey } from "./types";

export const medicationAnswerFields = ["stopped", "doseReduced", "stopDate", "improvedAfterChange", "restarted", "recurred"] as const;
export type MedicationAnswerField = typeof medicationAnswerFields[number];

export function isSettled(fact: Fact<unknown>): boolean {
  return fact.state === "resolved" && fact.proposedValues.length === 0;
}

export function settledBoolean(fact: Fact<boolean>): boolean | undefined {
  return isSettled(fact) && fact.resolvedValue?.value.kind === "known" ? fact.resolvedValue.value.value : undefined;
}

function explicitlyInapplicable(fact: Fact<unknown>): boolean {
  return isSettled(fact) && fact.resolvedValue?.value.kind === "inapplicable";
}

export function withdrawalApplicability(facts: ProductFacts): boolean | undefined {
  if (settledBoolean(facts.stopped) === true || settledBoolean(facts.doseReduced) === true) return true;
  if ((settledBoolean(facts.stopped) === false || explicitlyInapplicable(facts.stopped))
    && (settledBoolean(facts.doseReduced) === false || explicitlyInapplicable(facts.doseReduced))) return false;
  return undefined;
}

export function restartApplicability(facts: ProductFacts): boolean | undefined {
  return explicitlyInapplicable(facts.restarted) ? false : settledBoolean(facts.restarted);
}

/** Relevant targets only; missing answers never imply negative clinical facts. */
export function applicableMedicationFields(stopped: boolean | undefined, reduced: boolean | undefined, restarted: boolean | undefined): MedicationAnswerField[] {
  return [
    "stopped",
    ...(stopped !== true ? ["doseReduced" as const] : []),
    ...(stopped === true ? ["stopDate" as const] : []),
    ...(stopped === true || reduced === true ? ["improvedAfterChange" as const] : []),
    ...(stopped === true ? ["restarted" as const] : []),
    ...(restarted === true ? ["recurred" as const] : []),
  ];
}

export function medicationFieldApplies(facts: ProductFacts, field: ProductFactKey): boolean {
  return applicableMedicationFields(settledBoolean(facts.stopped), settledBoolean(facts.doseReduced), settledBoolean(facts.restarted))
    .includes(field as MedicationAnswerField);
}

export function missingMedicationFields(facts: ProductFacts): MedicationAnswerField[] {
  return medicationAnswerFields.filter((field) => medicationFieldApplies(facts, field) && facts[field].state === "empty");
}
