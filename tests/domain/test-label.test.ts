import { describe, expect, it } from "vitest";
import { testDisplayLabel } from "../../src/domain/case/test-label";
import type { FactView, RelevantTestView } from "../../src/domain/case/views";

const known = (value: string) => ({ kind: "known" as const, value });
function fact(resolved?: FactView["resolved"], proposed?: FactView["resolved"]): FactView {
  return { state: resolved ? "resolved" : "empty", resolved, proposals: proposed ? [{ id: "p", groupId: "stable-group", intent: "fact", value: proposed, evidence: [] }] : [], conflicts: [], history: [], evidence: [] };
}
function observation(name = fact(known("Hemoglobin")), date = fact(known("2026-09-11"))): RelevantTestView {
  return { id: "stable-test", proposalGroupId: "stable-group", state: "resolved", facts: { testName: name, date } };
}

describe("test display labels", () => {
  it("uses supplied clinical name/date and distinguishes identical serial observations", () => {
    const test = observation(); const before = structuredClone(test);
    expect(testDisplayLabel(test, 1)).toBe("Hemoglobin — 11-Sep-2026 (test 1)");
    expect(testDisplayLabel(test, 2)).toBe("Hemoglobin — 11-Sep-2026 (test 2)");
    expect(testDisplayLabel(observation(fact(known("Creatine kinase"))), 3)).toBe("Creatine kinase — 11-Sep-2026 (test 3)");
    expect(test).toEqual(before);
  });
  it("uses initial proposed facts but keeps accepted name/date during pending corrections", () => {
    expect(testDisplayLabel({ ...observation(fact(undefined, known("ALT")), fact()), state: "proposed" }, 1)).toBe("ALT (test 1)");
    expect(testDisplayLabel(observation(fact(known("ALT"), known("AST")), fact(known("2026-09-11"), known("2026-09-12"))), 1)).toBe("ALT — 11-Sep-2026 (test 1)");
  });
  it("does not invent an identity from missing, unknown, declined, absent or conflicted facts", () => {
    for (const value of [undefined, { kind: "unknown" as const }, { kind: "declined" as const }, { kind: "explicitly-absent" as const }, known("   ")]) {
      expect(testDisplayLabel(observation(fact(value)), 2)).toBe("Relevant test 2");
    }
    const name = fact(known("ALT")); name.conflicts = [{ id: "c", value: known("AST"), evidence: [] }];
    expect(testDisplayLabel(observation(name), 2)).toBe("Relevant test 2");
    expect(testDisplayLabel(undefined, 3)).toBe("Relevant test 3");
  });
  it("does not promote later update names/dates on accepted or withdrawn cards", () => {
    for (const state of ["resolved", "withdrawn"] as const) {
      const test = { ...observation(fact(undefined, known("ALT")), fact(undefined, known("2026-09-12"))), state };
      expect(testDisplayLabel(test, 1)).toBe("Relevant test 1");
      test.facts.testName = fact(known("ALT"));
      expect(testDisplayLabel(test, 1)).toBe("ALT (test 1)");
    }
    const test = { ...observation(fact(undefined, known("ALT")), fact()), state: "proposed" as const };
    test.facts.testName.proposals[0].groupId = "later-update";
    expect(testDisplayLabel(test, 1)).toBe("Relevant test 1");
  });
  it("preserves long names and omits unavailable/conflicted dates", () => {
    const name = "A supplied laboratory name ".repeat(20).trim();
    const date = fact(known("2026-09-11")); date.conflicts = [{ id: "c", value: known("2026-09-12"), evidence: [] }];
    expect(testDisplayLabel(observation(fact(known(name)), date), 1)).toBe(`${name} (test 1)`);
  });
});
