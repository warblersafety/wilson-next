import { describe, expect, it } from "vitest";
import { correctionAccount, openingAccount } from "../fixtures/fixed-inputs";
import { fixedJourneyModel } from "../fixtures/fixed-journey";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";
import type { JourneyModel, ReviewedCaseModelContext } from "../../src/server/model/journey-model";
import { completeResolvedCase } from "../domain/fixture";

describe("state-driven journey service", () => {
  it("retains the Experiment 1 semantic case through shared review, update, conflict, and output behavior", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-browser-regression";
    let snapshot = await getJourneySnapshot(repository, caseId);
    expect(snapshot).toMatchObject({ stage: "describe", revision: 0, downloadReady: false });

    snapshot = await performJourneyAction(repository, caseId, openingAction, fixedJourneyModel);
    expect(snapshot).toMatchObject({ stage: "understanding", revision: 2 });
    snapshot = await performJourneyAction(repository, caseId, { action: "accept-understanding" }, fixedJourneyModel);
    expect(snapshot).toMatchObject({ stage: "clarify", revision: 3 });
    expect(snapshot.clarification?.kind).toBe("indications");
    expect(snapshot.clarification?.kind === "indications" ? snapshot.clarification.productIds : []).toEqual(["product-apixaban", "product-naproxen"]);
    snapshot = await answerIndications(repository, caseId, "known");
    expect(snapshot.clarification?.key).toBe("serious-outcomes");
    snapshot = await completeRemaining(repository, caseId);
    expect(snapshot).toMatchObject({ stage: "output", downloadReady: true });

    let receivedContext: ReviewedCaseModelContext | undefined;
    const contextModel: JourneyModel = {
      async propose(turn, text, reviewedCase) {
        if (turn === "correction") receivedContext = reviewedCase;
        return fixedJourneyModel.propose(turn, text, reviewedCase);
      },
    };
    snapshot = await performJourneyAction(repository, caseId, { action: "submit-update", text: correctionAccount }, contextModel);
    expect(snapshot).toMatchObject({ stage: "review-update", downloadReady: false });
    expect(receivedContext?.products.map(({ id }) => id)).toEqual(["product-apixaban", "product-naproxen", "product-lisinopril"]);

    snapshot = await performJourneyAction(repository, caseId, {
      action: "review-update-group", groupId: "naproxen-dose-correction", decision: "accept",
    }, fixedJourneyModel);
    expect(snapshot.stage).toBe("review-update");
    expect(snapshot.understanding.products.find(({ id }) => id === "product-naproxen")?.facts.dose)
      .toMatchObject({ resolved: { kind: "known", value: "250 mg" }, history: [{ value: { kind: "known", value: "500 mg" } }] });

    snapshot = await performJourneyAction(repository, caseId, {
      action: "review-update-group", groupId: "apixaban-date-conflict", decision: "accept",
    }, fixedJourneyModel);
    expect(snapshot).toMatchObject({ stage: "output", downloadReady: true });
    expect(snapshot.projection.sections.D.suspectProducts[0].startDate).toBeUndefined();
    expect(snapshot.projection.omissions).toContainEqual(expect.objectContaining({ target: "product:product-apixaban:startDate", reason: "conflicted" }));

    const conflict = snapshot.review.attention.find(({ kind }) => kind === "conflict")!;
    snapshot = await performJourneyAction(repository, caseId, {
      action: "resolve-conflict",
      target: conflict.target,
      chosenValueId: conflict.values.find(({ value }) => value.kind === "known" && value.value === "2026-08-13")!.id,
    }, fixedJourneyModel);
    expect(snapshot.projection.sections.D.suspectProducts[0].startDate).toBe("2026-08-13");
  });

  it.each(["unknown", "declined"] as const)("records an attributed %s indication once and permits partial output", async (kind) => {
    const repository = new InMemoryCaseRepository();
    const caseId = `case-indication-${kind}`;
    await performJourneyAction(repository, caseId, openingAction, fixedJourneyModel);
    await performJourneyAction(repository, caseId, { action: "accept-understanding" }, fixedJourneyModel);
    let snapshot = await answerIndications(repository, caseId, kind);
    expect(snapshot.clarification?.key).toBe("serious-outcomes");
    snapshot = await completeRemaining(repository, caseId);
    expect(snapshot).toMatchObject({ stage: "output", downloadReady: true, clarification: null });
    expect(snapshot.understanding.products.filter(({ id }) => id !== "product-lisinopril").map(({ facts }) => facts.indication.resolved))
      .toEqual([{ kind }, { kind }]);
    expect(snapshot.projection.omissions).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: kind, target: "product:product-apixaban:indication" }),
      expect.objectContaining({ reason: kind, target: "product:product-naproxen:indication" }),
    ]));
  });

  it("applies atomic typed group corrections and Remove through the same command boundary", async () => {
    const repository = new InMemoryCaseRepository();
    const caseId = "case-review-controls";
    let snapshot = await performJourneyAction(repository, caseId, openingAction, fixedJourneyModel);
    const age = snapshot.understanding.patient.ageYears.proposals[0];
    snapshot = await performJourneyAction(repository, caseId, {
      action: "review-opening-group", groupId: age.groupId,
      corrections: [
        { proposalId: age.id, value: { kind: "known", value: 58 } },
        {
          proposalId: snapshot.understanding.patient.identifier.proposals[0].id,
          value: { kind: "known", value: "TEST-58" },
        },
      ],
    }, fixedJourneyModel);
    expect(snapshot.understanding.patient.ageYears).toMatchObject({
      resolved: { kind: "known", value: 58 }, evidence: expect.arrayContaining(["Clinician corrected this value during opening review."]),
    });
    expect(snapshot.understanding.patient.identifier).toMatchObject({
      resolved: { kind: "known", value: "TEST-58" },
    });

    snapshot = await performJourneyAction(repository, caseId, { action: "reject-group", groupId: "product-lisinopril" }, fixedJourneyModel);
    expect(snapshot.understanding.products.map(({ id }) => id)).not.toContain("product-lisinopril");
  });

  it("rejects out-of-order work without advancing accepted knowledge", async () => {
    const repository = new InMemoryCaseRepository();
    await expect(performJourneyAction(repository, "case-order", { action: "accept-understanding" }, fixedJourneyModel))
      .rejects.toThrow("not available during describe");
    expect((await getJourneySnapshot(repository, "case-order")).revision).toBe(0);
  });

  it("adds and corrects supported facts directly, then withdraws an entity without a model call", async () => {
    const initial = completeResolvedCase();
    const repository = new InMemoryCaseRepository({ initialCase: initial });
    const model: JourneyModel = { propose: async () => { throw new Error("Direct edits must not call the model"); } };
    const caseId = initial.id;

    let snapshot = await performJourneyAction(repository, caseId, {
      action: "set-fact",
      target: "patient:patient:weight",
      value: { kind: "known", value: { value: 70, unit: "kg" } },
    }, model);
    expect(snapshot.projection.sections.A.weight).toEqual({ value: 70, unit: "kg" });

    snapshot = await performJourneyAction(repository, caseId, {
      action: "set-fact",
      target: "event:event:reportType",
      value: { kind: "known", value: "adverse-event-and-product-problem" },
    }, model);
    expect(snapshot.projection.sections.B.reportType).toBe("adverse-event-and-product-problem");
    expect(snapshot.understanding.event.reportType.history).toEqual([
      expect.objectContaining({ value: { kind: "known", value: "adverse-event" } }),
    ]);

    snapshot = await performJourneyAction(repository, caseId, {
      action: "set-fact",
      target: "reporter:reporter:lastName",
      value: { kind: "known", value: "Reed-Smith" },
    }, model);
    expect(snapshot.projection.sections.G.reporter.lastName).toBe("Reed-Smith");
    expect(snapshot.understanding.reporter.lastName.history[0].value).toEqual({ kind: "declined" });

    snapshot = await performJourneyAction(repository, caseId, {
      action: "withdraw-entity",
      entity: "test",
      entityId: "test-hemoglobin",
    }, model);
    expect(snapshot.understanding.relevantTests[0]).toMatchObject({ id: "test-hemoglobin", state: "withdrawn" });
    expect(snapshot.projection.sections.B.relevantTests).toEqual([]);

    snapshot = await performJourneyAction(repository, caseId, {
      action: "withdraw-entity",
      entity: "product",
      entityId: "product-lisinopril",
    }, model);
    expect(snapshot.understanding.products.find(({ id }) => id === "product-lisinopril"))
      .toMatchObject({ state: "withdrawn" });
    expect(snapshot.projection.sections.F.concomitantProducts).toEqual([]);
    expect(snapshot.downloadReady).toBe(true);
  });
});

const openingAction = { action: "submit-opening", text: openingAccount, reportType: "adverse-event" } as const;

async function answerIndications(repository: InMemoryCaseRepository, caseId: string, kind: "known" | "unknown" | "declined") {
  return performJourneyAction(repository, caseId, {
    action: "answer-indications",
    answers: [
      { productId: "product-apixaban", value: kind === "known" ? { kind, value: "postoperative VTE prophylaxis" } : { kind } },
      { productId: "product-naproxen", value: kind === "known" ? { kind, value: "postoperative pain" } : { kind } },
    ],
  }, fixedJourneyModel);
}

async function completeRemaining(repository: InMemoryCaseRepository, caseId: string) {
  let snapshot = await getJourneySnapshot(repository, caseId);
  while (snapshot.stage === "clarify") {
    const question = snapshot.clarification;
    if (question?.kind === "serious-outcomes") {
      snapshot = await performJourneyAction(repository, caseId, { action: "answer-serious-outcomes", selected: [], disposition: "known" }, fixedJourneyModel);
    } else if (question?.kind === "death-date") {
      snapshot = await performJourneyAction(repository, caseId, { action: "answer-death-date", value: { kind: "unknown" } }, fixedJourneyModel);
    } else if (question?.kind === "clinical-context") {
      snapshot = await performJourneyAction(repository, caseId, {
        action: "answer-clinical-context",
        test: question.askTests ? { kind: "unknown" } : undefined,
        history: question.askHistory ? { kind: "explicitly-absent" } : undefined,
      }, fixedJourneyModel);
    } else if (question?.kind === "reporter") {
      snapshot = await performJourneyAction(repository, caseId, { action: "answer-reporter", reporter: { kind: "declined" } }, fixedJourneyModel);
    } else {
      throw new Error(`Unexpected completion question ${question?.kind}`);
    }
  }
  return snapshot;
}
