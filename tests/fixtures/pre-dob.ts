/** Build genuine v7–v13 payloads from current fixtures; these fields did not exist. */
export function removeBirthDateFields(c: { patient: { facts: unknown }; products?: Array<{ facts: unknown }> }): void {
  const facts = c.patient.facts as Record<string, unknown>;
  removeOngoingFields(c);
  delete facts.dateOfBirth;
  delete facts.a2Value;
  delete facts.raceEthnicity;
}

/** A5 selections did not exist in v14 or earlier. */
export function removeRaceEthnicityField(c: { patient: { facts: unknown }; products?: Array<{ facts: unknown }> }): void {
  removeOngoingFields(c);
  delete (c.patient.facts as Record<string, unknown>).raceEthnicity;
}

export function removeOngoingFields(c: { products?: Array<{ facts: unknown }> }): void {
  removeReductionDateFields(c);
  for (const p of c.products ?? []) delete (p.facts as Record<string, unknown>).therapyOngoing;
}

export function removeReductionDateFields(c: { products?: Array<{ facts: unknown }> }): void {
  removeDurationFields(c);
  for (const p of c.products ?? []) delete (p.facts as Record<string, unknown>).doseReductionDate;
}

export function removePurchaseDateFields(c: {products?: Array<{facts: unknown}>}): void {
 for (const p of c.products ?? []) delete (p.facts as Record<string,unknown>).purchaseDate;
}

export function removeDurationFields(c: {products?: Array<{facts: unknown}>}): void {
 removePurchaseDateFields(c);
 for (const p of c.products ?? []) { delete (p.facts as Record<string,unknown>).treatmentDuration; delete (p.facts as Record<string,unknown>).d3Value; }
}
