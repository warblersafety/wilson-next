import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST as postCase } from "../../app/api/case/route";
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

const context = {
  runId: "11111111-1111-4111-8111-111111111111",
  operationId: "22222222-2222-4222-8222-222222222222",
};

describe("runtime diagnostics", () => {
  it("carries browser correlation IDs through the route and ordered response event", async () => {
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
        body: JSON.stringify({ action: "submit-opening", text: openingAccount, reportType: "adverse-event" }),
      }));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-wilson-run-id")).toBe(context.runId);
      expect(response.headers.get("x-wilson-operation-id")).toBe(context.operationId);
      expect(await response.json()).toMatchObject({ stage: "understanding", revision: 2 });
      const events = written.map((value) => JSON.parse(value) as RuntimeDiagnosticEvent);
      expect(events.at(0)).toMatchObject({ source: "route", phase: "case-post", outcome: "start", ...context });
      expect(events.at(-2)).toMatchObject({ source: "response", phase: "case-post", outcome: "success", ...context });
      expect(events.at(-1)).toMatchObject({ source: "response", phase: "case-post-trace", outcome: "success", ...context });
      const checkpoint = events.at(-1)?.details as { events: RuntimeDiagnosticEvent[] };
      expect(checkpoint.events.slice(0, 2)).toMatchObject([
        { sequence: 1, source: "route", phase: "case-post", outcome: "start" },
        { sequence: 2, source: "schema-domain", phase: "request-action", outcome: "success" },
      ]);
      expect(checkpoint.events.at(-1)).toMatchObject({
        sequence: 14,
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
      ["schema-domain", "proposal-envelope", "rejected"],
      ["model", "response", "failure"],
      ["state-transition", "action-dispatch", "failure"],
    ]);
    expect(JSON.stringify(events)).not.toContain("not the approved synthetic fixture");
    expect((await getJourneySnapshot(repository, "case-schema-rejection")).revision).toBe(0);
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
