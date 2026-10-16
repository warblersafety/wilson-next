import type { SemanticCase } from "./types";

/** Only explicit current known demographics contradict an accepted no-patient statement.
 * No missing, unknown, declined, historical or print-preference fact establishes participation.
 * Never resolve the contradiction by deleting either fact.
 */
export function noPatientConflictingTargets(caseState: SemanticCase): string[] {
  const facts = caseState.patient.facts;
  const involvement = facts.involvement;
  if (involvement.state !== "resolved" || involvement.resolvedValue?.value.kind !== "known" || involvement.resolvedValue.value.value !== "none") return [];
  return (["identifier", "ageYears", "dateOfBirth", "raceEthnicity", "sex", "weight"] as const)
    .filter(field => facts[field].state === "resolved" && facts[field].resolvedValue?.value.kind === "known")
    .map(field => `patient:patient:${field}`);
}

/** FDA reserves A1's none for no participation; a legacy literal must not be
 * silently reinterpreted as the new involvement fact or pass as an identifier.
 */
export function hasReservedNoPatientIdentifier(caseState: SemanticCase): boolean {
  const identifier = caseState.patient.facts.identifier;
  return identifier.state === "resolved" && identifier.resolvedValue?.value.kind === "known"
    && identifier.resolvedValue.value.value.trim().toLowerCase() === "none";
}
