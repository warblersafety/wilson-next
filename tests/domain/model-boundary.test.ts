import { describe, expect, it } from "vitest";
import { parseModelProposalEnvelope } from "../../src/domain/case/model-boundary";

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    input: {
      id: "input-1",
      type: "narrative",
      text: "Patient TEST-57",
      recordedAt: "2026-09-05T20:00:00.000Z",
    },
    products: [],
    proposals: [{
      proposalId: "proposal-1",
      groupId: "patient",
      intent: "fact",
      target: { entity: "patient", entityId: "patient", field: "identifier" },
      value: { kind: "known", value: "TEST-57" },
      source: { id: "source-1", start: 8, end: 15 },
    }],
    ...overrides,
  };
}

describe("model proposal boundary", () => {
  it("derives exact source excerpts from validated input offsets", () => {
    const parsed = parseModelProposalEnvelope(envelope());
    expect(parsed.sources).toEqual([{
      id: "source-1",
      inputId: "input-1",
      inputType: "narrative",
      excerpt: "TEST-57",
      start: 8,
      end: 15,
      actor: "clinician",
      recordedAt: "2026-09-05T20:00:00.000Z",
    }]);
    expect(parsed.proposals[0].sourceIds).toEqual(["source-1"]);
  });

  it("rejects malformed spans before review", () => {
    const malformed = envelope();
    (malformed.proposals[0].source as { end: number }).end = 99;
    expect(() => parseModelProposalEnvelope(malformed)).toThrow("Invalid source span");
  });

  it("rejects a value whose runtime type does not match its semantic target", () => {
    const malformed = envelope();
    (malformed.proposals[0] as { value: unknown }).value = { kind: "known", value: 57 };
    expect(() => parseModelProposalEnvelope(malformed)).toThrow("identifier requires a string");
  });

  it("rejects a reused source ID that points to different excerpts", () => {
    const malformed = envelope();
    malformed.proposals.push({
      ...malformed.proposals[0],
      proposalId: "proposal-2",
      source: { id: "source-1", start: 0, end: 7 },
    });
    expect(() => parseModelProposalEnvelope(malformed)).toThrow("identifies different excerpts");
  });

  it("rejects a malformed semantic date", () => {
    const malformed = envelope();
    malformed.proposals[0] = {
      ...malformed.proposals[0],
      target: { entity: "event", entityId: "event", field: "onsetDate" },
      value: { kind: "known", value: "18-Aug-2026" },
    } as typeof malformed.proposals[number];
    expect(() => parseModelProposalEnvelope(malformed)).toThrow("requires an ISO calendar date");
  });
});
