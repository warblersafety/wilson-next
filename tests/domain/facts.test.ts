import { describe, expect, it } from "vitest";
import {
  allFacts,
  getFact,
  targetFromKey,
  targetKey,
} from "../../src/domain/case/facts";
import { acceptOpeningCase } from "./fixture";

describe("domain-owned fact targeting", () => {
  it("round-trips every fact through one typed target-key path", () => {
    const caseState = acceptOpeningCase();
    const located = allFacts(caseState);
    const keys = located.map(({ target }) => targetKey(target));

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining([
      "patient:patient:identifier",
      "event:event:problemDescription",
      "product:product-apixaban:name",
      "test:test-hemoglobin:testResult",
      "reporter:reporter:lastName",
    ]));

    for (const locatedFact of located) {
      const parsed = targetFromKey(caseState, targetKey(locatedFact.target));
      expect(parsed).toEqual(locatedFact.target);
      expect(getFact(caseState, parsed)).toBe(locatedFact.fact);
    }
  });

  it("refuses a key that does not identify a fact in the current case", () => {
    expect(() => targetFromKey(acceptOpeningCase(), "product:missing:name"))
      .toThrow("The selected case fact is unavailable");
  });
});
