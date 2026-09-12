import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as getPdf, POST as postPdf } from "../../app/api/case/pdf/route";
import { journeyResponse } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import type { RuntimeDiagnosticEvent } from "../../src/server/diagnostics/runtime-log";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { acceptCorrectionAndConflict, acceptOpeningCase, attachCorrectionAndContradiction, answerIndications, completeAdaptiveDetails, completeResolvedCase } from "../domain/fixture";

describe("state-bearing PDF route", () => {
  it("refuses GET and an unreviewed state without a cacheable form", async () => {
    const direct = await getPdf(new NextRequest("http://wilson.test/api/case/pdf"));
    expect(direct.status).toBe(405);
    expect(direct.headers.get("allow")).toBe("POST");
    expect(direct.headers.get("cache-control")).toContain("no-store");

    const repository = new InMemoryCaseRepository({ maxCases: 1 });
    const initial = await getJourneySnapshot(repository, `case-${randomUUID()}`);
    const { state } = await journeyResponse(repository, initial);
    const response = await postPdf(pdfRequest({ mode: "preview", state }));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      code: "pdf-not-ready",
      error: expect.stringContaining("No reviewed product remains"),
      diagnosticReference: expect.any(String),
    });
  });

  it("fills a truthful partial PDF while a conflict remains unresolved", async () => {
    const conflicted = acceptCorrectionAndConflict(attachCorrectionAndContradiction(answerIndications(acceptOpeningCase())));
    const { state } = await responseForCase(completeAdaptiveDetails(conflicted));
    const response = await postPdf(pdfRequest({ mode: "preview", state }));
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100_000);
  });

  it("fills preview and download bytes only from validated resolved browser state", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { state } = await responseForCase(completeResolvedCase());
      const preview = await postPdf(pdfRequest({ mode: "preview", state }));
      expect(preview.status).toBe(200);
      expect(preview.headers.get("content-type")).toBe("application/pdf");
      expect(preview.headers.get("content-disposition")).toBe("inline");
      expect((await preview.arrayBuffer()).byteLength).toBeGreaterThan(100_000);

      const download = await postPdf(pdfRequest({ mode: "download", state }));
      expect(download.status).toBe(200);
      expect(download.headers.get("content-disposition")).toBe('attachment; filename="wilson-form-fda-3500.pdf"');
      expect((await download.arrayBuffer()).byteLength).toBeGreaterThan(100_000);
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it("classifies malformed browser state without claiming a PDF generation failure", async () => {
    const written: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((value) => written.push(String(value)));
    try {
      const response = await postPdf(pdfRequest({ mode: "preview", state: { version: "not-compatible" } }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "pdf-request-invalid",
        diagnosticReference: expect.any(String),
      });
      const events = written.map((value) => JSON.parse(value) as RuntimeDiagnosticEvent);
      expect(events).toContainEqual(expect.objectContaining({
        source: "schema-domain",
        phase: "pdf-request-or-state",
        outcome: "rejected",
      }));
      expect(events.some(({ phase }) => phase === "pdf-generation")).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});

async function responseForCase(caseState: ReturnType<typeof completeResolvedCase>) {
  const restored = structuredClone(caseState);
  restored.id = `case-${randomUUID()}`;
  const repository = new InMemoryCaseRepository({ initialCase: restored, maxCases: 1 });
  return journeyResponse(repository, await getJourneySnapshot(repository, restored.id));
}

function pdfRequest(body: unknown) {
  return new NextRequest("http://wilson.test/api/case/pdf", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "wilson.test",
      origin: "http://wilson.test",
    },
    body: JSON.stringify(body),
  });
}
