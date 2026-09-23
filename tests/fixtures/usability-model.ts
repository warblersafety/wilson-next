import { medicationScenarios, medicationSparseUpdate } from "./medication-model";
import { referenceFixture } from "./source-references";

export const usabilityUpdate = `${medicationSparseUpdate} Hemoglobin was 8.9 g/dL on 11 September 2026 and 9.4 g/dL on 12 September 2026, both with reference range 12 to 16 g/dL.`;
const output = referenceFixture(usabilityUpdate, {
  products: [],
  tests: [{ testReference: "first", groupReference: "first" }, { testReference: "second", groupReference: "second" }],
  proposals: [
    ...Object.entries({ stopped: true, stopDate: "2026-09-18", improvedAfterChange: true, restarted: false }).map(([field, value]) => ({
      proposalReference: field, groupReference: "medication", intent: "fact" as const,
      target: { entity: "product" as const, productReference: "product-issue106-a", field: field as "stopped" | "stopDate" | "improvedAfterChange" | "restarted" },
      value: { kind: "known" as const, value }, evidenceQuote: usabilityUpdate,
    })),
    ...["first", "second"].flatMap((testReference, i) => Object.entries({ testName: "Hemoglobin", testResult: `${i ? "9.4" : "8.9"} g/dL`, date: `2026-09-${i ? "12" : "11"}`, lowRange: "12 g/dL", highRange: "16 g/dL" }).map(([field, value]) => ({
      proposalReference: `${testReference}-${field}`, groupReference: testReference, intent: "fact" as const,
      target: { entity: "test" as const, testReference, field: field as "testName" | "testResult" | "date" | "lowRange" | "highRange" },
      value: { kind: "known" as const, value }, evidenceQuote: usabilityUpdate,
    }))),
  ],
});

export const usabilityScenario = [
  { ...medicationScenarios.issue92Sparse[0], identityScope: "issue106" },
  { identityScope: "issue106-update", turn: "correction" as const, output },
];
