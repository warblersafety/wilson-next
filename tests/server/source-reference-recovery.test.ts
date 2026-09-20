import { describe, expect, it } from "vitest";
import { sourcePassages } from "../../src/domain/case/source-passages";
import { parseModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import { createAnthropicJourneyModel, createAnthropicRequest } from "../../src/server/model/anthropic-journey";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { journeyResponse, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { performJourneyAction } from "../../src/server/journey/service";
import { omittedTestRecovery, recoveryOutput, sourceReferenceCorrection, sourceReferenceObservations, sourceReferenceOpening, sourceReferenceOutput, sourceReferenceUpdate } from "../fixtures/source-reference-case";
import type { ModelProposalOutput } from "../../src/domain/case/model-boundary";

const time = "2026-09-20T12:00:00.000Z";
const ids = (kind: string, reference: string) => `${kind}-${reference}`;
function parse(text: string, output: ModelProposalOutput) {
  return parseModelProposalEnvelope({ turn: "opening", input: { id: "input", type: "narrative", text, recordedAt: time }, output }, ids);
}
function model(outputs: ModelProposalOutput[]) {
  let call = 0;
  return createAnthropicJourneyModel(async () => ({
    id: `response-${call++}`, model: "synthetic", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(outputs.shift()) }],
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  }));
}

describe("source references and conversational recovery", () => {
  it("uses references across the actual JSON provider boundary and preserves original punctuation and literal text without decoding values", async () => {
    const text = 'The patient’s result was 4 µg/L at 38 °C (range 2–6). The note literally says \\u2019 and \\u00b5; don’t decode it.';
    const output: ModelProposalOutput = { products: [], proposals: [{ proposalReference: "p", groupReference: "event", intent: "fact", target: { entity: "event", field: "problemDescription" }, value: { kind: "known", value: String.raw`literal \u2019` }, evidenceReferences: ["p1", "p2"] }] };
    const request = createAnthropicRequest("opening", text);
    expect(JSON.stringify(request.output_config.format.schema)).not.toContain("evidenceQuote");
    expect(request.messages[0].content).toContain('"reference":"p2"');
    const result = await model([output]).propose("opening", text);
    expect(result.envelope.sources.map(({ excerpt }) => excerpt).join("")).toBe(text);
    for (const source of result.envelope.sources) expect(source.excerpt).toBe(text.slice(source.start, source.end));
    expect(result.envelope.proposals[0].value).toEqual({ kind: "known", value: String.raw`literal \u2019` });
  });

  it("distinguishes repeated and similar passages by code identity, and preserves multiple passages for shared dates and negation", () => {
    const text = "Culture was negative. Culture was negative. Culture was not negative; this corrects the earlier result.";
    expect(sourcePassages(text)).toHaveLength(3);
    const base = { products: [], proposals: [{ proposalReference: "p", groupReference: "event", intent: "correction" as const, target: { entity: "event" as const, field: "problemDescription" as const }, value: { kind: "known" as const, value: "Culture was not negative" }, evidenceReferences: ["p2", "p3"] }] };
    const result = parse(text, base);
    expect(result.sources.map(({ start }) => start)).toEqual([22, 44]);
    expect(result.sources.map(({ excerpt }) => excerpt).join("")).toBe(text.slice(22));
    // A real but wrong passage is mechanically valid; attribution still requires review.
    const wrongSupport = parse(text, { ...base, proposals: [{ ...base.proposals[0], evidenceReferences: ["p1"] }] });
    expect(wrongSupport.proposals[0].value).toEqual(base.proposals[0].value);
    expect(wrongSupport.sources[0].excerpt).toBe("Culture was negative. ");
  });

  it.each([["p999"], ["p3", "p3"], ["p3", "missing"], ["P3"], ["p3,p4"]].map((references) => [references]))("quarantines invalid/ambiguous reference selections %j without losing unrelated tests", (references) => {
    const output = sourceReferenceOutput();
    output.proposals.filter(({ target }) => target.entity === "test" && target.testReference === "t3").forEach((proposal) => { proposal.evidenceReferences = references; });
    const result = parse(sourceReferenceOpening, output);
    expect(result.relevantTests).toHaveLength(4);
    expect(result.unrepresented).toHaveLength(3);
    expect(result.unrepresented.every(({ reason }) => reason === "invalid-source-reference")).toBe(true);
    expect(result.proposals.filter(({ target }) => target.entity === "test")).toHaveLength(14);
  });

  it("corrects the five-test DEMO-91 from initial review, retains pending context and history, and leaves other test facts unchanged", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-00000000-0000-4000-8000-000000000096";
    let snapshot = await performJourneyAction(repository, caseId, { action: "submit-opening", reportType: "adverse-event", text: sourceReferenceOpening }, model([sourceReferenceOutput()]));
    expect(snapshot.stage).toBe("understanding");
    expect(snapshot.unrepresented).toEqual([]);
    expect(snapshot.understanding.relevantTests).toHaveLength(5);
    const before = await repository.load(caseId);
    const tests = snapshot.understanding.relevantTests;
    for (const [i, observation] of sourceReferenceObservations.entries()) for (const [field, expected] of Object.entries(observation)) {
      expect(tests[i].facts[field].proposals[0].value).toEqual(expected === null ? { kind: "unknown" } : { kind: "known", value: expected });
    }
    const correction = model([sourceReferenceCorrection(tests[0].id, tests[4].id)]);
    const propose = correction.propose.bind(correction);
    correction.propose = async (turn, text, context) => {
      expect(context?.relevantTests).toHaveLength(5);
      expect(context?.relevantTests[4].facts).toContainEqual({ field: "testName", value: { kind: "unknown" }, status: "proposed" });
      return propose(turn, text, context);
    };
    snapshot = await performJourneyAction(repository, caseId, { action: "submit-update", text: sourceReferenceUpdate }, correction);
    expect(snapshot.stage).toBe("review-update");
    expect(snapshot.understanding.relevantTests[0].facts.testResult.resolved).toBeUndefined();
    const groups = [...new Set(snapshot.review.attention.filter(({ groupId }) => groupId && !snapshot.openingGroups.includes(groupId)).map(({ groupId }) => groupId!))];
    expect(groups).toHaveLength(2);
    for (const groupId of groups) snapshot = await performJourneyAction(repository, caseId, { action: "review-update-group", groupId, decision: "accept" }, correction);
    expect(snapshot.stage).toBe("understanding");
    const after = await repository.load(caseId);
    expect(after!.relevantTests.map(({ id }) => id)).toEqual(before!.relevantTests.map(({ id }) => id));
    expect(after!.relevantTests.slice(1, 4)).toEqual(before!.relevantTests.slice(1, 4));
    for (const field of ["date", "lowRange", "highRange", "testName"] as const) expect(after!.relevantTests[0].facts[field]).toEqual(before!.relevantTests[0].facts[field]);
    expect(after!.relevantTests[0].facts.testResult.supersededValues[0].value).toEqual({ kind: "known", value: "9.1 g/dL" });
    snapshot = await performJourneyAction(repository, caseId, { action: "accept-understanding" }, correction);
    expect(snapshot.projection.sections.B.relevantTests.map(({ testResult }) => testResult)).toEqual(["hemoglobin: 8.9 g/dL", "stool occult blood: positive", "platelet count: 82", "ferritin: Result not recorded", "Helicobacter pylori stool antigen: negative"]);
    const response = await journeyResponse(repository, snapshot);
    expect(parseBrowserJourneyState(response.state).case).toEqual(await repository.load(caseId));
  });

  it("rejecting a proposed correction preserves the original pending value and permits a later correction", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-reject-update";
    let snapshot = await performJourneyAction(repository, caseId, { action: "submit-opening", reportType: "adverse-event", text: sourceReferenceOpening }, model([sourceReferenceOutput()]));
    const before = await repository.load(caseId);
    const output = sourceReferenceCorrection(snapshot.understanding.relevantTests[0].id, snapshot.understanding.relevantTests[4].id);
    output.proposals = output.proposals.slice(1);
    snapshot = await performJourneyAction(repository, caseId, { action: "submit-update", text: sourceReferenceUpdate }, model([output]));
    const groupId = snapshot.review.attention.find(({ kind }) => kind === "correction")!.groupId!;
    snapshot = await performJourneyAction(repository, caseId, { action: "review-update-group", groupId, decision: "reject" }, model([]));
    expect(snapshot.stage).toBe("understanding");
    const after = await repository.load(caseId);
    expect(after!.relevantTests[0].facts.testResult.proposedValues).toEqual(before!.relevantTests[0].facts.testResult.proposedValues);
    expect(after!.relevantTests[0].facts.testResult.resolvedValue).toBeUndefined();
  });

  it("recovers a wholly omitted test conversationally alongside valid corrections and rejects over-capacity additions locally", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-recover-omission";
    const output = sourceReferenceOutput();
    output.proposals.filter(({ target }) => target.entity === "test" && target.testReference === "t3").forEach((proposal) => { proposal.evidenceReferences = ["missing"]; });
    let snapshot = await performJourneyAction(repository, caseId, { action: "submit-opening", reportType: "adverse-event", text: sourceReferenceOpening }, model([output]));
    expect(snapshot.understanding.relevantTests).toHaveLength(4);
    snapshot = await performJourneyAction(repository, caseId, { action: "submit-update", text: omittedTestRecovery }, model([recoveryOutput()]), undefined, snapshot.unrepresented);
    expect(snapshot.understanding.relevantTests).toHaveLength(5);
    expect(snapshot.understanding.relevantTests[4].facts.testName.proposals[0].value).toEqual({ kind: "known", value: "ferritin" });
    expect(snapshot.unrepresented).toHaveLength(3); // Original omission remains disclosed.
    snapshot = await performJourneyAction(repository, caseId, { action: "accept-understanding" }, model([]));
    expect(snapshot.projection.sections.B.relevantTests[4].testResult).toBe("ferritin: Result not recorded");
    const recovery = recoveryOutput();
    recovery.proposals.push({ ...recovery.proposals[0], proposalReference: "valid-sibling", groupReference: "event", target: { entity: "event", field: "problemDescription" } });
    const limited = parseModelProposalEnvelope({ turn: "correction", existingTestCount: 8, input: { id: "recovery", type: "correction", text: omittedTestRecovery, recordedAt: time }, output: recovery }, ids);
    expect(limited.relevantTests).toEqual([]);
    expect(limited.proposals).toHaveLength(1);
    expect(limited.unrepresented.map(({ reason }) => reason)).toEqual(["test-limit", "test-limit", "test-limit"]);
  });
});
