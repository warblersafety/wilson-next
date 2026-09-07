import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { correctionAccount, indicationAnswer, openingAccount } from "../../../src/experiment/fixed-inputs";
import {
  assertExpectedBrowserRevision,
  assertStoredStage,
  BrowserStateError,
  journeyResponse,
  parseBrowserJourneyState,
  repositoryForBrowserState,
} from "../../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../../src/server/case/repository";
import {
  caughtErrorDetails,
  createRuntimeDiagnosticLogger,
  diagnosticContext,
  operationIdHeader,
  runIdHeader,
  type DiagnosticContext,
  type RuntimeDiagnosticLogger,
} from "../../../src/server/diagnostics/runtime-log";
import { getJourneySnapshot, performJourneyAction } from "../../../src/server/journey/service";
import { createAnthropicJourneyModel } from "../../../src/server/model/anthropic-journey";
import { fixedJourneyModel } from "../../../src/server/model/fixed-journey";
import { ModelCallFailure, type JourneyModel } from "../../../src/server/model/journey-model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit-opening"), text: z.string(), reportType: z.literal("adverse-event") }).strict(),
  z.object({ action: z.literal("change-patient-age"), ageYears: z.literal(58) }).strict(),
  z.object({ action: z.literal("remove-lisinopril") }).strict(),
  z.object({ action: z.literal("accept-understanding") }).strict(),
  z.object({ action: z.literal("answer-indications"), text: z.string() }).strict(),
  z.object({ action: z.literal("submit-correction"), text: z.string() }).strict(),
  z.object({ action: z.literal("accept-dose-correction") }).strict(),
  z.object({ action: z.literal("leave-date-unresolved") }).strict(),
  z.object({ action: z.literal("resolve-date"), chosenValueId: z.enum(["apixaban-start", "apixaban-date-alternative"]) }).strict(),
]);

const requestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("resume"), state: z.unknown() }).strict(),
  z.object({
    operation: z.literal("act"),
    state: z.unknown(),
    expectedRevision: z.number().int().nonnegative(),
    action: actionSchema,
  }).strict(),
]);

export async function GET(request: NextRequest) {
  const context = diagnosticContext(request.headers);
  const diagnostics = createRuntimeDiagnosticLogger(context);
  diagnostics.event("route", "case-get", "start", requestMetadata(request));
  try {
    const repository = new InMemoryCaseRepository({ maxCases: 1 });
    const caseId = `case-${randomUUID()}`;
    const snapshot = await getJourneySnapshot(repository, caseId);
    const body = await journeyResponse(repository, snapshot);
    diagnostics.event("response", "case-get", "success", responseMetadata(200, body));
    diagnostics.checkpoint("case-get-trace", "success");
    return jsonResponse(body, 200, context);
  } catch (error) {
    return failedResponse(error, context, diagnostics, "case-get");
  }
}

export async function POST(request: NextRequest) {
  return postCase(request);
}

export async function postCase(request: NextRequest, model: JourneyModel = configuredJourneyModel()) {
  const context = diagnosticContext(request.headers);
  const diagnostics = createRuntimeDiagnosticLogger(context);
  diagnostics.event("route", "case-post", "start", requestMetadata(request));
  if (!hasSameOrigin(request)) {
    const error = new RequestBoundaryError("The request origin was not accepted", "origin-rejected", 403);
    diagnostics.event("schema-domain", "same-origin", "rejected", { error: caughtErrorDetails(error) });
    return failedResponse(error, context, diagnostics, "case-post");
  }

  let requestBody: z.infer<typeof requestSchema>;
  try {
    requestBody = requestSchema.parse(await request.json());
    diagnostics.event("schema-domain", "request-envelope", "success", {
      operation: requestBody.operation,
      ...(requestBody.operation === "act" ? {
        expectedRevision: requestBody.expectedRevision,
        action: diagnosticAction(requestBody.action),
      } : {}),
    });
  } catch (error) {
    diagnostics.event("schema-domain", "request-envelope", "rejected", { error: caughtErrorDetails(error) });
    return failedResponse(
      new RequestBoundaryError("The synthetic preview request was malformed", "request-malformed", 400, error),
      context,
      diagnostics,
      "case-post",
    );
  }

  let repository: InMemoryCaseRepository;
  let snapshot;
  try {
    const state = parseBrowserJourneyState(requestBody.state);
    repository = repositoryForBrowserState(state);
    snapshot = await getJourneySnapshot(repository, state.case.id);
    assertStoredStage(state, snapshot);
    if (requestBody.operation === "act") {
      assertExpectedBrowserRevision(state, requestBody.expectedRevision);
    }
    diagnostics.event("schema-domain", "browser-state", "success", {
      version: state.version,
      stage: state.stage,
      revision: state.case.revision,
    });
  } catch (error) {
    diagnostics.event("schema-domain", "browser-state", "rejected", { error: caughtErrorDetails(error) });
    return failedResponse(error, context, diagnostics, "case-post");
  }

  try {
    if (requestBody.operation === "act") {
      snapshot = await performJourneyAction(
        repository,
        (await repository.loadByOnlyCase())!.id,
        requestBody.action,
        model,
        diagnostics,
      );
    }
    const body = await journeyResponse(repository, snapshot);
    diagnostics.event("response", "case-post", "success", responseMetadata(200, body));
    diagnostics.checkpoint("case-post-trace", "success");
    return jsonResponse(body, 200, context);
  } catch (error) {
    // The model service and command boundary already classify their own phase.
    // This outer catch records transport through the route without relabeling it
    // as schema/domain rejection.
    diagnostics.event("route", "case-action", "failure", { error: caughtErrorDetails(error) });
    return failedResponse(error, context, diagnostics, "case-post");
  }
}

function configuredJourneyModel(): JourneyModel {
  if (process.env.VERCEL_ENV !== "preview") return fixedJourneyModel;
  return {
    propose(turn, text) {
      return createAnthropicJourneyModel().propose(turn, text);
    },
  };
}

function failedResponse(
  error: unknown,
  context: DiagnosticContext,
  diagnostics: RuntimeDiagnosticLogger,
  phase: "case-get" | "case-post",
) {
  const { body, status } = clientFailure(error, context.operationId);
  diagnostics.event("response", phase, "failure", {
    ...responseMetadata(status, body),
    error: caughtErrorDetails(error),
  });
  diagnostics.checkpoint(`${phase}-trace`, "failure");
  return jsonResponse(body, status, context);
}

function clientFailure(error: unknown, diagnosticReference: string) {
  if (error instanceof RequestBoundaryError) {
    return { status: error.status, body: { error: error.message, code: error.code, diagnosticReference } };
  }
  if (error instanceof BrowserStateError) {
    return { status: error.code === "stale-browser-state" ? 409 : 400, body: {
      error: error.message,
      code: error.code,
      diagnosticReference,
    } };
  }
  if (error instanceof ModelCallFailure) {
    const status = error.diagnostic.phase === "provider-request" ? 502 : 422;
    return { status, body: { error: error.message, code: `model-${error.diagnostic.phase}`, diagnosticReference } };
  }
  return {
    status: 400,
    body: { error: safeClientError(error), code: "case-action-failed", diagnosticReference },
  };
}

class RequestBoundaryError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "RequestBoundaryError";
  }
}

function jsonResponse(body: unknown, status: number, context: DiagnosticContext) {
  return NextResponse.json(body, { status, headers: diagnosticResponseHeaders(context) });
}

function diagnosticResponseHeaders(context: DiagnosticContext): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    [runIdHeader]: context.runId,
    [operationIdHeader]: context.operationId,
  };
}

function requestMetadata(request: NextRequest) {
  return {
    method: request.method,
    path: request.nextUrl.pathname,
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
  };
}

function responseMetadata(status: number, body: unknown) {
  return { status, contentType: "application/json", cacheControl: "no-store", body };
}

function diagnosticAction(action: z.infer<typeof actionSchema>): unknown {
  if (!("text" in action)) return action;
  const fixedText = action.text === openingAccount
    || action.text === indicationAnswer
    || action.text === correctionAccount;
  return fixedText ? action : { ...action, text: "[NOT LOGGED: outside fixed synthetic fixture]" };
}

function safeClientError(error: unknown): string {
  if (!(error instanceof Error)) return "The case could not be updated";
  const allowed = [
    "This action is not available during",
    "Use the displayed fictional indication answer",
    "This experiment accepts only the displayed fictional",
    "Accept or reject the dose correction",
  ];
  return allowed.some((prefix) => error.message.startsWith(prefix))
    ? error.message
    : "The case could not be updated";
}

function hasSameOrigin(request: NextRequest): boolean {
  const value = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!value || !host) return false;
  try {
    const origin = new URL(value);
    const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    return origin.host === host && origin.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
