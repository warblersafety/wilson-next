import { describe, expect, it } from "vitest";
import { correctionAccount, indicationAnswer, openingAccount } from "../../src/experiment/fixed-inputs";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";

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
});
