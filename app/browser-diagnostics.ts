"use client";

import { operationIdHeader, runIdHeader } from "../src/diagnostics/correlation";
import type { BrowserJourneyState } from "../src/server/case/browser-state";

const runIdStorageKey = "wilson-diagnostic-run-id";
export const journeyStateStorageKey = "wilson-journey-state-v1";
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
  request?: { method: "GET" | "POST"; path: "/api/case" | "/api/case/pdf"; body?: unknown };
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

export class JourneyRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly diagnosticReference?: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "JourneyRequestError";
  }
}

export async function requestJourneyJson<T>(
  init: { method?: "GET" | "POST"; body?: unknown } = {},
  fallbackMessage: string,
): Promise<T> {
  const context = createBrowserContext();
  const method = init.method ?? "GET";
  const request = {
    method,
    path: "/api/case" as const,
    ...(init.body === undefined ? {} : { body: diagnosticRequestBody(init.body) }),
  };
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
    throw new JourneyRequestError(fallbackMessage, undefined, context.operationId, undefined, { cause: error });
  }
  return consumeJourneyJsonResponse<T>(response, report, fallbackMessage);
}

export async function requestJourneyPdf(
  state: BrowserJourneyState,
  mode: "preview" | "download",
): Promise<{ blob: Blob; filename: string }> {
  const context = createBrowserContext();
  const report = reporter(context);
  const request = {
    method: "POST" as const,
    path: "/api/case/pdf" as const,
    body: { mode, state: "[BROWSER STATE NOT LOGGED]" },
  };
  await report({ browserSequence: ++browserSequence, phase: "request-start", outcome: "start", request });

  let response: Response;
  try {
    response = await fetch("/api/case/pdf", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        [runIdHeader]: context.runId,
        [operationIdHeader]: context.operationId,
      },
      body: JSON.stringify({ mode, state }),
    });
  } catch (error) {
    await report({
      browserSequence: ++browserSequence,
      phase: "request-failed",
      outcome: "failure",
      request,
      error: browserError(error),
    });
    throw new JourneyRequestError(
      "The official PDF could not be generated",
      undefined,
      context.operationId,
      undefined,
      { cause: error },
    );
  }

  if (!response.ok) {
    return consumeJourneyJsonResponse<never>(response, report, "The official PDF could not be generated");
  }
  const blob = await response.blob();
  await report({
    browserSequence: ++browserSequence,
    phase: "response-received",
    outcome: "success",
    response: responseDetails(response, "[PDF BYTES NOT LOGGED]"),
  });
  return {
    blob,
    filename: response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]
      ?? "wilson-form-fda-3500.pdf",
  };
}

export async function consumeJourneyJsonResponse<T>(
  response: Response,
  report: BrowserReporter,
  fallbackMessage: string,
): Promise<T> {
  const body = await response.text();
  const details = responseDetails(response, body);
  await report({
    browserSequence: ++browserSequence,
    phase: "response-received",
    outcome: response.ok ? "success" : "failure",
    response: details,
  });

  let decoded: unknown;
  try {
    decoded = JSON.parse(body);
  } catch (error) {
    await report({
      browserSequence: ++browserSequence,
      phase: "response-parse-failed",
      outcome: "failure",
      response: details,
      error: browserError(error),
    });
    throw new JourneyRequestError(
      `${fallbackMessage} (the response was not JSON)`,
      undefined,
      response.headers.get(operationIdHeader) ?? undefined,
      response.status,
      { cause: error },
    );
  }
  if (!response.ok) {
    const failure = decoded && typeof decoded === "object" ? decoded as Record<string, unknown> : {};
    const message = typeof failure.error === "string" ? failure.error : fallbackMessage;
    const code = typeof failure.code === "string" ? failure.code : undefined;
    const reference = typeof failure.diagnosticReference === "string"
      ? failure.diagnosticReference
      : response.headers.get(operationIdHeader) ?? undefined;
    throw new JourneyRequestError(message, code, reference, response.status);
  }
  return decoded as T;
}

export function readStoredJourneyState(): unknown | undefined {
  const value = window.sessionStorage.getItem(journeyStateStorageKey);
  if (value === null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    window.sessionStorage.removeItem(journeyStateStorageKey);
    return undefined;
  }
}

export function storeJourneyState(state: BrowserJourneyState): void {
  window.sessionStorage.setItem(journeyStateStorageKey, JSON.stringify(state));
}

export function clearJourneySession(): void {
  window.sessionStorage.removeItem(journeyStateStorageKey);
  window.sessionStorage.removeItem(runIdStorageKey);
  browserSequence = 0;
}

function responseDetails(response: Response, body: string): ResponseDetails {
  return {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length"),
    body,
  };
}

function diagnosticRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("state" in body)) return body;
  return { ...(body as Record<string, unknown>), state: "[BROWSER STATE NOT LOGGED]" };
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
