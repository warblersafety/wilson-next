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

export function removePurchaseDetailsFields(c: {event?: {facts: unknown}; patient?: {facts: unknown}; products?: Array<{facts: unknown}>}): void {
 if(c.event)delete (c.event.facts as Record<string,unknown>).additionalComments;
 if(c.patient)delete (c.patient.facts as Record<string,unknown>).involvement;
 for(const p of c.products??[])for(const f of ["purchaseSellerName", "purchaseSellerAddress", "purchaseSellerCity", "purchaseSellerRegion", "purchaseSellerPostalCode", "purchaseSellerCountry", "purchaseWebsite"])delete (p.facts as Record<string,unknown>)[f];
}

export function removeCosmeticUseFields(c: {event?: {facts: unknown}; patient?: {facts: unknown}; products?: Array<{facts: unknown}>}): void {
 removePurchaseDetailsFields(c);
 for (const p of c.products ?? []) delete (p.facts as Record<string,unknown>).cosmeticUse;
}

export function removePurchaseDateFields(c: {event?: {facts: unknown}; patient?: {facts: unknown}; products?: Array<{facts: unknown}>}): void {
 removeCosmeticUseFields(c);
 for (const p of c.products ?? []) delete (p.facts as Record<string,unknown>).purchaseDate;
}

export function removeDurationFields(c: {event?: {facts: unknown}; patient?: {facts: unknown}; products?: Array<{facts: unknown}>}): void {
 removePurchaseDateFields(c);
 for (const p of c.products ?? []) { delete (p.facts as Record<string,unknown>).treatmentDuration; delete (p.facts as Record<string,unknown>).d3Value; }
}
