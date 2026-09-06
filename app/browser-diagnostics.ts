"use client";

import { operationIdHeader, runIdHeader } from "../src/diagnostics/correlation";

const runIdStorageKey = "wilson-diagnostic-run-id";
const correlationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let browserSequence = 0;

interface BrowserContext {
  runId: string;
  operationId: string;
}

interface BrowserEvent {
  browserSequence: number;
  phase: "request-start" | "response-received" | "response-parse-failed" | "request-failed";
  outcome: "start" | "success" | "failure";
  request?: { method: "GET" | "POST"; path: "/api/case"; body?: unknown };
  response?: ResponseDetails;
  error?: unknown;
}

interface ResponseDetails {
  status: number;
  statusText: string;
  contentType: string | null;
  contentLength: string | null;
  body: string;
}

type BrowserReporter = (event: BrowserEvent) => Promise<void>;

export async function requestJourneyJson<T>(
  init: { method?: "GET" | "POST"; body?: unknown } = {},
  fallbackMessage: string,
): Promise<T> {
  const context = createBrowserContext();
  const method = init.method ?? "GET";
  const request = { method, path: "/api/case" as const, ...(init.body === undefined ? {} : { body: init.body }) };
  const report = reporter(context);
  await report({ browserSequence: ++browserSequence, phase: "request-start", outcome: "start", request });

  let response: Response;
  try {
    response = await fetch("/api/case", {
      method,
      cache: "no-store",
      headers: {
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        [runIdHeader]: context.runId,
        [operationIdHeader]: context.operationId,
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch (error) {
    await report({
      browserSequence: ++browserSequence,
      phase: "request-failed",
      outcome: "failure",
      request,
      error: browserError(error),
    });
    throw new Error(fallbackMessage, { cause: error });
  }
  return consumeJourneyJsonResponse<T>(response, report, fallbackMessage);
}

export async function consumeJourneyJsonResponse<T>(
  response: Response,
  report: BrowserReporter,
  fallbackMessage: string,
): Promise<T> {
  const body = await response.text();
  const responseDetails: ResponseDetails = {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length"),
    body,
  };
  await report({
    browserSequence: ++browserSequence,
    phase: "response-received",
    outcome: response.ok ? "success" : "failure",
    response: responseDetails,
  });

  let decoded: unknown;
  try {
    decoded = JSON.parse(body);
  } catch (error) {
    await report({
      browserSequence: ++browserSequence,
      phase: "response-parse-failed",
      outcome: "failure",
      response: responseDetails,
      error: browserError(error),
    });
    throw new Error(`${fallbackMessage} (the response was not JSON)`, { cause: error });
  }
  if (!response.ok) {
    const message = decoded && typeof decoded === "object" && "error" in decoded && typeof decoded.error === "string"
      ? decoded.error
      : fallbackMessage;
    throw new Error(message);
  }
  return decoded as T;
}

function createBrowserContext(): BrowserContext {
  const existing = window.sessionStorage.getItem(runIdStorageKey);
  const runId = existing && correlationIdPattern.test(existing) ? existing : crypto.randomUUID();
  if (runId !== existing) window.sessionStorage.setItem(runIdStorageKey, runId);
  return { runId, operationId: crypto.randomUUID() };
}

function reporter(context: BrowserContext): BrowserReporter {
  const trace: BrowserEvent[] = [];
  return async (event) => {
    trace.push(event);
    try {
      await fetch("/api/diagnostics/browser", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          [runIdHeader]: context.runId,
          [operationIdHeader]: context.operationId,
        },
        body: JSON.stringify({ event, trace }),
      });
    } catch {
      // Diagnostics must never replace the visible application failure.
    }
  };
}

function browserError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause,
  };
}
