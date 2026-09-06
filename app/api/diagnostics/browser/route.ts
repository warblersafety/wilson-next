import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { correctionAccount, indicationAnswer, openingAccount } from "../../../../src/experiment/fixed-inputs";
import {
  createRuntimeDiagnosticLogger,
  diagnosticContext,
  operationIdHeader,
  runIdHeader,
} from "../../../../src/server/diagnostics/runtime-log";

export const dynamic = "force-dynamic";

const browserEventSchema = z.object({
  browserSequence: z.number().int().positive(),
  phase: z.enum(["request-start", "response-received", "response-parse-failed", "request-failed"]),
  outcome: z.enum(["start", "success", "failure"]),
  request: z.object({
    method: z.enum(["GET", "POST"]),
    path: z.literal("/api/case"),
    body: z.unknown().optional(),
  }).strict().optional(),
  response: z.object({
    status: z.number().int(),
    statusText: z.string(),
    contentType: z.string().nullable(),
    contentLength: z.string().nullable(),
    body: z.string(),
  }).strict().optional(),
  error: z.unknown().optional(),
}).strict();

const browserReportSchema = z.object({
  event: browserEventSchema,
  trace: z.array(browserEventSchema).min(1).max(3),
}).strict().superRefine(({ event, trace }, context) => {
  const finalEvent = trace.at(-1);
  if (!finalEvent
    || finalEvent.browserSequence !== event.browserSequence
    || finalEvent.phase !== event.phase
    || finalEvent.outcome !== event.outcome) {
    context.addIssue({ code: "custom", message: "The browser trace must end with the reported event" });
  }
  if (trace.some((item, index) => index > 0 && item.browserSequence <= trace[index - 1].browserSequence)) {
    context.addIssue({ code: "custom", message: "Browser trace sequence numbers must increase" });
  }
});

export async function POST(request: NextRequest) {
  const context = diagnosticContext(request.headers);
  if (!hasSameOrigin(request)) {
    return new NextResponse(null, { status: 403, headers: diagnosticHeaders(context) });
  }
  try {
    const report = browserReportSchema.parse(await request.json());
    const { event } = report;
    const diagnostics = createRuntimeDiagnosticLogger(context);
    diagnostics.event("browser", event.phase, event.outcome, {
      browserSequence: event.browserSequence,
      ...(event.request ? { request: safeRequest(event.request) } : {}),
      ...(event.response ? { response: event.response } : {}),
      ...(event.error === undefined ? {} : { error: event.error }),
      trace: report.trace.map(safeBrowserEvent),
    });
    return new NextResponse(null, { status: 204, headers: diagnosticHeaders(context) });
  } catch {
    return new NextResponse(null, { status: 400, headers: diagnosticHeaders(context) });
  }
}

function safeBrowserEvent(event: z.infer<typeof browserEventSchema>): unknown {
  return {
    ...event,
    ...(event.request ? { request: safeRequest(event.request) } : {}),
  };
}

function safeRequest(request: z.infer<typeof browserEventSchema>["request"]): unknown {
  if (!request || request.body === undefined) return request;
  const body = request.body;
  if (!body || typeof body !== "object" || !("action" in body)) {
    return { ...request, body: "[NOT LOGGED: outside fixed synthetic fixture]" };
  }
  const candidate = body as { action?: unknown; text?: unknown };
  const fixedText = candidate.text === openingAccount
    || candidate.text === indicationAnswer
    || candidate.text === correctionAccount;
  if (typeof candidate.text === "string" && !fixedText) {
    return { ...request, body: { ...candidate, text: "[NOT LOGGED: outside fixed synthetic fixture]" } };
  }
  return request;
}

function diagnosticHeaders(context: { runId: string; operationId: string }): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    [runIdHeader]: context.runId,
    [operationIdHeader]: context.operationId,
  };
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
