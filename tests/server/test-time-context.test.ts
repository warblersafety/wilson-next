import { describe, expect, it } from "vitest";
import { createAnthropicJourneyModel, createAnthropicRequest } from "../../src/server/model/anthropic-journey";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import { projectForm3500 } from "../../src/domain/case/projection";
import { parseBrowserJourneyState, browserStateVersion } from "../../src/server/case/browser-state";
import { createUnderstandingView } from "../../src/domain/case/views";
import { timeOpening, timeContext, correctedTimeContext, timeCorrection, omittedTimeOutput, expectedTimeOutput, expectedTimeCorrection, verifiedTimeOutput } from "../fixtures/test-time-context";
const at = "2026-10-16T00:31:59.918Z";
async function interpret(output: unknown, turn: "opening" | "correction" = "opening", text = timeOpening, existingId?: string) {
 return (await createAnthropicJourneyModel(async () => ({ id: "synthetic-replay", model: "captured-response-replay", stop_reason: "end_turn", content: [{type: "text", text: JSON.stringify(output)}], usage: {input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0} }), Date.now, undefined, (kind, ref) => `${kind}-${ref}`, () => at).propose(turn, text, existingId ? {patient: [], event: [], products: [], relevantTests: [{id: existingId, facts: []}]} : undefined)).envelope;
}
function accept(state: ReturnType<typeof createSemanticCase>, envelope: Awaited<ReturnType<typeof interpret>>, id: string) {
 const {unrepresented, ...command} = envelope;
 const attached = applyCaseCommand(state, {type: "attach-grounded-proposals", commandId: id, expectedRevision: state.revision, ...command}).case;
 return applyCaseCommand(attached, {type: "review-proposal-groups", commandId: `${id}-accept`, expectedRevision: attached.revision, decisions: [...new Set(envelope.proposals.map(p => p.groupId))].map(groupId => ({groupId, action: "accept" as const}))}).case;
}
describe("collection-time context regression from actual synthetic response", () => {
 it("replays the actual omission unchanged: a source citation is not a represented qualifier", async () => {
  const envelope = await interpret(omittedTimeOutput);
  expect(envelope.proposals).toHaveLength(47); expect(envelope.unrepresented).toEqual([]);
  expect(envelope.proposals.every(p => !("qualifier" in p.value))).toBe(true);
  const source = envelope.sources.find(s => s.excerpt.includes(timeContext))!;
  expect(source).toBeDefined();
  expect(envelope.proposals.filter(p => p.sourceIds.includes(source.id)).map(p => p.target)).toEqual([{entity: "event", entityId: "event", field: "relevantTestsAvailable"}]);
  expect(envelope.proposals.map(p => p.value)).toEqual(omittedTimeOutput.proposals.map(p => p.value));
 });
 it("replays actual v19 wording without treating the shorter qualifier as a verbatim source sentence", async () => {
  const envelope = await interpret(verifiedTimeOutput);
  const date = envelope.proposals.find(p => p.target.entity === "test" && p.target.field === "date" && p.value.kind === "known" && p.value.qualifier)!;
  expect(date.value).toEqual({kind: "known", value: "2026-09-03", qualifier: "Collection time was not recorded"});
  expect(date.sourceIds.map(id => envelope.sources.find(s => s.id === id)!.excerpt).join(" ")).toContain(timeContext);
  expect(envelope.proposals.filter(p => p.value.kind === "known" && p.value.qualifier)).toHaveLength(1);
  const accepted = accept(createSemanticCase("case-00000000-0000-4000-8000-000000000192"), envelope, "actual-v19");
  expect(projectForm3500(accepted).sections.B.relevantTestContext).toBe("B6 table row 1 - Test date context: Collection time was not recorded");
 });
 it("preserves collection-time qualifiers alongside supported complete/partial dates without timestamps", () => {
  const prompt = createAnthropicRequest("opening", timeOpening).system;
  expect(prompt).toContain("Keep the supplied complete or partial date as known and place the exact collection-time wording in its value.qualifier");
  expect(prompt).toContain("If no known date is supplied");
  expect(prompt).toContain("an explicitly unavailable date still uses unknown");
  expect(prompt).toContain("Never infer a time");
  expect(prompt).toContain("Citing the context passage only for relevantTestsAvailable does not preserve");
 });
 it("keeps authored time context on a known name when the calendar date is explicitly unknown", async () => {
  const text = "INR was 4.8. The INR collection date is unknown. The INR collection time was not recorded.";
  const envelope = await interpret({products: [], tests: [{testReference: "inr", groupReference: "inr"}], proposals: [
   {proposalReference: "name", groupReference: "inr", intent: "fact", target: {entity: "test", testReference: "inr", field: "testName"}, value: {kind: "known", value: "INR", qualifier: timeContext}, evidenceReferences: ["p1", "p3"]},
   {proposalReference: "date", groupReference: "inr", intent: "fact", target: {entity: "test", testReference: "inr", field: "date"}, value: {kind: "unknown"}, evidenceReferences: ["p2"]},
  ]}, "opening", text);
  const state = accept(createSemanticCase("case-00000000-0000-4000-8000-000000000192"), envelope, "unknown-date");
  expect(state.relevantTests[0].facts.date.resolvedValue?.value).toEqual({kind: "unknown"});
  const projection = projectForm3500(state);
  expect(projection.sections.B.relevantTestContext).toBe(`B6 table row 1 - Test name context: ${timeContext}`);
  expect(projection.sections.B.relevantTests[0].date).toBeUndefined();
 });
 it("retains authored expected context through review, correction, history, resume and B6 row attribution", async () => {
  const envelope = await interpret(expectedTimeOutput());
  const proposed = applyCaseCommand(createSemanticCase("case-00000000-0000-4000-8000-000000000192"), {type: "attach-grounded-proposals", commandId: "pending", expectedRevision: 0, products: envelope.products, relevantTests: envelope.relevantTests, sources: envelope.sources, proposals: envelope.proposals}).case;
  expect(projectForm3500(proposed).sections.B.relevantTests).toEqual([]);
  expect(JSON.stringify(createUnderstandingView(proposed))).toContain(timeContext);
  const before = accept(createSemanticCase("case-00000000-0000-4000-8000-000000000192"), envelope, "opening");
  const inr = before.relevantTests[0];
  expect(inr.facts.date.resolvedValue?.value).toEqual({kind: "known", value: "2026-09-03", qualifier: timeContext});
  expect(projectForm3500(before).sections.B.relevantTestContext).toContain(`B6 table row 1 - Test date context: ${timeContext}`);
  const after = accept(before, await interpret(expectedTimeCorrection(inr.id), "correction", timeCorrection, inr.id), "correction");
  expect(after.relevantTests[0].id).toBe(inr.id);
  expect(after.relevantTests[0].facts.date.resolvedValue?.value).toEqual({kind: "known", value: "2026-09-03", qualifier: correctedTimeContext});
  expect(after.relevantTests[0].facts.date.supersededValues.some(p => p.value.kind === "known" && p.value.qualifier === timeContext)).toBe(true);
  expect(after.relevantTests[1]).toEqual(before.relevantTests[1]); expect(after.products).toEqual(before.products);
  for (const field of ["testName", "testResult", "lowRange", "highRange"] as const) expect(after.relevantTests[0].facts[field]).toEqual(inr.facts[field]);
  expect(parseBrowserJourneyState({version: browserStateVersion, stage: "clarify", case: after, unrepresented: []}).case).toEqual(after);
  const projection = projectForm3500(after);
  expect(projection.sections.B.relevantTestContext).toBe(`B6 table row 1 - Test date context: ${correctedTimeContext}`);
  expect(projection.sections.B.relevantTests.map(t => t.date)).toEqual(["2026-09-03", "2026-09-03"]);
 });
});
