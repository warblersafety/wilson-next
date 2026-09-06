import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as getCase, postCase } from "../../app/api/case/route";
import { POST as postBrowserDiagnostic } from "../../app/api/diagnostics/browser/route";
import { consumeJourneyJsonResponse } from "../../app/browser-diagnostics";
import { openingAccount } from "../../src/experiment/fixed-inputs";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import {
  createRuntimeDiagnosticLogger,
  diagnosticContext,
  type RuntimeDiagnosticEvent,
} from "../../src/server/diagnostics/runtime-log";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";
import { ModelCallFailure, type JourneyModel } from "../../src/server/model/journey-model";

const context = {
  runId: "11111111-1111-4111-8111-111111111111",
  operationId: "22222222-2222-4222-8222-222222222222",
};

describe("runtime diagnostics", () => {
  it("carries browser correlation IDs through the route and ordered response event", async () => {
    const state = await initialBrowserState();
    const written: string[] = [];
    const consoleLog = vi.spyOn(console, "log").mockImplementation((value) => written.push(String(value)));
    try {
      const response = await postCase(new NextRequest("http://wilson.test/api/case", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "wilson.test",
          origin: "http://wilson.test",
          "x-wilson-run-id": context.runId,
          "x-wilson-operation-id": context.operationId,
        },
        body: JSON.stringify({
          operation: "act",
          state,
          expectedRevision: 0,
          action: { action: "submit-opening", text: openingAccount, reportType: "adverse-event" },
        }),
      }));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-wilson-run-id")).toBe(context.runId);
      expect(response.headers.get("x-wilson-operation-id")).toBe(context.operationId);
      expect(await response.json()).toMatchObject({
        state: { version: "wilson-browser-state-v1", stage: "understanding", case: { revision: 2 } },
        snapshot: { stage: "understanding", revision: 2 },
      });
      const events = written.map((value) => JSON.parse(value) as RuntimeDiagnosticEvent);
      expect(events.at(0)).toMatchObject({ source: "route", phase: "case-post", outcome: "start", ...context });
      expect(events.at(-2)).toMatchObject({ source: "response", phase: "case-post", outcome: "success", ...context });
      expect(events.at(-1)).toMatchObject({ source: "response", phase: "case-post-trace", outcome: "success", ...context });
      const checkpoint = events.at(-1)?.details as { events: RuntimeDiagnosticEvent[] };
      expect(checkpoint.events.slice(0, 2)).toMatchObject([
        { sequence: 1, source: "route", phase: "case-post", outcome: "start" },
        { sequence: 2, source: "schema-domain", phase: "request-envelope", outcome: "success" },
      ]);
      expect(checkpoint.events.at(-1)).toMatchObject({
        source: "response",
        phase: "case-post",
        outcome: "success",
      });
      expect(JSON.stringify(events.at(-1)).length).toBeLessThan(256_000);
      expect(events.every((event) => event.runId === context.runId && event.operationId === context.operationId)).toBe(true);
    } finally {
      consoleLog.mockRestore();
    }
  });

  it("keeps one validated run ID and one operation ID per request", () => {
    const headers = new Headers({
      "x-wilson-run-id": context.runId,
      "x-wilson-operation-id": context.operationId,
    });
    expect(diagnosticContext(headers)).toEqual(context);

    const generated = [
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    expect(diagnosticContext(new Headers({ "x-wilson-run-id": "not-an-id" }), () => generated.shift()!))
      .toEqual({ runId: "33333333-3333-4333-8333-333333333333", operationId: "44444444-4444-4444-8444-444444444444" });
  });

  it("records ordered model, boundary, command, transition, and response-ready state for success", async () => {
    const repository = new InMemoryCaseRepository();
    const events: RuntimeDiagnosticEvent[] = [];
    const diagnostics = createRuntimeDiagnosticLogger(
      context,
      (event) => events.push(event),
      () => new Date("2026-09-06T20:00:00.000Z"),
    );

    const snapshot = await performJourneyAction(repository, "case-secret-session-value", {
      action: "submit-opening",
      text: openingAccount,
      reportType: "adverse-event",
    }, undefined, diagnostics);

    expect(snapshot).toMatchObject({ stage: "understanding", revision: 2 });
    expect(events.map(({ source, phase, outcome }) => [source, phase, outcome])).toEqual([
      ["state-transition", "action-dispatch", "start"],
      ["model", "request", "start"],
      ["model", "response", "success"],
      ["schema-domain", "proposal-envelope", "success"],
      ["case-command", "attach-grounded-proposals", "start"],
      ["case-command", "attach-grounded-proposals", "success"],
      ["state-transition", "command-attach-opening", "success"],
      ["case-command", "record-clinician-facts", "start"],
      ["case-command", "record-clinician-facts", "success"],
      ["state-transition", "command-record-report-type", "success"],
      ["state-transition", "action-complete", "success"],
    ]);
    expect(events.map(({ sequence }) => sequence).every((sequence, index) => sequence === index + 1)).toBe(true);
    expect(events.every((event) => event.runId === context.runId && event.operationId === context.operationId)).toBe(true);

    const serialized = JSON.stringify(events);
    expect(serialized).toContain(openingAccount);
    expect(serialized).toContain("patient-id");
    expect(serialized).toContain("Patient TEST-57");
    expect(serialized).toContain("product-apixaban");
    expect(serialized).toContain('"stage":"understanding"');
    expect(serialized).not.toContain("case-secret-session-value");
  });

  it("records a controlled failure without advancing the case", async () => {
    const repository = new InMemoryCaseRepository();
    const events: RuntimeDiagnosticEvent[] = [];
    const diagnostics = createRuntimeDiagnosticLogger(context, (event) => events.push(event));

    await expect(performJourneyAction(
      repository,
      "case-controlled-failure",
      { action: "accept-understanding" },
      undefined,
      diagnostics,
    )).rejects.toThrow("not available during describe");

    expect(events.map(({ source, phase, outcome }) => [source, phase, outcome])).toEqual([
      ["state-transition", "action-dispatch", "start"],
      ["state-transition", "action-dispatch", "failure"],
    ]);
    expect((await getJourneySnapshot(repository, "case-controlled-failure")).revision).toBe(0);
  });

  it("records schema/domain rejection and withholds non-fixture input content", async () => {
    const repository = new InMemoryCaseRepository();
    const events: RuntimeDiagnosticEvent[] = [];
    const diagnostics = createRuntimeDiagnosticLogger(context, (event) => events.push(event));

    await expect(performJourneyAction(repository, "case-schema-rejection", {
      action: "submit-opening",
      text: "not the approved synthetic fixture",
      reportType: "adverse-event",
    }, undefined, diagnostics)).rejects.toThrow("only the displayed fictional opening account");

    expect(events.map(({ source, phase, outcome }) => [source, phase, outcome])).toEqual([
      ["state-transition", "action-dispatch", "start"],
      ["model", "request", "start"],
      ["schema-domain", "model-request-input", "rejected"],
      ["state-transition", "action-dispatch", "failure"],
    ]);
    expect(JSON.stringify(events)).not.toContain("not the approved synthetic fixture");
    expect((await getJourneySnapshot(repository, "case-schema-rejection")).revision).toBe(0);
  });

  it("logs provider transport failure without claiming returned content or schema rejection", async () => {
    const repository = new InMemoryCaseRepository();
    const events: RuntimeDiagnosticEvent[] = [];
    const diagnostics = createRuntimeDiagnosticLogger(context, (event) => events.push(event));
    const model: JourneyModel = {
      async propose() {
        throw new ModelCallFailure("Provider unavailable", {
          phase: "provider-request",
          errorName: "APIConnectionError",
        });
      },
    };

    await expect(performJourneyAction(repository, "case-provider-failure", {
      action: "submit-opening",
      text: openingAccount,
      reportType: "adverse-event",
    }, model, diagnostics)).rejects.toThrow("Provider unavailable");

    expect(events.map(({ source, phase, outcome }) => [source, phase, outcome])).toEqual([
      ["state-transition", "action-dispatch", "start"],
      ["model", "request", "start"],
      ["model", "response", "failure"],
      ["state-transition", "action-dispatch", "failure"],
    ]);
    expect(events.some(({ source, outcome }) => source === "schema-domain" && outcome === "rejected")).toBe(false);
  });

  it("logs returned model content before the precise structured-content rejection", async () => {
    const repository = new InMemoryCaseRepository();
    const events: RuntimeDiagnosticEvent[] = [];
    const diagnostics = createRuntimeDiagnosticLogger(context, (event) => events.push(event));
    const returnedResponse = { id: "msg-returned", content: [{ type: "text", text: "not-json" }] };
    const model: JourneyModel = {
      async propose() {
        throw new ModelCallFailure(
          "Invalid returned content",
          { phase: "structured-json", requestId: "msg-returned" },
          {
            model: "claude-sonnet-5",
            promptRevision: "prompt-v2",
            schemaRevision: "schema-v2",
            inputTokens: 10,
            outputTokens: 2,
            latencyMs: 50,
            estimatedCostUsd: 0.00004,
          },
          returnedResponse,
        );
      },
    };

    await expect(performJourneyAction(repository, "case-content-failure", {
      action: "submit-opening",
      text: openingAccount,
      reportType: "adverse-event",
    }, model, diagnostics)).rejects.toThrow("Invalid returned content");

    expect(events.map(({ source, phase, outcome }) => [source, phase, outcome])).toEqual([
      ["state-transition", "action-dispatch", "start"],
      ["model", "request", "start"],
      ["model", "response", "success"],
      ["schema-domain", "structured-json", "rejected"],
      ["state-transition", "action-dispatch", "failure"],
    ]);
    expect(events[2].details).toMatchObject({ response: returnedResponse });
  });

  it("does not relabel a provider failure in the outer case route", async () => {
    const state = await initialBrowserState();
    const written: string[] = [];
    const consoleLog = vi.spyOn(console, "log").mockImplementation((value) => written.push(String(value)));
    const consoleError = vi.spyOn(console, "error").mockImplementation((value) => written.push(String(value)));
    const model: JourneyModel = {
      async propose() {
        throw new ModelCallFailure("Provider unavailable", { phase: "provider-request", errorName: "APIConnectionError" });
      },
    };
    try {
      const response = await postCase(casePostRequest({
        operation: "act",
        state,
        expectedRevision: 0,
        action: { action: "submit-opening", text: openingAccount, reportType: "adverse-event" },
      }), model);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: "model-provider-request",
        diagnosticReference: context.operationId,
      });
      const events = written.map((value) => JSON.parse(value) as RuntimeDiagnosticEvent);
      expect(events).toContainEqual(expect.objectContaining({ source: "model", phase: "response", outcome: "failure" }));
      expect(events).toContainEqual(expect.objectContaining({ source: "route", phase: "case-action", outcome: "failure" }));
      expect(events.some(({ source, outcome }) => source === "schema-domain" && outcome === "rejected")).toBe(false);
    } finally {
      consoleLog.mockRestore();
      consoleError.mockRestore();
    }
  });

  it("redacts credential-bearing fields and credential-shaped caught-error data without hiding token counts", () => {
    const events: RuntimeDiagnosticEvent[] = [];
    const diagnostics = createRuntimeDiagnosticLogger(context, (event) => events.push(event));
    const error = Object.assign(new Error(
      "provider failed with Bearer visible-value and ANTHROPIC_API_KEY=another-value",
    ), {
      authorization: "Bearer nested-value",
      provider: { accessToken: "third-value", type: "synthetic" },
      "x-vercel-protection-bypass": "prefixed-value",
    });

    diagnostics.event("model", "credential-test", "failure", {
      headers: { authorization: "Bearer header-value", "content-type": "application/json" },
      cookies: { session: "cookie-value" },
      environmentValues: { ANTHROPIC_API_KEY: "env-value" },
      inputTokens: 123,
      outputTokens: 45,
      error,
    });
    diagnostics.checkpoint("credential-test-trace", "failure");

    const serialized = JSON.stringify(events);
    for (const credential of ["visible-value", "another-value", "nested-value", "third-value", "prefixed-value", "header-value", "cookie-value", "env-value"]) {
      expect(serialized).not.toContain(credential);
    }
    expect(events[0].details).toMatchObject({ inputTokens: 123, outputTokens: 45 });
    expect(events[1]).toMatchObject({ source: "response", phase: "credential-test-trace", outcome: "failure" });
    expect(serialized).toContain("[REDACTED]");
  });

  it("forwards a non-JSON browser response body and parse error with the same operation context", async () => {
    const events: unknown[] = [];
    const response = new Response("upstream returned an HTML error", {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "Content-Type": "text/html", "Content-Length": "31" },
    });

    await expect(consumeJourneyJsonResponse(
      response,
      async (event) => { events.push(event); },
      "Wilson could not update the case",
    )).rejects.toThrow("response was not JSON");

    expect(events).toMatchObject([
      {
        phase: "response-received",
        outcome: "failure",
        response: { status: 502, contentType: "text/html", body: "upstream returned an HTML error" },
      },
      {
        phase: "response-parse-failed",
        outcome: "failure",
        response: { status: 502, body: "upstream returned an HTML error" },
        error: { name: "SyntaxError" },
      },
    ]);
  });

  it("records a cumulative browser trace so the final report reconstructs the operation", async () => {
    const browserTrace = [
      {
        browserSequence: 1,
        phase: "request-start" as const,
        outcome: "start" as const,
        request: {
          method: "POST" as const,
          path: "/api/case" as const,
          body: { action: "submit-opening", text: openingAccount, reportType: "adverse-event" },
        },
      },
      {
        browserSequence: 2,
        phase: "response-received" as const,
        outcome: "failure" as const,
        response: {
          status: 502,
          statusText: "Bad Gateway",
          contentType: "text/html",
          contentLength: "31",
          body: "upstream returned an HTML error",
        },
      },
      {
        browserSequence: 3,
        phase: "response-parse-failed" as const,
        outcome: "failure" as const,
        response: {
          status: 502,
          statusText: "Bad Gateway",
          contentType: "text/html",
          contentLength: "31",
          body: "upstream returned an HTML error",
        },
        error: { name: "SyntaxError", message: "Unexpected token" },
      },
    ];
    const written: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((value) => written.push(String(value)));
    try {
      const response = await postBrowserDiagnostic(new NextRequest("https://wilson.test/api/diagnostics/browser", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "wilson.test",
          origin: "https://wilson.test",
          "x-forwarded-proto": "https",
          "x-wilson-run-id": context.runId,
          "x-wilson-operation-id": context.operationId,
        },
        body: JSON.stringify({ event: browserTrace.at(-1), trace: browserTrace }),
      }));

      expect(response.status).toBe(204);
      const event = JSON.parse(written[0]) as RuntimeDiagnosticEvent;
      expect(event).toMatchObject({ source: "browser", phase: "response-parse-failed", outcome: "failure", ...context });
      expect(event.details).toMatchObject({
        trace: [
          { browserSequence: 1, phase: "request-start", request: { body: { text: openingAccount } } },
          { browserSequence: 2, phase: "response-received", response: { status: 502 } },
          { browserSequence: 3, phase: "response-parse-failed", error: { name: "SyntaxError" } },
        ],
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});

async function initialBrowserState() {
  const response = await getCase(new NextRequest("http://wilson.test/api/case"));
  return (await response.json()).state;
}

function casePostRequest(body: unknown) {
  return new NextRequest("http://wilson.test/api/case", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "wilson.test",
      origin: "http://wilson.test",
      "x-wilson-run-id": context.runId,
      "x-wilson-operation-id": context.operationId,
    },
    body: JSON.stringify(body),
  });
}
