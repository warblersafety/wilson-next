import { describe, expect, it } from "vitest";
import { clinicalNeedParts, canSaveReporter, nextClinicalAction, singleEntityGroup } from "../../app/clinical-guidance";
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

  it("routes through update review, separate tests and questions without equating reporter saving with clinical completion", async () => {
    const { snapshot, act } = await setup();
    expect(nextClinicalAction(snapshot)?.kind).toBe("updates");
    await act({ action: "review-update-group", groupId: snapshot.understanding.event.relevantHistory.proposals[0].groupId, decision: "accept" });
    let next = await act({ action: "review-update-group", groupId: snapshot.understanding.products[0].facts.stopped.proposals[0].groupId, decision: "accept" });
    expect(nextClinicalAction(next)?.kind).toBe("proposals");
    for (const test of next.understanding.relevantTests) next = await act({ action: "review-opening-group", groupId: test.proposalGroupId!, corrections: [] });
    expect(nextClinicalAction(next)?.kind).toBe("questions");
    expect(canSaveReporter(next)).toBe(false);
    const previouslySaved = structuredClone(next);
    previouslySaved.understanding.reporter.email.resolved = { kind: "known", value: "fictional@example.test" };
    expect(canSaveReporter(previouslySaved)).toBe(true);
    expect(nextClinicalAction(previouslySaved)?.kind).toBe("questions");
    expect(previouslySaved.downloadReady).toBe(false);
  });

  it("uses stable entity identity to decide whether a group can omit repeated entity prefixes", () => {
    expect(singleEntityGroup(["product:first:name", "product:first:dose"])).toBe(true);
    expect(singleEntityGroup(["product:first:dose", "product:second:dose"])).toBe(false);
    expect(singleEntityGroup(["product:first:name", "test:first:testName"])).toBe(false);
    expect(singleEntityGroup([])).toBe(false);
  });
});
