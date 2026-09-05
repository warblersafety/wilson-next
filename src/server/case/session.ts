import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { InMemoryCaseRepository } from "./repository";

const cookieName = "wilson-case-session";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const processState = globalThis as typeof globalThis & {
  wilsonCaseRepository?: InMemoryCaseRepository;
};

export function getCaseRepository(): InMemoryCaseRepository {
  processState.wilsonCaseRepository ??= new InMemoryCaseRepository();
  return processState.wilsonCaseRepository;
}

export function caseSession(request: NextRequest): { caseId: string; sessionId: string; isNew: boolean } {
  const existing = request.cookies.get(cookieName)?.value;
  const isNew = !existing || !sessionPattern.test(existing);
  const sessionId = isNew ? randomUUID() : existing;
  return { caseId: `case-${sessionId}`, sessionId, isNew };
}

export function attachCaseCookie(response: NextResponse, sessionId: string, secure: boolean): void {
  response.cookies.set(cookieName, sessionId, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
  });
}
