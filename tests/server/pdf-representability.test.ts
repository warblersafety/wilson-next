import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { readFile } from "node:fs/promises";
import { correctCapacityProduct, productCapacityCase } from "../fixtures/product-capacity";
import { correctReportedSex } from "../fixtures/pdf-representability";

describe("reviewed sex and native PDF representability", () => {
  it.each((["route", "frequency", "dose", "strength"] as const).flatMap(field => ["", "   "].map(value => ({ field, value }))))("blocks accepted blank $field wording before export: '$value'", async ({ field, value }) => {
    const current = correctCapacityProduct(productCapacityCase(), 0, { [field]: { kind: "known", value } });
    const before = structuredClone(current);
    const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
    expect(snapshot.downloadReady).toBe(false);
    expect(snapshot.outputIssues).toContainEqual({ code: field === "route" ? "unsupported-product-route" : "unsupported-product-text", message: expect.stringContaining("no non-blank wording"), targets: [`product:${current.products[0].id}:${field}`], entityIds: [current.products[0].id] });
    expect(snapshot.projection.sections.D.suspectProducts[0][field]).toBe(value);
    await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).rejects.toThrow("no non-blank wording");
    for (const mode of ["preview", "download"]) {
      const state = { version: browserStateVersion, stage: "output", case: current, unrepresented: [] };
      const response = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state }) }));
      expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "pdf-not-ready", error: expect.stringContaining("no non-blank wording") });
    }
    expect(current).toEqual(before);
  });
  it.each((["route", "frequency"] as const).flatMap(field => ["W".repeat(100), "supplied\nwording", "静脉"].map(value => ({ field, value }))))("retains unrepresentable Other $field and blocks before generating: $value", async ({ field, value }) => {
    const current = correctCapacityProduct(productCapacityCase(), 0, { [field]: { kind: "known", value } });
    const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
    expect(snapshot.downloadReady).toBe(false);
    expect(snapshot.outputIssues).toContainEqual({ code: field === "route" ? "unsupported-product-route" : "unsupported-product-text", message: expect.stringContaining("the PDF cannot represent it"), targets: [`product:${current.products[0].id}:${field}`], entityIds: [current.products[0].id] });
    expect(snapshot.projection.sections.D.suspectProducts[0][field]).toBe(value);
    await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).rejects.toThrow("reviewed");
  });
  it("retains a reviewed unrepresentable value and blocks readiness before the adapter", async () => {
    const current = correctReportedSex(productCapacityCase(), { kind: "known", value: "intersex" }), before = structuredClone(current);
    const repository = new InMemoryCaseRepository({ initialCase: current });
    const snapshot = await getJourneySnapshot(repository, current.id);
    expect(snapshot.downloadReady).toBe(false);
    expect(snapshot.outputIssues).toContainEqual({ code: "unsupported-patient-sex", message: expect.stringContaining("reviewed value is retained"), targets: ["patient:patient:sex"], entityIds: ["patient"] });
    expect(snapshot.projection.sections.A.sex).toBe("intersex"); expect(await repository.load(current.id)).toEqual(before);
    await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).rejects.toThrow("does not support intersex");
  });
  it.each(["preview", "download"] as const)("returns a truthful pre-export409 for %s without changing accepted knowledge", async mode => {
    const current = correctReportedSex(productCapacityCase(), { kind: "known", value: "intersex" });
    const state = { version: browserStateVersion, stage: "output", case: current, unrepresented: [] }, before = structuredClone(state);
    const response = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state }) }));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "pdf-not-ready", error: expect.stringContaining("reviewed value is retained") }); expect(state).toEqual(before);
  });
  it("restores readiness only after an explicit fictional correction, preserving prior value/history", async () => {
    const initial = correctReportedSex(productCapacityCase(), { kind: "known", value: "intersex" });
    const corrected = correctReportedSex(initial, { kind: "known", value: "female" });
    const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: corrected }), corrected.id);
    expect(snapshot.downloadReady).toBe(true); expect(corrected.products).toEqual(initial.products);
    expect(corrected.patient.facts.sex.supersededValues.map(v => v.value)).toContainEqual({ kind: "known", value: "intersex" });
    for (const value of [{ kind: "unknown" }, { kind: "declined" }] as const) {
      const partial = correctReportedSex(initial, value); const partialSnapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: partial }), partial.id);
      expect(partialSnapshot.outputIssues.some(i => i.code === "unsupported-patient-sex")).toBe(false); expect(partialSnapshot.projection.sections.A.sex).toBeUndefined();
    }
  });
});
