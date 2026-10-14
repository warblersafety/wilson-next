import { execFile } from "node:child_process";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextRequest } from "next/server";
import { describe, it, expect } from "vitest";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { projectForm3500 } from "../../src/domain/case/projection";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { fixedJourneyModel } from "../fixtures/fixed-journey";
import { capacityProductIds, capacityProductNames, correctCapacityProduct, productCapacityCase } from "../fixtures/product-capacity";

const formSource = () => readFile("assets/fda/form-fda-3500-09-2025.pdf");
const cases = [
  { label: "two suspects and one concomitant", roles: ["suspect", "suspect", "concomitant"], types: ["drug-or-biologic", "drug-or-biologic", "drug-or-biologic"], issue: undefined },
  { label: "three non-device suspects", roles: ["suspect", "suspect", "suspect"], types: ["drug-or-biologic", "drug-or-biologic", "other"], issue: "too-many-suspect-products" },
  { label: "two concomitants", roles: ["suspect", "concomitant", "concomitant"], types: ["drug-or-biologic", "drug-or-biologic", "drug-or-biologic"], issue: "too-many-concomitant-products" },
  { label: "device plus two non-device suspects", roles: ["suspect", "suspect", "suspect"], types: ["device", "drug-or-biologic", "drug-or-biologic"], issue: undefined },
  { label: "device, non-device suspect and concomitant", roles: ["suspect", "suspect", "concomitant"], types: ["device", "drug-or-biologic", "drug-or-biologic"], issue: undefined },
  { label: "two suspect devices", roles: ["suspect", "suspect", "concomitant"], types: ["device", "device", "drug-or-biologic"], issue: "multiple-suspect-devices" },
  { label: "concomitant device", roles: ["suspect", "suspect", "concomitant"], types: ["drug-or-biologic", "drug-or-biologic", "device"], issue: "unsupported-concomitant-device" },
] as const;

describe("product capacity readiness and actual export", () => {
  it.each(cases)("preserves all knowledge and enforces $label", async ({ roles, types, issue }) => {
    let current = productCapacityCase();
    for (let i = 0; i < 3; i++) current = correctCapacityProduct(current, i, { role: { kind: "known", value: roles[i] }, productType: { kind: "known", value: types[i] } });
    const before = structuredClone(current);
    const repository = new InMemoryCaseRepository({ initialCase: current });
    const snapshot = await getJourneySnapshot(repository, current.id);
    expect(snapshot.stage).toBe("output");
    expect(await repository.load(current.id)).toEqual(before);
    expect(snapshot.understanding.products.map(({ id }) => id)).toEqual([...capacityProductIds]);
    expect(snapshot.downloadReady).toBe(!issue);
    if (issue) {
      expect(snapshot.outputIssues).toEqual([expect.objectContaining({ code: issue })]);
      if (issue.startsWith("too-many")) {
        const expectedIds = issue === "too-many-suspect-products" ? [...capacityProductIds] : capacityProductIds.slice(1);
        expect(snapshot.outputIssues[0]).toMatchObject({ entityIds: expectedIds, targets: expectedIds.map(id => `product:${id}:role`) });
        const projection = projectForm3500(current);
        expect(issue === "too-many-suspect-products" ? projection.sections.D.suspectProducts : projection.sections.F.concomitantProducts).toHaveLength(expectedIds.length);
        await expect(fillForm3500Projection(new Uint8Array(await formSource()), projection)).rejects.toThrow("supports at most");
      }
    } else {
      const { output } = await fillForm3500Projection(new Uint8Array(await formSource()), snapshot.projection);
      const dir = await mkdtemp(join(tmpdir(), "wilson-capacity-")), file = join(dir, "supported.pdf");
      await writeFile(file, output);
      const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
      const named = JSON.parse(stdout).namedFields;
      const values = Object.values(named);
      for (const name of capacityProductNames) expect(values).toContain(name);
      // Independently read the actual FDA sections, not the adapter's readback.
      const suspects = roles.flatMap((role, i) => role === "suspect" && types[i] !== "device" ? [capacityProductNames[i]] : []);
      expect(named["topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]"]).toBe(suspects[0]);
      expect(named["topmostSubform[0].Page5[0].Prod2[0].Prod2Name[0]"]).toBe(suspects[1]);
      const concomitant = roles.findIndex(role => role === "concomitant");
      expect(named["topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Prod1[0]"]).toBe(concomitant < 0 ? undefined : capacityProductNames[concomitant]);
      const device = types.findIndex(type => type === "device");
      expect(named["topmostSubform[0].Page6[0].SecE_Device[0].BrandName[0]"]).toBe(device < 0 ? undefined : capacityProductNames[device]);
    }
  });

  it.each(["preview", "download"] as const)("returns a truthful pre-export 409 for over-capacity %s requests without changing state", async (mode) => {
    for (const [index, role, code] of [[2, "suspect", "too-many-suspect-products"], [1, "concomitant", "too-many-concomitant-products"]] as const) {
      const current = correctCapacityProduct(productCapacityCase(), index, { role: { kind: "known", value: role } });
      const state = { version: browserStateVersion, stage: "output", case: current, unrepresented: [] };
      const before = structuredClone(state);
      expect(parseBrowserJourneyState(state).case).toEqual(current);
      const response = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state }) }));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "pdf-not-ready", error: expect.stringContaining("retained") });
      expect(state).toEqual(before);
      expect((await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id)).outputIssues[0].code).toBe(code);
    }
  });

  it("recomputes readiness after explicit role corrections, retaining identity, other facts and correction history", async () => {
    const initial = productCapacityCase(), repository = new InMemoryCaseRepository({ initialCase: initial });
    const third = initial.products[2];
    const correctRole = (value: "suspect" | "concomitant") => performJourneyAction(repository, initial.id, { action: "set-fact", target: `product:${third.id}:role`, value: { kind: "known", value } }, fixedJourneyModel);
    expect((await correctRole("suspect")).outputIssues[0].code).toBe("too-many-suspect-products");
    expect((await correctRole("concomitant")).downloadReady).toBe(true);
    const restored = (await repository.load(initial.id))!;
    expect(restored.products.slice(0, 2)).toEqual(initial.products.slice(0, 2));
    expect(restored.products[2].id).toBe(third.id);
    expect(restored.products[2].facts.role.supersededValues).toHaveLength(third.facts.role.supersededValues.length + 2);
    for (const field of ["name", "dose", "startDate", "indication"] as const) expect(restored.products[2].facts[field]).toEqual(third.facts[field]);
  });

  it("counts only retained products after an explicit withdrawal", async () => {
    let current = correctCapacityProduct(productCapacityCase(), 2, { role: { kind: "known", value: "suspect" } });
    current = applyCaseCommand(current, { type: "withdraw-case-entity", commandId: "capacity-withdraw", expectedRevision: current.revision, target: { entity: "product", entityId: capacityProductIds[2] }, source: { id: "withdraw-source", inputId: "withdraw-input", inputType: "correction", excerpt: "Withdraw", start: 0, end: 8, actor: "clinician", recordedAt: "2026-10-14T00:00:00.000Z" } }).case;
    const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
    expect(snapshot.downloadReady).toBe(true);
    expect(current.products).toHaveLength(3);
    expect(current.products[2].state).toBe("withdrawn");
    expect(snapshot.projection.sections.D.suspectProducts).toHaveLength(2);
  });
});
