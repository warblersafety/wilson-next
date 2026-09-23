import { describe, expect, it } from "vitest";
import { parseModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import protocol from "../../evidence/issue-94/live-protocol.json";
import doseOnly from "../../evidence/issue-94/retained-dose-only-model.json";
import tablets from "../../evidence/issue-94/retained-tablets-model.json";

const parse = (output: unknown, text = protocol.cases[0].text) => {
  let group = 0;
  return parseModelProposalEnvelope({
  turn: "opening", input: { id: "fidelity-input", type: "narrative", text, recordedAt: "2026-09-23T20:06:44.000Z" }, output,
}, (kind, ref) => kind === "group" ? `group-${group++}-${ref}` : `${kind}-${ref}`);
};

describe("first-pass opening fidelity responses", () => {
  it.each([[doseOnly, 0], [tablets, 1]] as const)("replays retained response %# unchanged into separate patient, event and product review", (output, index) => {
    const text = protocol.cases[index].text;
    const result = parse(output, text);
    expect(result.unrepresented).toEqual([]);
    expect(result.proposals).toHaveLength(output.proposals.length);
    expect(new Set(result.proposals.map(p => p.groupId)).size).toBe(3);
    for (const [i, p] of result.proposals.entries()) {
      expect(p.value).toEqual(output.proposals[i].value);
      expect(p.intent).toBe(output.proposals[i].intent);
      expect(p.target.field).toBe(output.proposals[i].target.field);
      expect(p.target.entity).toBe(output.proposals[i].target.entity);
      expect(p.sourceIds).toEqual(output.proposals[i].evidenceReferences.map(ref => `source-fidelity-input-${ref}`));
    }
    for (const s of result.sources) expect(s.excerpt).toBe(text.slice(s.start, s.end));
    expect(result.proposals.find(p => p.target.field === "symptoms")?.value).toEqual({ kind: "known", value: [index ? "abdominal pain" : "rash"] });
    expect(result.proposals.some(p => p.target.field === "problemDescription")).toBe(false);
    expect(result.proposals.find(p => p.target.field === "dose")?.value).toEqual({ kind: "known", value: index ? "two tablets, a total dose of 500 mg" : "500 mg" });
  });

  it("does not assign an unresolved product by its shared label, and retains invalid-source/value quarantine", () => {
    const output = structuredClone(doseOnly);
    const product = output.proposals.find(p => p.target.field === "dose")!;
    product.target.productReference = "not-declared";
    expect(() => parse(output)).toThrow("cannot span different case entities");
    product.groupReference = "unresolved";
    output.proposals.find(p => p.target.field === "onsetDate")!.evidenceReferences = ["not-a-passage"];
    output.proposals.find(p => p.target.field === "symptoms")!.value = { kind: "known", value: "rash" } as never;
    const result = parse(output);
    expect(result.unrepresented.map(p => p.reason).sort()).toEqual(["incompatible-value", "invalid-source-reference", "unresolved-entity"]);
    expect(result.proposals.some(p => ["dose", "onsetDate", "symptoms"].includes(p.target.field))).toBe(false);
  });

  it("still rejects mismatched declarations, shared declared product/test labels and duplicate identities", () => {
    const mismatch = structuredClone(doseOnly);
    mismatch.proposals.find(p => p.target.entity === "product")!.groupReference = "wrong";
    expect(() => parse(mismatch)).toThrow("must use their declared group");
    const spanning = structuredClone(doseOnly);
    spanning.tests.push({ testReference: "new-test", groupReference: "g1" } as never);
    spanning.proposals.push({ proposalReference: "new", groupReference: "g1", intent: "fact", target: { entity: "test", testReference: "new-test", field: "testName" }, value: { kind: "unknown" }, evidenceReferences: ["p1"] } as never);
    expect(() => parse(spanning)).toThrow("cannot span different case entities");
    const duplicate = structuredClone(doseOnly);
    duplicate.proposals.push(duplicate.proposals[0]);
    expect(() => parse(duplicate)).toThrow("Duplicate proposalReference");
  });
});
