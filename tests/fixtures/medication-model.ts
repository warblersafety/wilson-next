import { referenceFixture, type QuotedFixtureOutput } from "./source-references";
import type { ProductFactKey } from "../../src/domain/case/types";

export const medicationSparseOpening = "Fictional patient MED-40 is 40 years old and developed a rash while taking amoxicillin for an infection. I suspect amoxicillin. No serious outcomes applied, and there are no relevant tests or additional medical history.";
export const medicationSparseUpdate = "Amoxicillin was stopped on 18 September 2026. The rash improved after stopping it. Amoxicillin was never restarted.";
export const medicationTwoOpening = "Fictional patient MED-55 is 55 years old and developed a rash. I suspect amoxicillin for infection and naproxen for joint pain. The generic amoxicillin was stopped on 17 September 2026; the rash improved after stopping, and returned after amoxicillin was restarted. The over-the-counter generic naproxen was not stopped, but its dose was reduced. The rash did not improve after that reduction. Naproxen was never restarted. No serious outcomes applied, and there are no relevant tests or additional medical history.";
export const medicationNeverRestarted = "Correction: amoxicillin was never restarted. My earlier statement about restarting it was wrong.";
export const medicationRestartedAgain = "Correction: amoxicillin actually was restarted. I withdraw my statement that it was never restarted.";

function opening(two: boolean) {
  const text = two ? medicationTwoOpening : medicationSparseOpening;
  const proposals: QuotedFixtureOutput["proposals"] = [];
  const add = (target: QuotedFixtureOutput["proposals"][number]["target"], value: unknown, group: string) => {
    proposals.push({ proposalReference: `p${proposals.length}`, groupReference: group, intent: "fact", target,
      value: { kind: "known", value } as QuotedFixtureOutput["proposals"][number]["value"], evidenceQuote: text });
  };
  add({ entity: "patient", field: "identifier" }, two ? "MED-55" : "MED-40", "patient");
  add({ entity: "patient", field: "ageYears" }, two ? 55 : 40, "patient");
  add({ entity: "event", field: "symptoms" }, ["rash"], "event");
  for (const field of ["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious", "relevantTestsAvailable"] as const) add({ entity: "event", field }, false, "event");
  proposals.push({ proposalReference: "history", groupReference: "event", intent: "fact", target: { entity: "event", field: "relevantHistory" }, value: { kind: "explicitly-absent" }, evidenceQuote: text });
  const product = (reference: string, values: Record<string, unknown>) => {
    for (const [field, value] of Object.entries(values)) add({ entity: "product", productReference: reference, field: field as ProductFactKey }, value, reference);
  };
  product("a", { name: "amoxicillin", productType: "drug-or-biologic", role: "suspect", indication: "infection", ...(two ? {
    medicationType: ["generic-biosimilar"], stopped: true, stopDate: "2026-09-17", improvedAfterChange: true, restarted: true, recurred: true,
  } : {}) });
  if (two) product("b", { name: "naproxen", productType: "drug-or-biologic", role: "suspect", indication: "joint pain", medicationType: ["generic-biosimilar", "otc"], stopped: false, doseReduced: true, improvedAfterChange: false, restarted: false });
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
};
