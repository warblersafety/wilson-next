import { describe, expect, it } from "vitest";
import { factControlRegistry } from "../../app/fact-controls";
import { productCardFieldUniverse, productCardFields } from "../../app/product-fields";
import { caseValueContracts } from "../../src/domain/case/value-contract";
import type { FactView } from "../../src/domain/case/views";

describe("direct fact controls", () => {
  it("covers every currently supported fact key without becoming value authority", () => {
    for (const entity of Object.keys(caseValueContracts) as Array<keyof typeof caseValueContracts>) {
      expect(Object.keys(factControlRegistry[entity]).sort()).toEqual(
        Object.keys(caseValueContracts[entity]).sort(),
      );
    }
  });

  it("uses a matching typed input shape for each domain-owned value contract", () => {
    for (const entity of Object.keys(caseValueContracts) as Array<keyof typeof caseValueContracts>) {
      for (const [field, contract] of Object.entries(caseValueContracts[entity])) {
        const control = (factControlRegistry[entity] as Record<string, { shape: string }>)[field];
        const expected = contract.shape === "string" ? "text"
          : contract.shape === "iso-date" ? "date"
          : contract.shape === "integer" ? "age"
          : contract.shape === "string-array" ? "list"
          : contract.shape === "measurement" ? "weight"
          : contract.shape === "enum-array" ? "choices"
          : contract.shape === "enum" ? "choice"
          : "boolean";
        expect(control.shape, `${entity}.${field}`).toBe(expected);
      }
    }
  });

  it("provides clinician-facing labels for every enum choice", () => {
    for (const controls of Object.values(factControlRegistry)) {
      for (const control of Object.values(controls)) {
        for (const option of control.options ?? []) {
          expect(option.label).not.toBe(option.value);
          expect(option.label).not.toMatch(/^[a-z]+-[a-z-]+$/);
        }
      }
    }
  });

  it("keeps every supported product fact renderable across category-aware cards", () => {
    expect([...productCardFieldUniverse].sort()).toEqual(Object.keys(caseValueContracts.product).sort());

    const facts = Object.fromEntries(Object.keys(caseValueContracts.product).map((field) => [field, emptyFactView()]));
    facts.dose = resolvedFactView("500 mg");
    facts.modelNumber = resolvedFactView("FG-200");
    expect(productCardFields(undefined, facts)).toEqual(expect.arrayContaining(["name", "productType", "role", "dose", "modelNumber"]));
    expect(productCardFields("device", facts)).toContain("dose");
    expect(productCardFields("drug-or-biologic", facts)).toContain("modelNumber");
  });
});

function emptyFactView(): FactView {
  return { state: "empty", proposals: [], conflicts: [], history: [], evidence: [] };
}

function resolvedFactView(value: string): FactView {
  return { ...emptyFactView(), state: "resolved", resolved: { kind: "known", value } };
}
