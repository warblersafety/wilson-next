import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { caseSession, attachCaseCookie, getCaseRepository } from "../../../src/server/case/session";
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
  const session = caseSession(request);
  const snapshot = await getJourneySnapshot(getCaseRepository(), session.caseId);
  return responseWithSession(snapshot, session.sessionId, isSecure(request));
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "The request origin was not accepted" }, { status: 403 });
  }
  const session = caseSession(request);
  try {
    const action = actionSchema.parse(await request.json());
    const snapshot = await performJourneyAction(getCaseRepository(), session.caseId, action);
    return responseWithSession(snapshot, session.sessionId, isSecure(request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The case could not be updated";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

function responseWithSession(body: unknown, sessionId: string, secure: boolean) {
  const response = NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  attachCaseCookie(response, sessionId, secure);
  return response;
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
