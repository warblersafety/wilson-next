import { describe, expect, it } from "vitest";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { completionQuestions } from "../../src/domain/case/completion-policy";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction, type JourneyAction } from "../../src/server/journey/service";
import { acceptOpeningCase, completeResolvedCase } from "../domain/fixture";
import { fixedJourneyModel } from "../fixtures/fixed-journey";
import type { SemanticCase } from "../../src/domain/case/types";

const reporter: Extract<JourneyAction, { action: "answer-reporter" }> = {
  action: "answer-reporter", reportDate: "2026-09-22", reporter: {
    kind: "provided", firstName: "Casey", lastName: "Reed", email: "casey@example.test", country: "UNITED STATES",
    healthProfessional: true, occupation: "Physician", reportedTo: ["manufacturer"], doNotDiscloseIdentity: true,
  },
};
function setup(state = completeResolvedCase()) {
  const repository = new InMemoryCaseRepository({ initialCase: state });
  return { repository, act: (action: JourneyAction) => performJourneyAction(repository, state.id, action, fixedJourneyModel), snapshot: () => getJourneySnapshot(repository, state.id) };
}
function pendingAnswer(state: SemanticCase) {
  const text = "Apixaban was for prevention. History is unknown.";
  return applyCaseCommand(state, {
    type: "attach-grounded-proposals", commandId: "pending-several-answers", expectedRevision: state.revision,
    products: [], relevantTests: [],
    sources: [{ id: "source-answers", inputId: "input-answers", inputType: "correction", excerpt: text, start: 0, end: text.length, actor: "clinician", recordedAt: "2026-09-22T00:00:00Z" }],
    proposals: [
      { proposalId: "proposed-indication", groupId: "answers", intent: "fact", target: { entity: "product", entityId: "product-apixaban", field: "indication" }, value: { kind: "known", value: "prevention" }, sourceIds: ["source-answers"] },
      { proposalId: "proposed-history", groupId: "answers", intent: "fact", target: { entity: "event", entityId: "event", field: "relevantHistory" }, value: { kind: "unknown" }, sourceIds: ["source-answers"] },
    ],
  }).case;
}

describe("Draft 4 accepted knowledge and output lifecycle", () => {
  it("shows multiple applicable clinical needs without recording questions or settling proposed answers", async () => {
    const state = acceptOpeningCase();
    const before = structuredClone(state);
    const needs = completionQuestions(state);
    expect(needs.map(({ kind }) => kind)).toEqual(["indications", "serious-outcomes", "clinical-context", "medication-history", "medication-history", "reporter"]);
    expect(state).toEqual(before);
    const { snapshot, act } = setup(pendingAnswer(state));
    const pending = await snapshot();
    expect(pending.stage).toBe("review-update");
    expect(pending.clinicalNeeds.some(({ kind }) => kind === "reporter")).toBe(false);
    expect(pending.clinicalNeeds.find(({ kind }) => kind === "indications")?.targetIds).toContain("product:product-apixaban:indication");
    expect(pending.clinicalNeeds.find(({ kind }) => kind === "clinical-context")?.targetIds).toContain("event:event:relevantHistory");
    const accepted = await act({ action: "review-update-group", groupId: "answers", decision: "accept" });
    expect(accepted.clinicalNeeds.find(({ kind }) => kind === "indications")?.targetIds).toEqual(["product:product-naproxen:indication"]);
    expect(accepted.clinicalNeeds.some(({ kind }) => kind === "clinical-context")).toBe(false);
  });

  it("revisits reporter details, preserves unchanged output identity and supersedes edits", async () => {
    const { act, repository } = setup();
    const saved = await act(reporter);
    const unchanged = await act(reporter);
    expect(unchanged.revision).toBe(saved.revision);
    expect(unchanged.reportContentKey).toBe(saved.reportContentKey);
    expect(unchanged.downloadReady).toBe(true);
    const changed = await act({ ...reporter, reporter: { ...reporter.reporter, kind: "provided", firstName: "Casey", lastName: "Reed", occupation: "Nurse", healthProfessional: true, reportedTo: [], doNotDiscloseIdentity: false, email: "new@example.test" } });
    expect(changed.reportContentKey).not.toBe(saved.reportContentKey);
    expect(changed.review.attention).toEqual([]);
    expect(changed.projection.sections.G.reporter).toMatchObject({ email: "new@example.test", occupation: "Nurse", reportedTo: [], doNotDiscloseIdentity: false });
    expect(changed.understanding.reporter.email.history).toContainEqual(expect.objectContaining({ value: { kind: "known", value: "casey@example.test" } }));
    expect((await repository.load("case-test-57"))!.askedNeeds.filter(({ key }) => key === "reporter-details")).toHaveLength(1);
  });

  it("supplies details after refusal, and refusal after details removes all earlier reporter contents", async () => {
    const { act } = setup();
    const refused = await act({ action: "answer-reporter", reporter: { kind: "declined" } });
    const supplied = await act(reporter);
    expect(supplied.stage).toBe("output");
    expect(supplied.review.attention).toEqual([]);
    expect(supplied.projection.sections.G.reporter.firstName).toBe("Casey");
    expect(supplied.reportContentKey).not.toBe(refused.reportContentKey);
    const refusedAgain = await act({ action: "answer-reporter", reporter: { kind: "declined" } });
    expect(refusedAgain.projection.sections.G.reporter).toEqual({});
    expect(refusedAgain.downloadReady).toBe(true);
    expect(refusedAgain.understanding.reporter.firstName.history).toContainEqual(expect.objectContaining({ value: { kind: "known", value: "Casey" } }));
  });

  it("does not permit incomplete reporter details or prematurely complete clinical work", async () => {
    const { act } = setup(acceptOpeningCase());
    await expect(act(reporter)).rejects.toThrow("Complete the clinical questions");
    const complete = setup();
    await expect(complete.act({ ...reporter, reporter: { kind: "provided", firstName: "Casey", lastName: "Reed", occupation: "Physician", healthProfessional: true, reportedTo: [], doNotDiscloseIdentity: false } })).rejects.toThrow("either phone or email");
  });

  it("keys PDF validity to report contents instead of revisions and supporting source metadata", async () => {
    const { snapshot, act } = setup();
    const original = await snapshot();
    const repeat = await act({ action: "set-fact", target: "patient:patient:ageYears", value: original.understanding.patient.ageYears.resolved as Extract<JourneyAction, { action: "set-fact" }>["value"] });
    expect(repeat.revision).toBeGreaterThan(original.revision);
    expect(repeat.reportContentKey).toBe(original.reportContentKey);
    const changed = await act({ action: "set-fact", target: "patient:patient:ageYears", value: { kind: "known", value: 63 } });
    expect(changed.reportContentKey).not.toBe(original.reportContentKey);
    expect(changed.downloadReady).toBe(true);
  });
});
