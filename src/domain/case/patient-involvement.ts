import { seriousOutcomeFields } from "./serious-outcomes";
import type { SemanticCase } from "./types";

/** Only explicit current known demographics contradict an accepted no-patient statement.
 * No missing, unknown, declined, historical or print-preference fact establishes participation.
 * Never resolve the contradiction by deleting either fact.
 */
export function noPatientConflictingTargets(caseState: SemanticCase): string[] {
  const facts = caseState.patient.facts;
  if (!explicitNoPatient(caseState)) return [];
  return (["identifier", "ageYears", "dateOfBirth", "raceEthnicity", "sex", "weight"] as const)
    .filter(field => (facts[field].state === "resolved" && facts[field].resolvedValue?.value.kind === "known")
      || (facts[field].state === "conflicted" && facts[field].conflictingValues.some(candidate => candidate.value.kind === "known")))
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

/** A current positive B2 answer or disputed positive alternative contradicts
 * explicit no-patient participation. False/non-known/history never establishes
 * a patient, and no status or outcome is inferred, cleared or rewritten.
 */
export function noPatientOutcomeConflictingTargets(caseState: SemanticCase): string[] {
  if (!explicitNoPatient(caseState)) return [];
  return seriousOutcomeFields.filter(field => {
    const fact = caseState.event.facts[field];
    return (fact.state === "resolved" && fact.resolvedValue?.value.kind === "known" && fact.resolvedValue.value.value === true)
      || (fact.state === "conflicted" && fact.conflictingValues.some(candidate => candidate.value.kind === "known" && candidate.value.value === true));
  }).map(field => `event:event:${field}`);
}

function explicitNoPatient(caseState: SemanticCase): boolean {
  const fact = caseState.patient.facts.involvement;
  return fact.state === "resolved" && fact.resolvedValue?.value.kind === "known" && fact.resolvedValue.value.value === "none";
}
