import type { ModelProposalOutput } from "../../src/domain/case/model-boundary";

export const sourceReferenceOpening = `Patient DEMO-91 is a 54-year-old woman who took ibuprofen for back pain and developed melena on 11 September 2026. I suspect ibuprofen.
Her hemoglobin was 9.1 g/dL, reference range 12 to 16, on 11 September 2026. A stool test was positive for occult blood on the same date.
Her platelet count was 82; I don’t have its units or collection date. Ferritin was tested, but I don’t have the result or date.
There was also a separate negative test, but I don’t have its name or date available.`;
export const sourceReferenceUpdate = "I’ve now located the report for the unidentified negative test. It was a Helicobacter pylori stool antigen test. Its collection date is still unavailable. Also, I misread the hemoglobin: it was 8.9 g/dL, not 9.1. The hemoglobin reference range and date were correct.";
export const omittedTestRecovery = "Please add the missing ferritin test. Ferritin was tested, but I don’t have the result or date.";

// Expected clinical facts are authored separately from passage selection.
export const sourceReferenceObservations = [
  { testName: "hemoglobin", testResult: "9.1 g/dL", lowRange: "12", highRange: "16", date: "2026-09-11" },
  { testName: "stool occult blood", testResult: "positive", date: "2026-09-11" },
  { testName: "platelet count", testResult: "82", date: null },
  { testName: "ferritin", testResult: null, date: null },
  { testName: null, testResult: "negative", date: null },
];

type Proposal = ModelProposalOutput["proposals"][number];
function fact(proposalReference: string, groupReference: string, target: Proposal["target"], value: unknown, evidenceReferences: string[], intent: Proposal["intent"] = "fact"): Proposal {
  return { proposalReference, groupReference, target, value: value === null ? { kind: "unknown" } : { kind: "known", value } as Proposal["value"], evidenceReferences, intent };
}

export function sourceReferenceOutput(): ModelProposalOutput {
  return {
    products: [{ productReference: "drug", groupReference: "drug" }],
    tests: sourceReferenceObservations.map((_, i) => ({ testReference: `t${i}`, groupReference: `t${i}` })),
    proposals: [
      fact("patient-id", "patient", { entity: "patient", field: "identifier" }, "DEMO-91", ["p1"]),
      fact("age", "patient", { entity: "patient", field: "ageYears" }, 54, ["p1"]),
      fact("sex", "patient", { entity: "patient", field: "sex" }, "female", ["p1"]),
      fact("symptoms", "event", { entity: "event", field: "symptoms" }, ["melena"], ["p1"]),
      fact("onset", "event", { entity: "event", field: "onsetDate" }, "2026-09-11", ["p1"]),
      fact("drug-name", "drug", { entity: "product", productReference: "drug", field: "name" }, "ibuprofen", ["p1"]),
      fact("drug-type", "drug", { entity: "product", productReference: "drug", field: "productType" }, "drug-or-biologic", ["p1"]),
      fact("drug-role", "drug", { entity: "product", productReference: "drug", field: "role" }, "suspect", ["p2"]),
      fact("indication", "drug", { entity: "product", productReference: "drug", field: "indication" }, "back pain", ["p1"]),
      ...sourceReferenceObservations.flatMap((observation, i) => Object.entries(observation).map(([field, value]) => fact(`t${i}-${field}`, `t${i}`, { entity: "test", testReference: `t${i}`, field: field as "testName" }, value, i === 1 && field === "date" ? ["p3", "p4"] : [`p${i + 3}`]))),
    ],
  };
}

export function sourceReferenceCorrection(hemoglobinId: string, unnamedId: string): ModelProposalOutput {
  return { products: [], proposals: [
    fact("name-correction", "name-update", { entity: "test", testReference: unnamedId, field: "testName" }, "Helicobacter pylori stool antigen", ["p1", "p2"], "correction"),
    fact("result-correction", "hemoglobin-update", { entity: "test", testReference: hemoglobinId, field: "testResult" }, "8.9 g/dL", ["p4", "p5"], "correction"),
  ] };
}

export function recoveryOutput(): ModelProposalOutput {
  return { products: [], tests: [{ testReference: "recovered", groupReference: "recovered" }], proposals: [
    fact("recovered-name", "recovered", { entity: "test", testReference: "recovered", field: "testName" }, "ferritin", ["p1", "p2"]),
    fact("recovered-result", "recovered", { entity: "test", testReference: "recovered", field: "testResult" }, null, ["p2"]),
    fact("recovered-date", "recovered", { entity: "test", testReference: "recovered", field: "date" }, null, ["p2"]),
  ] };
}
