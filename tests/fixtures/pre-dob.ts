/** Build genuine v7–v13 payloads from current fixtures; these fields did not exist. */
export function removeBirthDateFields(c: { patient: { facts: unknown } }): void {
  const facts = c.patient.facts as Record<string, unknown>;
  delete facts.dateOfBirth;
  delete facts.a2Value;
}
