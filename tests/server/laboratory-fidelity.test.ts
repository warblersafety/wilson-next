import { parseQuotedFixture as parseModelProposalEnvelope } from "../fixtures/source-references";
import { describe, expect, it } from "vitest";

import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import { projectForm3500 } from "../../src/domain/case/projection";
import { createUnderstandingView } from "../../src/domain/case/views";
import { createReviewedCaseModelContext } from "../../src/server/model/reviewed-case-context";
import { parseBrowserJourneyState, browserStateVersion } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { performJourneyAction } from "../../src/server/journey/service";
import { journeyActionSchema } from "../../src/server/journey/action-contract";
import { completeResolvedCase } from "../domain/fixture";
import { laboratoryCases } from "../fixtures/laboratory-fidelity";

import { laboratoryOpening as opening, reviewedLaboratoryCase } from "../fixtures/laboratory-case";
const recordedAt = "2026-09-20T12:00:00.000Z";
const identities = (kind: string, reference: string) => `${kind}-${reference}`;

describe("laboratory identity and result fidelity", () => {
  it.each(laboratoryCases)("retains $id identity, result, partial states and evidence through review and projection", (scenario) => {
    const envelope = opening([...scenario.observations], scenario.text);
    expect(envelope.unrepresented).toEqual([]);
    const proposed = applyCaseCommand(createSemanticCase("case"), { type: "attach-grounded-proposals", commandId: "opening", expectedRevision: 0, ...envelope }).case;
    expect(projectForm3500(proposed).sections.B.relevantTests).toEqual([]);
    expect(createUnderstandingView(proposed).relevantTests).toHaveLength(scenario.observations.length);
    const state = reviewedLaboratoryCase([...scenario.observations], scenario.text);
    const restored = parseBrowserJourneyState({ version: browserStateVersion, stage: "clarify", case: state, unrepresented: [] });
    expect(restored.case).toEqual(state);
    const projection = projectForm3500(state);
    scenario.observations.forEach((observation, index) => {
      for (const [field, expected] of Object.entries(observation)) {
        const fact = state.relevantTests[index].facts[field as keyof typeof state.relevantTests[number]["facts"]];
        expect(fact.resolvedValue?.value).toEqual(expected === null ? { kind: "unknown" } : { kind: "known", value: expected });
        expect(createUnderstandingView(state).relevantTests[index].facts[field].evidence.join("")).toBe(scenario.text);
      }
      if (!("date" in observation)) expect(state.relevantTests[index].facts.date.state).toBe("empty");
      expect(projection.sections.B.relevantTests[index].testResult).toContain(observation.testResult ?? "Result not recorded");
      if (observation.testName) expect(projection.sections.B.relevantTests[index].testResult).toContain(observation.testName);
    });
    expect(createReviewedCaseModelContext(state).relevantTests.map(({ id }) => id)).toEqual(state.relevantTests.map(({ id }) => id));
  });

  it("retains useful date-only details after an incompatible result without inventing identity", () => {
    const state = reviewedLaboratoryCase([{ date: "2026-09-11" }], "An unidentified test was collected on 11-Sep-2026.");
    expect(projectForm3500(state).sections.B.relevantTests[0]).toEqual({ testId: "test-t0", testResult: "Test identity not recorded: Result not recorded", date: "2026-09-11" });
    expect(projectForm3500(state).omissions).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: "test:test-t0:testName", reason: "empty" }),
      expect.objectContaining({ target: "test:test-t0:testResult", reason: "empty" }),
    ]));
  });

  it("corrects a result on its stable test without replacing identity, date, ranges or the other test", () => {
    const scenario = laboratoryCases[1];
    const prior = reviewedLaboratoryCase([...scenario.observations], scenario.text);
    const text = "Correction: hemoglobin was 8.9 g/dL, not 9.1 g/dL. The stool test is unchanged.";
    const correction = parseModelProposalEnvelope({ turn: "correction", existingTestIds: prior.relevantTests.map(({ id }) => id), input: { id: "update", type: "correction", text, recordedAt }, output: { products: [], proposals: [{ proposalReference: "new-result", groupReference: "update", intent: "correction", target: { entity: "test", testReference: "test-t0", field: "testResult" }, value: { kind: "known", value: "8.9 g/dL" }, evidenceQuote: text }] } }, identities);
    let state = applyCaseCommand(prior, { type: "attach-grounded-proposals", commandId: "update", expectedRevision: prior.revision, ...correction }).case;
    expect(projectForm3500(state).sections.B.relevantTests[0].testResult).toBe("hemoglobin: 9.1 g/dL");
    state = applyCaseCommand(state, { type: "review-proposal-groups", commandId: "accept-update", expectedRevision: state.revision, decisions: [{ groupId: "group-update", action: "accept" }] }).case;
    expect(state.relevantTests[1]).toEqual(prior.relevantTests[1]);
    expect(state.relevantTests[0].facts.testName).toEqual(prior.relevantTests[0].facts.testName);
    expect(state.relevantTests[0].facts.date).toEqual(prior.relevantTests[0].facts.date);
    expect(state.relevantTests[0].facts.lowRange).toEqual(prior.relevantTests[0].facts.lowRange);
    expect(state.relevantTests[0].facts.highRange).toEqual(prior.relevantTests[0].facts.highRange);
    expect(state.relevantTests[0].facts.testResult.supersededValues[0].value).toEqual({ kind: "known", value: "9.1 g/dL" });
    const projection = projectForm3500(state);
    expect(projection.sections.B.relevantTests[0].testResult).toBe("hemoglobin: 8.9 g/dL");
    expect(projection.sourceTrace["sections.B.relevantTests.0.testResult"]).toEqual(expect.arrayContaining([prior.relevantTests[0].facts.testName.sourceIds[0], correction.sources[0].id]));
  });

  it("repairs missing identity and later corrects it directly without calling a model", async () => {
    const state = completeResolvedCase();
    const repository = new InMemoryCaseRepository({ initialCase: state });
    const model = { propose: async () => { throw new Error("Direct correction must not use the model"); } };
    const target = "test:test-hemoglobin:testName";
    const first = await performJourneyAction(repository, state.id, { action: "set-fact", target, value: { kind: "known", value: "Hemoglobin" } }, model);
    expect(first.understanding.relevantTests[0].facts.testName.resolved).toEqual({ kind: "known", value: "Hemoglobin" });
    const second = await performJourneyAction(repository, state.id, { action: "set-fact", target, value: { kind: "unknown" } }, model);
    expect(second.downloadReady).toBe(true);
    expect(second.projection.omissions).toContainEqual(expect.objectContaining({ target, reason: "unknown" }));
    expect(second.understanding.relevantTests[0].facts.testName.history[0].value).toEqual({ kind: "known", value: "Hemoglobin" });
  });

  it("accepts identity-only and result-only direct entries, rejects empty entries and impossible dates", () => {
    for (const test of [{ kind: "known", testName: "Skin biopsy" }, { kind: "known", testResult: "negative" }]) {
      expect(journeyActionSchema.safeParse({ action: "answer-clinical-context", test }).success).toBe(true);
    }
    for (const test of [{ kind: "known" }, { kind: "known", testResult: "negative", date: "2026-02-30" }]) {
      expect(journeyActionSchema.safeParse({ action: "answer-clinical-context", test }).success).toBe(false);
    }
  });
});
