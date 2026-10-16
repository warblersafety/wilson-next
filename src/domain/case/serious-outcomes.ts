/** Explicit native B2 outcome answers; never derived from risk or narrative text. */
export const seriousOutcomeFields = [
  "death", "lifeThreatening", "hospitalized", "disability",
  "requiredIntervention", "congenitalAnomaly", "otherSerious",
] as const;

export const seriousOutcomeLabels: Record<typeof seriousOutcomeFields[number], string> = {
  death: "Death", lifeThreatening: "Life-threatening", hospitalized: "Hospitalization",
  disability: "Disability or permanent damage", requiredIntervention: "Required intervention",
  congenitalAnomaly: "Congenital anomaly/birth defects", otherSerious: "Other serious outcome",
};
