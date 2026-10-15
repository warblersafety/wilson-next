import { removeBirthDateFields } from "../fixtures/pre-dob";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { postCase } from "../../app/api/case/route";
import { browserStateVersion, journeyProvenance, journeyResponse, parseBrowserJourneyState, type JourneyResponse } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { acceptCorrectionAndConflict, acceptOpeningCase, answerIndications, attachCorrectionAndContradiction, createOpeningCase } from "../domain/fixture";

function request(body: unknown) {
  return new NextRequest("http://wilson.test/api/case", {
    method: "POST", headers: { "content-type": "application/json", host: "wilson.test", origin: "http://wilson.test" }, body: JSON.stringify(body),
  });
}

async function fixture(kind: "pending" | "conflicted" | "accepted") {
  const clinical = kind === "pending" ? createOpeningCase()
    : kind === "conflicted" ? acceptCorrectionAndConflict(attachCorrectionAndContradiction(answerIndications(acceptOpeningCase())))
    : acceptOpeningCase();
  const browserCase = { ...clinical, id: `case-${randomUUID()}` };
  const repository = new InMemoryCaseRepository({ initialCase: browserCase });
  const snapshot = await getJourneySnapshot(repository, browserCase.id, [{
    entity: "event", field: "symptoms", evidenceQuote: "fictional unrepresented detail", reason: "incompatible-value",
  }]);
  return journeyResponse(repository, snapshot);
}

const noModel = () => ({ propose: vi.fn(async () => { throw new Error("Resume must not call the model"); }) });

describe("durable clinical resume prerequisite", () => {
  it.each(["pending", "conflicted", "accepted"] as const)("rederives %s stage without changing any clinical state or replaying input", async (kind) => {
    const original = await fixture(kind);
    const saved = structuredClone(original.state);
    saved.stage = "describe"; // An old release's derived view is not clinical authority.
    const model = noModel();
    const response = await postCase(request({ operation: "resume", state: saved }), model);
    expect(response.status).toBe(200);
    const resumed = await response.json() as JourneyResponse;
    expect(resumed.state).toEqual(original.state);
    expect(resumed.snapshot).toEqual({ ...original.snapshot, transitionNotice: original.snapshot.stage === "clarify"
      ? "Your case was restored. Additional report details are needed before the PDF is ready."
      : "Your case was restored. Review the current case details before continuing." });
    expect(resumed.state.case.revision).toBe(saved.case.revision);
    expect(model.propose).not.toHaveBeenCalled();
    if (kind === "pending") expect(resumed.state.case.patient.facts.ageYears.proposedValues.length).toBeGreaterThan(0);
    if (kind === "conflicted") {
      expect(resumed.state.case.products[0].facts.startDate.conflictingValues.length).toBeGreaterThan(0);
      expect(resumed.state.case.products[1].facts.dose.supersededValues.length).toBeGreaterThan(0);
    }

    // The same stale envelope cannot issue an action until it has resumed.
    const rejected = await postCase(request({ operation: "act", state: saved, expectedRevision: saved.case.revision,
      action: { action: "submit-update", text: "Do not replay this fictional text" } }), model);
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({ code: "stale-browser-state" });
    expect(model.propose).not.toHaveBeenCalled();
  });

  it.each(["v7", "v8", "v9", "v10", "v11"])("retains the %s migration on the resume route", async (version) => {
    const original = await fixture("accepted");
    const legacy = JSON.parse(JSON.stringify(original.state));
    legacy.version = `wilson-browser-state-${version}`;
    removeBirthDateFields(legacy.case);
    legacy.stage = "output";
    for (const product of legacy.case.products) {
      if (version !== "v11") delete product.facts.ndcOrUniqueId;
      if (version !== "v10" && version !== "v11") for (const field of ["medicationType", "doseReduced", "improvedAfterChange", "restarted", "recurred"]) delete product.facts[field];
      if (version === "v7") delete product.facts.strength;
    }
    if (version === "v7") delete legacy.case.event.facts.reportDate;
    if (version === "v7" || version === "v8") for (const test of legacy.case.relevantTests) delete test.facts.testName;
    const before = structuredClone(legacy);
    expect(parseBrowserJourneyState(legacy)).toEqual({ ...original.state, stage: "output" });
    expect(legacy).toEqual(before); // Direct parser call, not the serialized route input.
    const model = noModel();
    const response = await postCase(request({ operation: "resume", state: legacy }), model);
    expect(response.status).toBe(200);
    const resumed = await response.json() as JourneyResponse;
    expect(resumed.state).toEqual(original.state);
    expect(resumed.snapshot).toEqual({ ...original.snapshot, transitionNotice: "Your case was restored. Additional report details are needed before the PDF is ready." });
    expect(legacy).toEqual(before);
    expect(model.propose).not.toHaveBeenCalled();
  });

  it("rejects malformed and unsupported inputs without calling the model", async () => {
    const { state } = await fixture("conflicted");
    const malformed = structuredClone(state);
    malformed.case.changes[0].resultingRevision = 99;
    for (const [candidate, code] of [[malformed, "malformed-browser-state"], [{ ...state, version: "wilson-browser-state-v999" }, "incompatible-browser-state"]] as const) {
      const model = noModel();
      const response = await postCase(request({ operation: "resume", state: candidate }), model);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code });
      expect(model.propose).not.toHaveBeenCalled();
    }
  });

  it("exposes only validated public commit identity and current clinical format", async () => {
    const sha = "ABCDEF01".repeat(5);
    expect(journeyProvenance(sha)).toEqual({ release: sha.toLowerCase(), stateVersion: browserStateVersion });
    for (const input of ["", "local", "a".repeat(39), "a".repeat(41), "z".repeat(40), ` ${sha}`, `${sha}\n`, "private environment material"]) {
      expect(journeyProvenance(input)).toEqual({ release: null, stateVersion: browserStateVersion });
    }
    const { state } = await fixture("pending");
    const response = await postCase(request({ operation: "resume", state }), noModel());
    const body = await response.json() as JourneyResponse;
    expect(body.provenance).toEqual(journeyProvenance());
    expect(body.snapshot).not.toHaveProperty("transitionNotice");
    expect(body.state).not.toHaveProperty("provenance");
  });
});
