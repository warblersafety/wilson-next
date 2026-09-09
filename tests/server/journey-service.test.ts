import { describe, expect, it } from "vitest";
import { correctionAccount, indicationAnswer, openingAccount } from "../../src/experiment/fixed-inputs";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import {
  getJourneySnapshot,
  performJourneyAction,
  type JourneyAction,
} from "../../src/server/journey/service";
import { fixedJourneyModel } from "../../src/experiment/fixed-journey";
import type { JourneyModel, ReviewedCaseModelContext } from "../../src/server/model/journey-model";

describe("fixed local journey service", () => {
  it("assembles the approved states through the authoritative repository command path", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-browser-test";

    let snapshot = await getJourneySnapshot(repository, caseId);
    expect(snapshot).toMatchObject({ stage: "describe", revision: 0, downloadReady: false });

    snapshot = await performJourneyAction(repository, caseId, { action: "submit-opening", text: openingAccount, reportType: "adverse-event" });
    expect(snapshot).toMatchObject({ stage: "understanding", revision: 2 });
    expect(snapshot.understanding.products.map(({ id, state }) => [id, state])).toEqual([
      ["product-apixaban", "proposed"],
      ["product-naproxen", "proposed"],
      ["product-lisinopril", "proposed"],
    ]);

    snapshot = await performJourneyAction(repository, caseId, { action: "accept-understanding" });
    expect(snapshot).toMatchObject({ stage: "clarify", revision: 4 });
    expect(snapshot.clarification?.question).toBe("What was apixaban being used for, and what was naproxen being used for?");

    snapshot = await performJourneyAction(repository, caseId, { action: "answer-indications", text: indicationAnswer });
    expect(snapshot).toMatchObject({ stage: "update", revision: 5, clarification: null });

    snapshot = await performJourneyAction(repository, caseId, { action: "submit-correction", text: correctionAccount });
    expect(snapshot).toMatchObject({ stage: "correct", revision: 6 });
    const naproxenBefore = snapshot.understanding.products.find(({ id }) => id === "product-naproxen")!;
    expect(naproxenBefore.facts.dose.resolved).toEqual({ kind: "known", value: "500 mg" });
    expect(naproxenBefore.facts.dose.proposals[0].value).toEqual({ kind: "known", value: "250 mg" });

    snapshot = await performJourneyAction(repository, caseId, { action: "accept-dose-correction" });
    expect(snapshot).toMatchObject({ stage: "correct", revision: 7 });
    const naproxenAfter = snapshot.understanding.products.find(({ id }) => id === "product-naproxen")!;
    expect(naproxenAfter.facts.dose.resolved).toEqual({ kind: "known", value: "250 mg" });
    expect(naproxenAfter.facts.dose.history[0].value).toEqual({ kind: "known", value: "500 mg" });

    snapshot = await performJourneyAction(repository, caseId, { action: "leave-date-unresolved" });
    expect(snapshot).toMatchObject({ stage: "output-unresolved", revision: 8, downloadReady: false });
    expect(snapshot.projection.sections.D.suspectProducts[0].startDate).toBeUndefined();
    expect(snapshot.projection.omissions).toContainEqual(expect.objectContaining({
      target: "product:product-apixaban:startDate",
      reason: "conflicted",
    }));

    snapshot = await performJourneyAction(repository, caseId, {
      action: "resolve-date",
      chosenValueId: "apixaban-date-alternative",
    });
    expect(snapshot).toMatchObject({ stage: "output-resolved", revision: 9, downloadReady: true });
    expect(snapshot.projection.sections.D.suspectProducts[0].startDate).toBe("2026-08-13");
    expect(snapshot.projection.sections.D.suspectProducts[1].dose).toBe("250 mg");
  });

  it("rejects fixture changes and out-of-order actions without advancing the case", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-rejected-action";
    await expect(performJourneyAction(repository, caseId, {
      action: "submit-opening",
      text: `${openingAccount} invented addition`,
      reportType: "adverse-event",
    })).rejects.toThrow("only the displayed fictional opening account");
    expect((await getJourneySnapshot(repository, caseId)).revision).toBe(0);
    await expect(performJourneyAction(repository, caseId, { action: "accept-understanding" }))
      .rejects.toThrow("not available during describe");
  });

  it("allows either dated source to be selected directly from the correction composition", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-direct-resolution";
    await performJourneyAction(repository, caseId, { action: "submit-opening", text: openingAccount, reportType: "adverse-event" });
    await performJourneyAction(repository, caseId, { action: "accept-understanding" });
    await performJourneyAction(repository, caseId, { action: "answer-indications", text: indicationAnswer });
    await performJourneyAction(repository, caseId, { action: "submit-correction", text: correctionAccount });
    await performJourneyAction(repository, caseId, { action: "accept-dose-correction" });

    const snapshot = await performJourneyAction(repository, caseId, {
      action: "resolve-date",
      chosenValueId: "apixaban-start",
    });

    expect(snapshot).toMatchObject({ stage: "output-resolved", revision: 9, downloadReady: true });
    expect(snapshot.projection.sections.D.suspectProducts[0].startDate).toBe("2026-08-12");
  });

  it("passes the relevant reviewed values into the correction model request", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-correction-context";
    let receivedContext: ReviewedCaseModelContext | undefined;
    const model: JourneyModel = {
      async propose(turn, text, correctionContext) {
        if (turn === "correction") receivedContext = correctionContext;
        return fixedJourneyModel.propose(turn, text, correctionContext);
      },
    };

    await advanceToCorrectionInput(repository, caseId, model);
    await performJourneyAction(
      repository,
      caseId,
      { action: "submit-correction", text: correctionAccount },
      model,
    );

    expect(receivedContext?.products).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "product-apixaban",
        name: "apixaban",
        facts: expect.arrayContaining([
          { field: "dose", value: { kind: "known", value: "5 mg" } },
          { field: "startDate", value: { kind: "known", value: "2026-08-12" } },
        ]),
      }),
      expect.objectContaining({
        id: "product-naproxen",
        name: "naproxen",
        facts: expect.arrayContaining([
          { field: "dose", value: { kind: "known", value: "500 mg" } },
          { field: "startDate", value: { kind: "known", value: "2026-08-10" } },
        ]),
      }),
    ]));
  });

  it.each([
    ["direct resolution", { action: "resolve-date", chosenValueId: "apixaban-date-alternative" }],
    ["leaving unresolved", { action: "leave-date-unresolved" }],
  ] satisfies Array<[string, JourneyAction]>) (
    "keeps a duplicate date proposal visible and blocks %s",
    async (_label, action) => {
      const repository = new InMemoryCaseRepository();
      const caseId = `case-duplicate-date-${action.action}`;
      await advanceToCorrectionInput(repository, caseId, duplicateDateJourneyModel);
      let snapshot = await performJourneyAction(
        repository,
        caseId,
        { action: "submit-correction", text: correctionAccount },
        duplicateDateJourneyModel,
      );
      snapshot = await performJourneyAction(
        repository,
        caseId,
        { action: "accept-dose-correction" },
        duplicateDateJourneyModel,
      );

      expect(snapshot).toMatchObject({ stage: "correct", revision: 7, downloadReady: false });
      expect(apixabanStartDate(snapshot)).toMatchObject({
        state: "resolved",
        resolved: { kind: "known", value: "2026-08-12" },
        proposals: [{
          id: "apixaban-date-alternative",
          intent: "alternative",
          value: { kind: "known", value: "2026-08-12" },
        }],
        conflicts: [],
      });

      await expect(performJourneyAction(
        repository,
        caseId,
        action,
        duplicateDateJourneyModel,
      )).rejects.toThrow("Wilson did not identify a different apixaban start date");

      snapshot = await getJourneySnapshot(repository, caseId);
      expect(snapshot).toMatchObject({ stage: "correct", revision: 7, downloadReady: false });
      expect(apixabanStartDate(snapshot)).toMatchObject({
        state: "resolved",
        resolved: { kind: "known", value: "2026-08-12" },
        proposals: [{ value: { kind: "known", value: "2026-08-12" } }],
        conflicts: [],
      });
    },
  );

  it("makes the supported understanding Change and Remove actions authoritative", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-truthful-controls";
    await performJourneyAction(repository, caseId, {
      action: "submit-opening",
      text: openingAccount,
      reportType: "adverse-event",
    });

    let snapshot = await performJourneyAction(repository, caseId, {
      action: "change-patient-age",
      ageYears: 58,
    });
    expect(snapshot).toMatchObject({ stage: "understanding", revision: 3 });
    expect(snapshot.understanding.patient.ageYears).toMatchObject({
      state: "resolved",
      resolved: { kind: "known", value: 58 },
      evidence: expect.arrayContaining(["Synthetic correction: patient age is 58 years."]),
    });

    snapshot = await performJourneyAction(repository, caseId, { action: "remove-lisinopril" });
    expect(snapshot).toMatchObject({ stage: "understanding", revision: 4 });
    expect(snapshot.understanding.products.map(({ id }) => id)).toEqual([
      "product-apixaban",
      "product-naproxen",
    ]);

    snapshot = await performJourneyAction(repository, caseId, { action: "accept-understanding" });
    expect(snapshot).toMatchObject({ stage: "clarify", revision: 6 });
  });
});

const duplicateDateJourneyModel: JourneyModel = {
  async propose(turn, text, correctionContext) {
    const result = await fixedJourneyModel.propose(turn, text, correctionContext);
    if (turn !== "correction") return result;
    return {
      ...result,
      envelope: {
        ...result.envelope,
        proposals: result.envelope.proposals.map((proposal) => proposal.proposalId === "apixaban-date-alternative"
          ? { ...proposal, value: { kind: "known", value: "2026-08-12" } }
          : proposal),
      },
    };
  },
};

async function advanceToCorrectionInput(
  repository: InMemoryCaseRepository,
  caseId: string,
  model: JourneyModel,
) {
  await performJourneyAction(
    repository,
    caseId,
    { action: "submit-opening", text: openingAccount, reportType: "adverse-event" },
    model,
  );
  await performJourneyAction(repository, caseId, { action: "accept-understanding" }, model);
  await performJourneyAction(
    repository,
    caseId,
    { action: "answer-indications", text: indicationAnswer },
    model,
  );
}

function apixabanStartDate(snapshot: Awaited<ReturnType<typeof getJourneySnapshot>>) {
  return snapshot.understanding.products.find(({ id }) => id === "product-apixaban")!.facts.startDate;
}
