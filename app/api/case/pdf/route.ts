import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertStoredStage,
  parseBrowserJourneyState,
  repositoryForBrowserState,
} from "../../../../src/server/case/browser-state";
import {
  caughtErrorDetails,
  createRuntimeDiagnosticLogger,
  diagnosticContext,
  operationIdHeader,
  runIdHeader,
  type DiagnosticContext,
} from "../../../../src/server/diagnostics/runtime-log";
import { getJourneySnapshot } from "../../../../src/server/journey/service";
import { fillForm3500Projection } from "../../../../src/server/pdf/form-3500";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pdfRequestSchema = z.object({
  mode: z.enum(["preview", "download"]),
  state: z.unknown(),
}).strict();

export async function GET(request: NextRequest) {
  const context = diagnosticContext(request.headers);
  const diagnostics = createRuntimeDiagnosticLogger(context);
  diagnostics.event("route", "pdf-get", "start", requestMetadata(request));
  const body = {
    error: "The PDF requires the active synthetic preview state",
    code: "pdf-state-required",
    diagnosticReference: context.operationId,
  };
  diagnostics.event("response", "pdf-get", "failure", {
    status: 405,
    contentType: "application/json",
    cacheControl: "no-store",
    body,
  });
  diagnostics.checkpoint("pdf-get-trace", "failure");
  return NextResponse.json(body, {
    status: 405,
    headers: { ...diagnosticHeaders(context), Allow: "POST" },
  });
}

export async function POST(request: NextRequest) {
  const context = diagnosticContext(request.headers);
  const diagnostics = createRuntimeDiagnosticLogger(context);
  diagnostics.event("route", "pdf-post", "start", requestMetadata(request));
  if (!hasSameOrigin(request)) {
    return pdfError("The request origin was not accepted", "origin-rejected", 403, context, diagnostics);
  }
  let body: z.infer<typeof pdfRequestSchema>;
  let snapshot;
  try {
    body = pdfRequestSchema.parse(await request.json());
    diagnostics.event("schema-domain", "pdf-request", "success", { mode: body.mode });
    const state = parseBrowserJourneyState(body.state);
    const repository = repositoryForBrowserState(state);
    snapshot = await getJourneySnapshot(repository, state.case.id);
    assertStoredStage(state, snapshot);
    diagnostics.event("schema-domain", "pdf-browser-state", "success", {
      version: state.version,
      stage: state.stage,
      revision: state.case.revision,
    });
    if (!snapshot.downloadReady || snapshot.stage !== "output-resolved") {
      return pdfError(
        "Resolve the start-date conflict before opening the official PDF",
        "pdf-not-ready",
        409,
        context,
        diagnostics,
      );
    }
  } catch (error) {
    diagnostics.event("schema-domain", "pdf-request-or-state", "rejected", { error: caughtErrorDetails(error) });
    return pdfError("The official PDF request was invalid", "pdf-request-invalid", 400, context, diagnostics, error);
  }

  try {
    const source = new Uint8Array(await readFile(join(process.cwd(), "assets/fda/form-fda-3500-09-2025.pdf")));
    const { output } = await fillForm3500Projection(source, snapshot.projection);
    diagnostics.event("response", "pdf-post", "success", {
      status: 200,
      mode: body.mode,
      contentType: "application/pdf",
      byteLength: output.byteLength,
      body: "[PDF BYTES NOT LOGGED]",
    });
    return new NextResponse(Buffer.from(output), {
      headers: {
        ...diagnosticHeaders(context),
        "Content-Type": "application/pdf",
        "Content-Disposition": body.mode === "preview"
          ? "inline"
          : 'attachment; filename="wilson-form-fda-3500.pdf"',
      },
    });
  } catch (error) {
    diagnostics.event("route", "pdf-generation", "failure", { error: caughtErrorDetails(error) });
    return pdfError("The official PDF could not be generated", "pdf-generation-failed", 500, context, diagnostics, error);
  }
}

function pdfError(
  message: string,
  code: string,
  status: number,
  context: DiagnosticContext,
  diagnostics: ReturnType<typeof createRuntimeDiagnosticLogger>,
  error?: unknown,
) {
  const body = { error: message, code, diagnosticReference: context.operationId };
  diagnostics.event("response", "pdf-post", "failure", {
    status,
    contentType: "application/json",
    cacheControl: "no-store",
    body,
    ...(error === undefined ? {} : { error: caughtErrorDetails(error) }),
  });
  return NextResponse.json(body, { status, headers: diagnosticHeaders(context) });
}

function diagnosticHeaders(context: DiagnosticContext): Record<string, string> {
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
