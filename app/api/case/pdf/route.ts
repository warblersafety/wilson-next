import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { caseSession, attachCaseCookie, getCaseRepository } from "../../../../src/server/case/session";
import { getJourneySnapshot } from "../../../../src/server/journey/service";
import { fillForm3500Projection } from "../../../../src/server/pdf/form-3500";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = caseSession(request);
  const snapshot = await getJourneySnapshot(getCaseRepository(), session.caseId);
  const preview = request.nextUrl.searchParams.get("mode") === "preview";
  if (!preview && !snapshot.downloadReady) {
    return NextResponse.json({ error: "Resolve the start-date conflict before downloading" }, { status: 409 });
  }
  if (snapshot.stage !== "output-unresolved" && snapshot.stage !== "output-resolved") {
    return NextResponse.json({ error: "The form preview is not available yet" }, { status: 409 });
  }

  const source = new Uint8Array(await readFile(join(process.cwd(), "assets/fda/form-fda-3500-09-2025.pdf")));
  const { output } = await fillForm3500Projection(source, snapshot.projection);
  const response = new NextResponse(Buffer.from(output), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": preview ? "inline" : 'attachment; filename="wilson-form-fda-3500.pdf"',
    },
  });
  attachCaseCookie(response, session.sessionId, request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https");
  return response;
}
