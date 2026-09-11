import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as getCase, postCase } from "../../app/api/case/route";
import {
  assertExpectedBrowserRevision,
  assertStoredStage,
  browserStateVersion,
  BrowserStateError,
  journeyResponse,
  parseBrowserJourneyState,
  repositoryForBrowserState,
} from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";
import { openingAccount } from "../fixtures/fixed-inputs";
import { fixedJourneyModel } from "../fixtures/fixed-journey";

describe("browser-held journey state boundary", () => {
  it("reconstructs the same compatible state through fresh request repositories", async () => {
    const original = new InMemoryCaseRepository({ maxCases: 1 });
    const caseId = `case-${randomUUID()}`;
    const snapshot = await performJourneyAction(original, caseId, {
      action: "submit-opening",
      text: openingAccount,
      reportType: "adverse-event",
    }, fixedJourneyModel);
    const response = await journeyResponse(original, snapshot);
    const parsed = parseBrowserJourneyState(structuredClone(response.state));

    const firstRequest = repositoryForBrowserState(parsed);
    const secondRequest = repositoryForBrowserState(parsed);
    expect(firstRequest).not.toBe(secondRequest);
    const firstSnapshot = await getJourneySnapshot(firstRequest, caseId, parsed.unrepresented);
    const secondSnapshot = await getJourneySnapshot(secondRequest, caseId, parsed.unrepresented);
    assertStoredStage(parsed, firstSnapshot);
    assertStoredStage(parsed, secondSnapshot);
    expect(firstSnapshot).toEqual(response.snapshot);
    expect(secondSnapshot).toEqual(response.snapshot);
  });

  it("rejects incompatible, malformed, stale-revision, and stale-stage state", async () => {
    expect(() => parseBrowserJourneyState({
      version: "wilson-browser-state-v0",
      stage: "describe",
      case: {},
    })).toThrowError(expect.objectContaining({ code: "incompatible-browser-state" }));

    expect(() => parseBrowserJourneyState({
      version: browserStateVersion,
      stage: "describe",
      case: { id: "case-not-complete" },
      unrepresented: [],
    })).toThrowError(expect.objectContaining({ code: "malformed-browser-state" }));

    const repository = new InMemoryCaseRepository({ maxCases: 1 });
    const caseId = `case-${randomUUID()}`;
    const snapshot = await getJourneySnapshot(repository, caseId);
    const response = await journeyResponse(repository, snapshot);
    expect(() => assertExpectedBrowserRevision(response.state, 1)).toThrowError(
      expect.objectContaining({ code: "stale-browser-state" }),
    );
    expect(() => assertStoredStage(
      { ...response.state, stage: "understanding" },
      response.snapshot,
    )).toThrow(BrowserStateError);
  });

  it("rejects a structurally valid case whose history is not contiguous", async () => {
    const repository = new InMemoryCaseRepository({ maxCases: 1 });
    const caseId = `case-${randomUUID()}`;
    const snapshot = await performJourneyAction(repository, caseId, {
      action: "submit-opening",
      text: openingAccount,
      reportType: "adverse-event",
    }, fixedJourneyModel);
    const response = await journeyResponse(repository, snapshot);
    const malformed = structuredClone(response.state);
    malformed.case.changes[1].priorRevision = 99;
    expect(() => parseBrowserJourneyState(malformed)).toThrowError(
      expect.objectContaining({ code: "malformed-browser-state" }),
    );
  });

  it("retains quarantine notices outside accepted case knowledge through browser reconstruction", async () => {
    const repository = new InMemoryCaseRepository({ maxCases: 1 });
    const caseId = `case-${randomUUID()}`;
    const snapshot = await performJourneyAction(repository, caseId, {
      action: "submit-opening", text: openingAccount, reportType: "adverse-event",
    }, fixedJourneyModel);
    snapshot.unrepresented.push({
      entity: "event",
      field: "symptoms",
      evidenceQuote: "melena and dizziness",
      reason: "incompatible-value",
    });
    const response = await journeyResponse(repository, snapshot);
    const parsed = parseBrowserJourneyState(structuredClone(response.state));
    const restoredRepository = repositoryForBrowserState(parsed);
    const restoredSnapshot = await getJourneySnapshot(restoredRepository, caseId, parsed.unrepresented);

    expect(parsed.case).not.toHaveProperty("unrepresented");
    expect(restoredSnapshot.unrepresented).toEqual(snapshot.unrepresented);
  });

  it("uses the domain-owned 150-year age boundary when restoring browser state", async () => {
    const repository = new InMemoryCaseRepository({ maxCases: 1 });
    const caseId = `case-${randomUUID()}`;
    const snapshot = await performJourneyAction(repository, caseId, {
      action: "submit-opening", text: openingAccount, reportType: "adverse-event",
    }, fixedJourneyModel);
    const response = await journeyResponse(repository, snapshot);
    const atBoundary = structuredClone(response.state);
    atBoundary.case.patient.facts.ageYears.proposedValues[0].value = { kind: "known", value: 150 };
    expect(parseBrowserJourneyState(atBoundary).case.patient.facts.ageYears.proposedValues[0].value)
      .toEqual({ kind: "known", value: 150 });

    const outsideBoundary = structuredClone(atBoundary);
    outsideBoundary.case.patient.facts.ageYears.proposedValues[0].value = { kind: "known", value: 151 };
    expect(() => parseBrowserJourneyState(outsideBoundary)).toThrowError(
      expect.objectContaining({ code: "malformed-browser-state" }),
    );
  });

  it("returns opaque references for incompatible and stale request state", async () => {
    const initial = await getCase(new NextRequest("http://wilson.test/api/case"));
    const state = (await initial.json()).state;

    const incompatible = await postCase(routeRequest({
      operation: "resume",
      state: { ...state, version: "wilson-browser-state-v0" },
    }));
    expect(incompatible.status).toBe(400);
    expect(await incompatible.json()).toMatchObject({
      code: "incompatible-browser-state",
      diagnosticReference: expect.any(String),
    });

    const stale = await postCase(routeRequest({
      operation: "act",
      state,
      expectedRevision: 1,
      action: { action: "submit-opening", text: openingAccount, reportType: "adverse-event" },
    }));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      code: "stale-browser-state",
      diagnosticReference: expect.any(String),
    });
  });
});

function routeRequest(body: unknown) {
  return new NextRequest("http://wilson.test/api/case", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "wilson.test",
      origin: "http://wilson.test",
    },
    body: JSON.stringify(body),
  });
}
