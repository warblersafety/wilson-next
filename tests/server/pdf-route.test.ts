import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as getPdf, POST as postPdf } from "../../app/api/case/pdf/route";
import { journeyResponse } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import type { RuntimeDiagnosticEvent } from "../../src/server/diagnostics/runtime-log";
import { correctionAccount, indicationAnswer, openingAccount } from "../../src/experiment/fixed-inputs";
import { performJourneyAction } from "../../src/server/journey/service";

describe("state-bearing PDF route", () => {
  it("refuses GET and unresolved state without a cacheable form", async () => {
    const direct = await getPdf(new NextRequest("http://wilson.test/api/case/pdf"));
    expect(direct.status).toBe(405);
    expect(direct.headers.get("allow")).toBe("POST");
    expect(direct.headers.get("cache-control")).toContain("no-store");

    const { state } = await journeyAt(false);
    const response = await postPdf(pdfRequest({ mode: "preview", state }));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      code: "pdf-not-ready",
      diagnosticReference: expect.any(String),
    });
  });

  it("fills preview and download bytes only from validated resolved browser state", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { state } = await journeyAt(true);
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

async function journeyAt(resolved: boolean) {
  const repository = new InMemoryCaseRepository({ maxCases: 1 });
  const caseId = `case-${randomUUID()}`;
  await performJourneyAction(repository, caseId, {
    action: "submit-opening",
    text: openingAccount,
    reportType: "adverse-event",
  });
  await performJourneyAction(repository, caseId, { action: "accept-understanding" });
  await performJourneyAction(repository, caseId, { action: "answer-indications", text: indicationAnswer });
  await performJourneyAction(repository, caseId, { action: "submit-correction", text: correctionAccount });
  await performJourneyAction(repository, caseId, { action: "accept-dose-correction" });
  let snapshot = await performJourneyAction(repository, caseId, { action: "leave-date-unresolved" });
  if (resolved) {
    snapshot = await performJourneyAction(repository, caseId, {
      action: "resolve-date",
      chosenValueId: "apixaban-date-alternative",
    });
  }
  return journeyResponse(repository, snapshot);
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
