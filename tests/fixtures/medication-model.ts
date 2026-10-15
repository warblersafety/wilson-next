import { referenceFixture, type QuotedFixtureOutput } from "./source-references";
import type { ProductFactKey } from "../../src/domain/case/types";

export const medicationSparseOpening = "Fictional patient MED-40 is 40 years old and developed a rash while taking amoxicillin for an infection. I suspect amoxicillin. No serious outcomes applied, and there are no relevant tests or additional medical history.";
export const medicationSparseUpdate = "Amoxicillin was stopped on 18 September 2026. The rash improved after stopping it. Amoxicillin was never restarted.";
export const medicationTwoOpening = "Fictional patient MED-55 is 55 years old and developed a rash. I suspect amoxicillin for infection and naproxen for joint pain. The generic amoxicillin was stopped on 17 September 2026; the rash improved after stopping, and returned after amoxicillin was restarted. The over-the-counter generic naproxen was not stopped, but its dose was reduced. The rash did not improve after that reduction. Naproxen was never restarted. No serious outcomes applied, and there are no relevant tests or additional medical history.";
export const medicationNeverRestarted = "Correction: amoxicillin was never restarted. My earlier statement about restarting it was wrong.";
export const medicationRestartedAgain = "Correction: amoxicillin actually was restarted. I withdraw my statement that it was never restarted.";

export const expirationOpening = medicationTwoOpening + " Amoxicillin expires on 29 February 2028; naproxen expires on 31 December 2027.";
export const expirationCorrection = "Correction: the naproxen expiration date is 30 November 2029, not 31 December 2027.";

export const identifierOpening = expirationOpening + " The amoxicillin label NDC is 00123-0045-06; the naproxen label NDC is 00045-0067-08.";
export const identifierCorrection = "Correction: the naproxen label NDC is 00045-0067-09, not 00045-0067-08.";

export const ageOpening = medicationTwoOpening.replace("MED-55 is 55 years old", "AGE-M24 is 24 months old");
export const ageCorrection = "Correction: this fictional patient was 5 days old at event onset, not 24 months. Do not calculate age from any dates.";

export const ageWeeksOpening = ageOpening.replace("AGE-M24 is 24 months old", "AGE-W6 is 6 weeks old at event onset");
export const ageWeeksCorrection = "Correction: this fictional patient was 7 weeks old at event onset, not 6 weeks. Preserve weeks without date or unit calculations.";

export const birthDateOpening = medicationTwoOpening.replace("MED-55 is 55 years old", "DOB-29 was born on 29 February 2024");
export const birthDateCorrection = "Correction: the fictional patient date of birth was 28 February 2023, not 29 February 2024. Do not calculate age.";

export const raceEthnicityOpening = medicationTwoOpening.replace("MED-55", "A5-55") + " The clinician reports the patient self-described race and ethnicity as Asian and Hispanic or Latino.";
export const raceEthnicityCorrection = "Correction: the complete patient-reported A5 selection is Middle Eastern or North African and White. The earlier Asian and Hispanic or Latino entries were incorrect.";

export const ongoingOpening = medicationTwoOpening + " Amoxicillin therapy is still ongoing after the reported restart. Naproxen therapy is explicitly not ongoing.";
export const ongoingCorrection = "Correction: amoxicillin therapy is not ongoing now. Keep the previously supplied treatment dates and historical restart.";

function opening(two: boolean, expiration = false, identifier = false, ageUnits: boolean | "weeks" | "birth-date" | "race-ethnicity" | "ongoing" = false) {
  const text = ageUnits === "ongoing" ? ongoingOpening : ageUnits === "race-ethnicity" ? raceEthnicityOpening : ageUnits === "birth-date" ? birthDateOpening : ageUnits === "weeks" ? ageWeeksOpening : ageUnits ? ageOpening : identifier ? identifierOpening : expiration ? expirationOpening : two ? medicationTwoOpening : medicationSparseOpening;
  const proposals: QuotedFixtureOutput["proposals"] = [];
  const add = (target: QuotedFixtureOutput["proposals"][number]["target"], value: unknown, group: string) => {
    proposals.push({ proposalReference: `p${proposals.length}`, groupReference: group, intent: "fact", target,
      value: { kind: "known", value } as QuotedFixtureOutput["proposals"][number]["value"], evidenceQuote: text });
  };
  add({ entity: "patient", field: "identifier" }, ageUnits === "race-ethnicity" ? "A5-55" : ageUnits === "birth-date" ? "DOB-29" : ageUnits === "weeks" ? "AGE-W6" : ageUnits ? "AGE-M24" : two ? "MED-55" : "MED-40", "patient");
  if (ageUnits === "birth-date") add({ entity: "patient", field: "dateOfBirth" }, "2024-02-29", "patient");
  else add({ entity: "patient", field: "ageYears" }, ageUnits === "weeks" ? { value: 6, unit: "weeks" } : ageUnits === true ? { value: 24, unit: "months" } : two ? 55 : 40, "patient");
  if (ageUnits === "race-ethnicity") add({ entity: "patient", field: "raceEthnicity" }, ["asian", "hispanic-latino"], "patient");
  add({ entity: "event", field: "symptoms" }, ["rash"], "event");
  for (const field of ["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious", "relevantTestsAvailable"] as const) add({ entity: "event", field }, false, "event");
  proposals.push({ proposalReference: "history", groupReference: "event", intent: "fact", target: { entity: "event", field: "relevantHistory" }, value: { kind: "explicitly-absent" }, evidenceQuote: text });
  const product = (reference: string, values: Record<string, unknown>) => {
    for (const [field, value] of Object.entries(values)) add({ entity: "product", productReference: reference, field: field as ProductFactKey }, value, reference);
  };
  product("a", { name: "amoxicillin", productType: "drug-or-biologic", role: "suspect", indication: "infection", ...(two ? {
    ...(identifier ? { ndcOrUniqueId: "00123-0045-06" } : {}), ...(expiration ? { expirationDate: "2028-02-29" } : {}), medicationType: ["generic-biosimilar"], stopped: true, stopDate: "2026-09-17", improvedAfterChange: true, restarted: true, recurred: true,
  } : {}) });
  if (two) product("b", { name: "naproxen", productType: "drug-or-biologic", role: "suspect", indication: "joint pain", ...(identifier ? { ndcOrUniqueId: "00045-0067-08" } : {}), ...(expiration ? { expirationDate: "2027-12-31" } : {}), medicationType: ["generic-biosimilar", "otc"], stopped: false, doseReduced: true, improvedAfterChange: false, restarted: false });
  if (ageUnits === "ongoing") { product("a", { therapyOngoing: true }); product("b", { therapyOngoing: false }); }
  return referenceFixture(text, { products: (two ? ["a", "b"] : ["a"]).map((reference) => ({ productReference: reference, groupReference: reference })), proposals });
}

function update(text: string, productReference: string, values: Record<string, unknown>) {
  return referenceFixture(text, { products: [], proposals: Object.entries(values).map(([field, value], i) => ({
    proposalReference: `update-${i}`, groupReference: "update-medication", intent: "correction", target: { entity: "product", productReference, field }, value: { kind: "known", value }, evidenceQuote: text,
  })) });
}

export const medicationScenarios = {
  issue92Sparse: [
    { identityScope: "issue92-sparse", turn: "opening" as const, output: opening(false) },
    { identityScope: "issue92-sparse-update", turn: "correction" as const, output: update(medicationSparseUpdate, "product-issue92-sparse-a", { stopped: true, stopDate: "2026-09-18", improvedAfterChange: true, restarted: false }) },
  ],
  issue92Two: [
    { identityScope: "issue92-two", turn: "opening" as const, output: opening(true) },
    { identityScope: "issue92-never", turn: "correction" as const, output: update(medicationNeverRestarted, "product-issue92-two-a", { restarted: false }) },
    { identityScope: "issue92-again", turn: "correction" as const, output: update(medicationRestartedAgain, "product-issue92-two-a", { restarted: true }) },
  ],
  ongoingTherapy: [
    { identityScope: "ongoing-therapy", turn: "opening" as const, output: opening(true, false, false, "ongoing") },
    { identityScope: "ongoing-therapy-update", turn: "correction" as const, output: update(ongoingCorrection, "product-ongoing-therapy-a", { therapyOngoing: false }) },
  ],
  patientAge: [
    { identityScope: "patient-age", turn: "opening" as const, output: opening(true, false, false, true) },
    { identityScope: "patient-age-update", turn: "correction" as const, output: referenceFixture(ageCorrection, { products: [], proposals: [{ proposalReference: "age-correction", groupReference: "age-update", intent: "correction", target: { entity: "patient", field: "ageYears" }, value: { kind: "known", value: { value: 5, unit: "days" } }, evidenceQuote: ageCorrection }] }) },
  ],
  patientAgeWeeks: [
    { identityScope: "patient-age-weeks", turn: "opening" as const, output: opening(true, false, false, "weeks") },
    { identityScope: "patient-age-weeks-update", turn: "correction" as const, output: referenceFixture(ageWeeksCorrection, { products: [], proposals: [{ proposalReference: "weeks-correction", groupReference: "weeks-update", intent: "correction", target: { entity: "patient", field: "ageYears" }, value: { kind: "known", value: { value: 7, unit: "weeks" } }, evidenceQuote: ageWeeksCorrection }] }) },
  ],
  patientBirthDate: [
    { identityScope: "patient-birth-date", turn: "opening" as const, output: opening(true, false, false, "birth-date") },
    { identityScope: "patient-birth-date-update", turn: "correction" as const, output: referenceFixture(birthDateCorrection, { products: [], proposals: [{ proposalReference: "dob-correction", groupReference: "dob-update", intent: "correction", target: { entity: "patient", field: "dateOfBirth" }, value: { kind: "known", value: "2023-02-28" }, evidenceQuote: birthDateCorrection }] }) },
  ],
  patientRaceEthnicity: [
    { identityScope: "patient-race-ethnicity", turn: "opening" as const, output: opening(true, false, false, "race-ethnicity") },
    { identityScope: "patient-race-ethnicity-update", turn: "correction" as const, output: referenceFixture(raceEthnicityCorrection, { products: [], proposals: [{ proposalReference: "a5-correction", groupReference: "a5-update", intent: "correction", target: { entity: "patient", field: "raceEthnicity" }, value: { kind: "known", value: ["middle-eastern-north-african", "white"] }, evidenceQuote: raceEthnicityCorrection }] }) },
  ],
  productExpiration: [
    { identityScope: "expiration", turn: "opening" as const, output: opening(true, true) },
    { identityScope: "expiration-update", turn: "correction" as const, output: update(expirationCorrection, "product-expiration-b", { expirationDate: "2029-11-30" }) },
  ],
  productIdentifier: [
    { identityScope: "identifier", turn: "opening" as const, output: opening(true, true, true) },
    { identityScope: "identifier-update", turn: "correction" as const, output: update(identifierCorrection, "product-identifier-b", { ndcOrUniqueId: "00045-0067-09" }) },
  ],
};
