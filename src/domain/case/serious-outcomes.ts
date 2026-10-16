/** Explicit native B2 outcome answers; never derived from risk or narrative text. */
export const seriousOutcomeFields = [
  "death", "lifeThreatening", "hospitalized", "disability",
  "requiredIntervention", "congenitalAnomaly", "otherSerious",
] as const;
