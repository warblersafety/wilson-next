import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
import { ModelCallFailure, type JourneyModel } from "../../../src/server/model/journey-model";
import { journeyModelForEnvironment } from "../../../src/server/model/configured-journey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const caseValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.object({ value: z.number().positive(), unit: z.enum(["kg", "lb"]) }).strict()]), qualifier: z.string().optional() }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("explicitly-absent") }).strict(),
  z.object({ kind: z.literal("inapplicable") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

const indicationValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.string().trim().min(1) }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);
const answerStringSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("explicitly-absent") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);
const deviceAnswerStringSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("inapplicable") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit-opening"), text: z.string(), reportType: z.enum(["adverse-event", "product-problem", "adverse-event-and-product-problem"]) }).strict(),
  z.object({ action: z.literal("change-proposal"), groupId: z.string().min(1), proposalId: z.string().min(1), value: caseValueSchema, statement: z.string().min(1) }).strict(),
  z.object({ action: z.literal("reject-group"), groupId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("accept-understanding") }).strict(),
  z.object({ action: z.literal("answer-indications"), answers: z.array(z.object({ productId: z.string().min(1), value: indicationValueSchema }).strict()).min(1) }).strict(),
  z.object({
    action: z.literal("answer-serious-outcomes"),
    selected: z.array(z.enum(["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"])),
    disposition: z.enum(["known", "unknown", "declined"]),
  }).strict(),
  z.object({ action: z.literal("answer-death-date"), value: answerStringSchema }).strict(),
  z.object({
    action: z.literal("answer-clinical-context"),
    test: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("known"), testResult: z.string().trim().min(1), lowRange: z.string().trim().optional(), highRange: z.string().trim().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict(),
      z.object({ kind: z.literal("explicitly-absent") }).strict(),
      z.object({ kind: z.literal("unknown") }).strict(),
      z.object({ kind: z.literal("declined") }).strict(),
    ]).optional(),
    history: answerStringSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("answer-device-details"),
    implantDate: deviceAnswerStringSchema.optional(),
    explantDate: deviceAnswerStringSchema.optional(),
    reprocessor: deviceAnswerStringSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("answer-reporter"),
    reporter: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("declined") }).strict(),
      z.object({
        kind: z.literal("provided"), lastName: z.string().trim().min(1), firstName: z.string().trim().min(1),
        address: z.string().trim().optional(), city: z.string().trim().optional(), state: z.string().trim().optional(), postalCode: z.string().trim().optional(), country: z.string().trim().optional(),
        phone: z.string().trim().optional(), email: z.string().trim().optional(), healthProfessional: z.boolean(), occupation: z.string().trim().min(1),
        reportedTo: z.array(z.enum(["manufacturer", "user-facility", "distributor-importer", "packer"])), doNotDiscloseIdentity: z.boolean(),
      }).strict(),
    ]),
  }).strict(),
  z.object({ action: z.literal("submit-update"), text: z.string().min(1) }).strict(),
  z.object({ action: z.literal("review-update-group"), groupId: z.string().min(1), decision: z.enum(["accept", "reject"]) }).strict(),
  z.object({ action: z.literal("resolve-conflict"), target: z.string().min(1), chosenValueId: z.string().min(1) }).strict(),
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

export async function postCase(request: NextRequest, model?: JourneyModel) {
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
        model ?? await journeyModelForEnvironment(),
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
  const sanitized = { ...action } as Record<string, unknown>;
  for (const key of ["text", "statement"]) {
    if (typeof sanitized[key] === "string") sanitized[key] = "[CLINICIAN TEXT LOGGED ONLY BY CONFIGURED SERVER POLICY]";
  }
  return sanitized;
}

function safeClientError(error: unknown): string {
  if (!(error instanceof Error)) return "The case could not be updated";
  const allowed = [
    "This action is not available during",
    "The proposed value is no longer available",
    "The indication question is no longer open",
    "The selected conflict alternative is unavailable",
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
