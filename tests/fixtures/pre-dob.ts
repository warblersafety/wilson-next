/** Build genuine v7–v13 payloads from current fixtures; these fields did not exist. */
export function removeBirthDateFields(c: { patient: { facts: unknown } }): void {
  const facts = c.patient.facts as Record<string, unknown>;
  delete facts.dateOfBirth;
  delete facts.a2Value;
  delete facts.raceEthnicity;
}

/** A5 selections did not exist in v14 or earlier. */
export function removeRaceEthnicityField(c: { patient: { facts: unknown } }): void {
  delete (c.patient.facts as Record<string, unknown>).raceEthnicity;
}
