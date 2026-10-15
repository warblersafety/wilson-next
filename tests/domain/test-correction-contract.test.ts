import { describe, expect, it } from "vitest";
import { parseModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import { firstSerialTestId, secondSerialTestId, mixedSerialText, serialCorrectionText, serialOutput } from "../fixtures/serial-test-correction";

const ids = [firstSerialTestId, secondSerialTestId];
const identities = (kind: string, reference: string) => `${kind}-contract-${reference}`;
const parse = (output: unknown, text = serialCorrectionText, existingTestIds = ids) => parseModelProposalEnvelope({ turn: "correction", input: { id: "contract-input", type: "correction", text, recordedAt: "2026-09-20T12:00:00.000Z" }, existingTestIds, output }, identities);

describe("existing-test correction allocation boundary", () => {
  it("retains correct existing-ID corrections and genuine additions, including the first later observation", () => {
    expect(parse(serialOutput()).proposals[0].target.entityId).toBe(secondSerialTestId);
    expect(parse(serialOutput(mixedSerialText, secondSerialTestId, true), mixedSerialText).relevantTests).toHaveLength(1);
    const addition = serialOutput(mixedSerialText, secondSerialTestId, true);
    addition.proposals = addition.proposals.filter(proposal => proposal.intent === "fact");
    expect(parse(addition, mixedSerialText, []).relevantTests).toHaveLength(1);
  });
  it.each(["invented", `${secondSerialTestId}-typo`])("a declaration cannot make correction reference %s an allowed target", reference => {
    const output = serialOutput(serialCorrectionText, reference);
    expect(() => parse(output)).toThrow("Every proposal was unrepresentable");
  });
  it("quarantines all dependent facts of a bad correction declaration, retaining a genuine independent addition", () => {
    const output = serialOutput(mixedSerialText, "invented", true);
    output.proposals.push({ ...output.proposals[0], proposalReference: "invented-name", intent: "fact", target: { entity: "test", testReference: "invented", field: "testName" }, value: { kind: "known", value: "hemoglobin" } });
    const result = parse(output, mixedSerialText);
    expect(result.relevantTests).toHaveLength(1);
    expect(result.relevantTests[0].id).toBe("test-contract-additional");
    expect(result.proposals).toHaveLength(3);
    expect(result.unrepresented).toHaveLength(2);
    expect(result.unrepresented.every(p => p.reason === "unresolved-entity")).toBe(true);
  });
  it("preserves exact IDs even when echoed in declarations and assigns independent addition groups", () => {
    const output = serialOutput(mixedSerialText, secondSerialTestId, true);
    output.tests!.push({ testReference: secondSerialTestId, groupReference: "redundant-existing" });
    const result = parse(output, mixedSerialText);
    expect(result.proposals[0].target.entityId).toBe(secondSerialTestId);
    expect(result.relevantTests).toHaveLength(1);
    expect(result.proposals[0].groupId).not.toBe(result.relevantTests[0].groupId);
    expect(result.unrepresented).toEqual([]);
  });
});
