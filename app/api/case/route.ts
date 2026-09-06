import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { caseSession, attachCaseCookie, getCaseRepository } from "../../../src/server/case/session";
import {
  caughtErrorDetails,
  createRuntimeDiagnosticLogger,
  diagnosticContext,
  operationIdHeader,
  runIdHeader,
  type DiagnosticContext,
} from "../../../src/server/diagnostics/runtime-log";
import { correctionAccount, indicationAnswer, openingAccount } from "../../../src/experiment/fixed-inputs";
import { getJourneySnapshot, performJourneyAction } from "../../../src/server/journey/service";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit-opening"), text: z.string(), reportType: z.literal("adverse-event") }),
  z.object({ action: z.literal("accept-understanding") }),
  z.object({ action: z.literal("answer-indications"), text: z.string() }),
  z.object({ action: z.literal("submit-correction"), text: z.string() }),
  z.object({ action: z.literal("accept-dose-correction") }),
  z.object({ action: z.literal("leave-date-unresolved") }),
  z.object({ action: z.literal("resolve-date"), chosenValueId: z.enum(["apixaban-start", "apixaban-date-alternative"]) }),
]);

export async function GET(request: NextRequest) {
  const context = diagnosticContext(request.headers);
  const diagnostics = createRuntimeDiagnosticLogger(context);
  diagnostics.event("route", "case-get", "start", requestMetadata(request));
  const session = caseSession(request);
  try {
    const snapshot = await getJourneySnapshot(getCaseRepository(), session.caseId);
    diagnostics.event("response", "case-get", "success", responseMetadata(200, snapshot));
    return responseWithSession(snapshot, session.sessionId, isSecure(request), context);
  } catch (error) {
    const body = { error: "The temporary case could not be loaded" };
    diagnostics.event("response", "case-get", "failure", {
      ...responseMetadata(500, body),
      error: caughtErrorDetails(error),
    });
    return errorResponse(body, 500, context);
  }
}

export async function POST(request: NextRequest) {
  const context = diagnosticContext(request.headers);
  const diagnostics = createRuntimeDiagnosticLogger(context);
  diagnostics.event("route", "case-post", "start", requestMetadata(request));
  if (!hasSameOrigin(request)) {
    const body = { error: "The request origin was not accepted" };
    diagnostics.event("schema-domain", "same-origin", "rejected", { reason: body.error });
    diagnostics.event("response", "case-post", "rejected", responseMetadata(403, body));
    return errorResponse(body, 403, context);
  }
  const session = caseSession(request);
  try {
    const action = actionSchema.parse(await request.json());
    diagnostics.event("schema-domain", "request-action", "success", { action: diagnosticAction(action) });
    const snapshot = await performJourneyAction(
      getCaseRepository(),
      session.caseId,
      action,
      undefined,
      diagnostics,
    );
    diagnostics.event("response", "case-post", "success", responseMetadata(200, snapshot));
    return responseWithSession(snapshot, session.sessionId, isSecure(request), context);
  } catch (error) {
    const body = { error: safeClientError(error) };
    diagnostics.event("schema-domain", "request-or-action", "rejected", {
      error: caughtErrorDetails(error),
    });
    diagnostics.event("response", "case-post", "failure", {
      ...responseMetadata(400, body),
      error: caughtErrorDetails(error),
    });
    return errorResponse(body, 400, context);
  }
}

function responseWithSession(body: unknown, sessionId: string, secure: boolean, context: DiagnosticContext) {
  const response = NextResponse.json(body, { headers: diagnosticResponseHeaders(context) });
  attachCaseCookie(response, sessionId, secure);
  return response;
}

function errorResponse(body: unknown, status: number, context: DiagnosticContext) {
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
  return {
    status,
    contentType: "application/json",
    cacheControl: "no-store",
    body,
  };
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

function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
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
