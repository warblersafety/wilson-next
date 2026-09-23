import { describe, expect, it } from "vitest";
import { parseModelProposalEnvelope, type ParseModelProposalEnvelopeInput } from "../../src/domain/case/model-boundary";
import { groupingInput, ibuprofenId, preservedGroupingOutput } from "../fixtures/grouping-failure";

const candidate = (): ParseModelProposalEnvelopeInput => ({ turn: "correction", input: groupingInput, existingProductIds: [ibuprofenId], output: structuredClone(preservedGroupingOutput) });
const parse = (value = candidate()) => parseModelProposalEnvelope(value, (kind, ref) => `${kind}-${ref}`);

describe("entity-scoped update review groups", () => {
  it("replays all 15 preserved proposals unchanged except for application group identity", () => {
    const parsed = parse();
    expect(parsed.unrepresented).toEqual([]);
    expect(parsed.proposals).toHaveLength(15);
    expect(new Set(parsed.proposals.map(p => p.groupId)).size).toBe(4);
    for (const [index, proposal] of parsed.proposals.entries()) {
      const raw = preservedGroupingOutput.proposals[index];
      expect(proposal.value).toEqual(raw.value);
      expect(proposal.intent).toBe(raw.intent);
      expect(proposal.target.field).toBe(raw.target.field);
      expect(proposal.target.entity).toBe(raw.target.entity);
      expect(proposal.sourceIds).toEqual(raw.evidenceReferences.map(ref => `source-${groupingInput.id}-${ref}`));
    }
    expect(parsed.proposals[4].target).toEqual({ entity: "event", entityId: "event", field: "relevantHistory" });
    expect(parsed.proposals[4].groupId).not.toBe(parsed.proposals[0].groupId);
    expect(parsed.proposals.slice(0, 4).every(p => p.target.entityId === ibuprofenId)).toBe(true);
    expect(parsed.relevantTests).toHaveLength(2);
    for (const test of parsed.relevantTests) expect(parsed.proposals.filter(p => p.target.entityId === test.id).every(p => p.groupId === test.groupId)).toBe(true);
    for (const source of parsed.sources) expect(source.excerpt).toBe(groupingInput.text.slice(source.start, source.end));
  });

  it("separates products, existing tests, patient/event and a new test sharing a label; keeps same-entity groups distinct", () => {
    const base = preservedGroupingOutput.proposals[0];
    const targets = [
      { entity: "product", productReference: "a", field: "stopped" },
      { entity: "product", productReference: "b", field: "stopped" },
      { entity: "test", testReference: "a", field: "testResult" },
      { entity: "test", testReference: "b", field: "testResult" },
      { entity: "test", testReference: "new", field: "testResult" },
      { entity: "patient", field: "identifier" },
      { entity: "event", field: "relevantHistory" },
    ];
    const proposals = targets.map((target, i) => ({ ...base, proposalReference: `${i}`, groupReference: "shared", target, value: target.entity === "product" ? base.value : { kind: "unknown" } }));
    proposals.push({ ...proposals[0], proposalReference: "separate", groupReference: "separate" });
    const parsed = parse({ ...candidate(), existingProductIds: ["a", "b"], existingTestIds: ["a", "b"], output: { products: [], tests: [{ testReference: "new", groupReference: "shared" }], proposals } });
    expect(parsed.unrepresented).toEqual([]);
    expect(new Set(parsed.proposals.map(p => p.groupId)).size).toBe(8);
  });

  it.each(["unknown-entity", "bad-source", "bad-value"])("still quarantines %s without inheriting attribution from the group", (fault) => {
    const output = structuredClone(preservedGroupingOutput);
    if (fault === "unknown-entity") output.proposals[0].target.productReference = "ibuprofen";
    if (fault === "bad-source") output.proposals[0].evidenceReferences = ["invented"];
    if (fault === "bad-value") output.proposals[0].value = { kind: "known", value: "yes" };
    const parsed = parse({ ...candidate(), output });
    expect(parsed.proposals).toHaveLength(14);
    expect(parsed.unrepresented).toHaveLength(1);
    expect(parsed.unrepresented[0].reason).toBe({ "unknown-entity": "unresolved-entity", "bad-source": "invalid-source-reference", "bad-value": "incompatible-value" }[fault]);
  });

  it("still rejects declaration mismatches and duplicate proposal identities", () => {
    const output = structuredClone(preservedGroupingOutput);
    output.proposals[5].groupReference = "wrong-declaration";
    expect(() => parse({ ...candidate(), output })).toThrow("declared group");
    output.proposals[5].groupReference = "test-1-group";
    output.proposals[1].proposalReference = output.proposals[0].proposalReference;
    expect(() => parse({ ...candidate(), output })).toThrow("Duplicate proposalReference");
  });

  it("retains conflicting alternatives, qualifiers and multiple groups within one entity", () => {
    const base = preservedGroupingOutput.proposals[0];
    const alternatives = [true, false].map((value, index) => ({
      ...base, proposalReference: `alternative-${index}`, groupReference: "uncertain",
      intent: "alternative", value: { kind: "known", value, qualifier: "conflicting records" },
    }));
    const parsed = parse({ ...candidate(), output: { products: [], proposals: [
      ...alternatives, { ...base, proposalReference: "separate", groupReference: "other-review" },
      preservedGroupingOutput.proposals[4],
    ] } });
    expect(parsed.proposals.slice(0, 2).map(p => ({ intent: p.intent, value: p.value })))
      .toEqual(alternatives.map(p => ({ intent: p.intent, value: p.value })));
    expect(parsed.proposals[0].groupId).toBe(parsed.proposals[1].groupId);
    expect(new Set(parsed.proposals.map(p => p.groupId)).size).toBe(3);
  });

  it("cannot use a declaration label that resembles an update key to join review groups", () => {
    const output = structuredClone(preservedGroupingOutput);
    const label = JSON.stringify(["update", "product", ibuprofenId, output.proposals[0].groupReference]);
    output.tests[0].groupReference = label;
    for (const proposal of output.proposals) if (proposal.target.testReference === "test-1") proposal.groupReference = label;
    // A reference-echoing test factory collides here and must fail safely.
    expect(() => parse({ ...candidate(), output })).toThrow("invalid or duplicate group ID");
    // Production assigns opaque UUIDs independently of response labels.
    let id = 0;
    const parsed = parseModelProposalEnvelope({ ...candidate(), output }, kind => `${kind}-${++id}`);
    expect(new Set(parsed.proposals.map(p => p.groupId)).size).toBe(4);
  });
});
