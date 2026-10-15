import { describe, expect, it } from "vitest";
import { modelProposalOutputForExistingTests, parseModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import { firstSerialTestId, secondSerialTestId, mixedSerialText, serialCorrectionText, serialOutput } from "../fixtures/serial-test-correction";

const ids = [firstSerialTestId, secondSerialTestId];
const identities = (kind: string, reference: string) => `${kind}-contract-${reference}`;
const parse = (output: unknown, text = serialCorrectionText) => parseModelProposalEnvelope({ turn: "correction", input: { id: "contract-input", type: "correction", text, recordedAt: "2026-09-20T12:00:00.000Z" }, existingTestIds: ids, output }, identities);

describe("request-owned existing-test correction contract", () => {
  it("admits exact existing targets and a genuine mixed addition without requiring names", () => {
    const schema = modelProposalOutputForExistingTests(ids);
    expect(schema.safeParse(serialOutput()).success).toBe(true);
    expect(schema.safeParse(serialOutput(mixedSerialText, secondSerialTestId, true)).success).toBe(true);
    expect(modelProposalOutputForExistingTests([]).safeParse(serialOutput()).success).toBe(false);
    const addition = serialOutput(mixedSerialText, secondSerialTestId, true);
    addition.proposals = addition.proposals.filter(proposal => proposal.intent === "fact");
    expect(modelProposalOutputForExistingTests([]).safeParse(addition).success).toBe(true);
  });
  it.each(["invented", `${secondSerialTestId}-typo`])("a declaration cannot make correction reference %s an allowed target", reference => {
    const output = serialOutput(serialCorrectionText, reference);
    expect(modelProposalOutputForExistingTests(ids).safeParse(output).success).toBe(false);
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
