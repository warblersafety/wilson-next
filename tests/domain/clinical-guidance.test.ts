import { describe, expect, it } from "vitest";
import { clinicalNeedParts, canSaveReporter } from "../../app/clinical-guidance";
import { flowAlignmentState } from "../fixtures/flow-alignment";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";
import type { JourneyModel } from "../../src/server/model/journey-model";

const noModel: JourneyModel = { propose: async () => { throw new Error("No model calls"); } };

async function setup() {
  const state = await flowAlignmentState();
  const repository = new InMemoryCaseRepository({ initialCase: state.case });
  return { snapshot: await getJourneySnapshot(repository, state.case.id), act: (action: Parameters<typeof performJourneyAction>[2]) => performJourneyAction(repository, state.case.id, action, noModel) };
}

describe("clinical guidance uses existing review and completion state", () => {
  it("distinguishes missing outcomes, pending history/tests and conditional medication follow-ups without settling them", async () => {
    const { snapshot } = await setup();
    const before = structuredClone(snapshot);
    const parts = clinicalNeedParts(snapshot);
    expect(parts.find(({ need }) => need.kind === "serious-outcomes")).toMatchObject({ pending: [], missing: ["event:event:otherSerious"] });
    expect(parts.find(({ need }) => need.kind === "clinical-context")).toMatchObject({ pending: ["event:event:relevantTestsAvailable", "event:event:relevantHistory"], missing: [] });
    expect(parts.find(({ need }) => need.kind === "medication-history")).toMatchObject({ recheckAfterReview: true });
    expect(canSaveReporter(snapshot)).toBe(false);
    expect(snapshot).toEqual(before);
  });

  it("returns rejected answers to missing and leaves other proposals pending", async () => {
    const { snapshot, act } = await setup();
    const historyGroup = snapshot.understanding.event.relevantHistory.proposals[0].groupId;
    const rejected = await act({ action: "review-update-group", groupId: historyGroup, decision: "reject" });
    expect(clinicalNeedParts(rejected).find(({ need }) => need.kind === "clinical-context")).toMatchObject({ pending: ["event:event:relevantTestsAvailable"], missing: ["event:event:relevantHistory"] });
    expect(rejected.downloadReady).toBe(false);
    expect(canSaveReporter(rejected)).toBe(false);
  });

  it("recalculates conditional needs only after acceptance and keeps the actual outcome gate", async () => {
    const { snapshot, act } = await setup();
    const group = snapshot.understanding.products[0].facts.stopped.proposals[0].groupId;
    const reviewed = await act({ action: "review-update-group", groupId: group, decision: "accept" });
    expect(clinicalNeedParts(reviewed).find(({ need }) => need.kind === "medication-history")).toBeUndefined();
    expect(clinicalNeedParts(reviewed).find(({ need }) => need.kind === "serious-outcomes")?.missing).toEqual(["event:event:otherSerious"]);
    expect(reviewed.downloadReady).toBe(false);
  });
});
