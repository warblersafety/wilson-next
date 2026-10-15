import { PDFDocument } from "@cantoo/pdf-lib";
import { NextRequest } from "next/server";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { identifierGeometry, productTextLimitation } from "../../src/server/pdf/product-text";
import { expect, it } from "vitest";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { projectForm3500 } from "../../src/domain/case/projection";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { productCardFields } from "../../app/product-fields";
import { productCapacityCase, correctCapacityProduct } from "../fixtures/product-capacity";
import { contextSource } from "../fixtures/reviewed-context";
const key = (n: number) => `topmostSubform[0].Page${n + 3}[0].Prod${n}[0].Prod${n}NDC_ID[0]`;
function fixture() {
  let c = correctCapacityProduct(productCapacityCase(), 0, { ndcOrUniqueId: { kind: "known", value: "00123-0045-06" } });
  return correctCapacityProduct(c, 1, { ndcOrUniqueId: { kind: "known", value: "HCT 00-A/07" } });
}
async function inspect(c: ReturnType<typeof fixture>, evidence = false) {
  const projection = projectForm3500(c), before = structuredClone(c);
  const result = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  expect(result.readback.sections).toEqual(projection.sections);
  const path = join(await mkdtemp(join(tmpdir(), "wilson162-")), "identifier.pdf"); await writeFile(path, result.output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  if (evidence && process.env.WILSON_IDENTIFIER_EVIDENCE) {
    await writeFile(join(process.env.WILSON_IDENTIFIER_EVIDENCE, "identifier.pdf"), result.output);
    await writeFile(join(process.env.WILSON_IDENTIFIER_EVIDENCE, "readback.json"), stdout);
  }
  expect(c).toEqual(before); return { projection, fields: JSON.parse(stdout).namedFields as Record<string,string> };
}
it("writes both native identifiers with source attribution, without changing unrelated controls", async () => {
  const c = fixture(), { fields, projection } = await inspect(c, true), before = (await inspect(productCapacityCase())).fields;
  expect(fields[key(1)]).toBe("00123-0045-06"); expect(fields[key(2)]).toBe("HCT 00-A/07");
  const withoutExpiration = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([k]) => k !== key(1) && k !== key(2)));
  expect(withoutExpiration(fields)).toEqual(withoutExpiration(before));
  for (let i = 0; i < 2; i++) expect(projection.sourceTrace[`sections.D.suspectProducts.${i}.ndcOrUniqueId`]).toEqual(c.products[i].facts.ndcOrUniqueId.resolvedValue!.sourceIds);
  expect(projection.notIncluded.join(" ")).toContain("Section D partial expiration dates");
  expect(productCardFields("drug-or-biologic", {})).toContain("ndcOrUniqueId");
});
it("corrects and restores exact identifiers and retains previous accepted history", async () => {
  const original = fixture(), c = correctCapacityProduct(original, 1, { ndcOrUniqueId: { kind: "known", value: " 00-A/09 ", qualifier: "label checked twice" } });
  const restored = parseBrowserJourneyState(JSON.parse(JSON.stringify({ version: browserStateVersion, stage: "output", case: c, unrepresented: [] }))).case;
  const { fields, projection } = await inspect(restored);
  expect(fields[key(1)]).toBe("00123-0045-06"); expect(fields[key(2)]).toBe(" 00-A/09 ");
  expect(restored.products[1].facts.ndcOrUniqueId.supersededValues[0].value).toEqual({ kind: "known", value: "HCT 00-A/07" });
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: `product:${c.products[1].id}:ndcOrUniqueId`, reason: "qualifier-not-included", qualifier: "label checked twice", baseValueIncluded: true }));
});
it.each(["unknown", "declined", "explicitly-absent", "inapplicable"] as const)("leaves the native field blank for current %s without resurrecting history", async kind => {
  const c = correctCapacityProduct(fixture(), 0, { ndcOrUniqueId: { kind } });
  const { fields, projection } = await inspect(c);
  expect(fields[key(1)] ?? "").toBe(""); expect(fields[key(2)]).toBe("HCT 00-A/07");
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: `product:${c.products[0].id}:ndcOrUniqueId`, reason: kind }));
});
it("keeps identifier with its product on withdrawal and discloses concomitant omission", async () => {
  const original = fixture();
  const c = applyCaseCommand(original, { type: "withdraw-case-entity", commandId: "withdraw-identifier-first", expectedRevision: original.revision, target: { entity: "product", entityId: original.products[0].id }, source: contextSource("withdraw-identifier-first") }).case;
  const { fields } = await inspect(c); expect(fields[key(1)]).toBe("HCT 00-A/07"); expect(fields[key(2)] ?? "").toBe("");
  const concomitant = correctCapacityProduct(original, 1, { role: { kind: "known", value: "concomitant" } });
  const p = projectForm3500(concomitant);
  expect(p.sections.D.suspectProducts).toHaveLength(1);
  expect(p.notIncluded.join(" ")).toContain("NDC number or Unique ID remains in reviewed knowledge");
  expect(productCardFields("device", {})).not.toContain("ndcOrUniqueId");
  const device = correctCapacityProduct(original, 0, { productType: { kind: "known", value: "device" }, udi: { kind: "known", value: "(01)00000000000000" } });
  const deviceProjection = projectForm3500(device);
  expect(deviceProjection.sections.E.suspectDevice?.udi).toBe("(01)00000000000000");
  expect(deviceProjection.notIncluded.join(" ")).toContain("NDC number or Unique ID remains in reviewed knowledge but is not included in Section E");
  expect(device.products[0].facts.ndcOrUniqueId).toEqual(original.products[0].facts.ndcOrUniqueId);
});
it("does not promote pending or conflicting identifier proposals", async () => {
  const c = fixture(), source = contextSource("identifier-alternatives"), target = { entity: "product" as const, entityId: c.products[0].id, field: "ndcOrUniqueId" as const };
  const pending = applyCaseCommand(c, { type: "attach-grounded-proposals", commandId: "pending-identifier", expectedRevision: c.revision, products: [], sources: [source], proposals: ["ALT-01", "ALT-02"].map((value, i) => ({ proposalId: `identifier-${i}`, groupId: "identifier-alternative", intent: "alternative" as const, target, value: { kind: "known" as const, value }, sourceIds: [source.id] })) }).case;
  expect(projectForm3500(pending).sections.D.suspectProducts[0].ndcOrUniqueId).toBe("00123-0045-06");
  const conflict = applyCaseCommand(pending, { type: "review-proposal-groups", commandId: "accept-identifier-alternatives", expectedRevision: pending.revision, decisions: [{ groupId: "identifier-alternative", action: "accept" }] }).case;
  expect(projectForm3500(conflict).sections.D.suspectProducts[0].ndcOrUniqueId).toBeUndefined();
  expect((await inspect(conflict)).fields[key(1)] ?? "").toBe("");
});

it.each(["", " ", "β-00", "00\n12", "00\t12", "W".repeat(60)])("retains unrepresentable identifier %j with actionable readiness and both API modes blocked", async value => {
  const c = correctCapacityProduct(fixture(), 0, { ndcOrUniqueId: { kind: "known", value } }), before = structuredClone(c);
  const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: c }), c.id);
  expect(snapshot.downloadReady).toBe(false);
  expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({ code: "unsupported-product-text", targets: [`product:${c.products[0].id}:ndcOrUniqueId`], message: expect.stringContaining("NDC number or Unique ID") }));
  await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).rejects.toThrow();
  for (const mode of ["preview", "download"]) {
    const r = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state: { version: browserStateVersion, stage: "output", case: c, unrepresented: [] } }) }));
    expect(r.status).toBe(409); expect(await r.json()).toMatchObject({ code: "pdf-not-ready" });
  }
  expect(c).toEqual(before);
});
it("checks both pinned native widths and actual metric boundary without shrinking type or imposing NDC number syntax", async () => {
  const doc = await PDFDocument.load(await readFile("assets/fda/form-fda-3500-09-2025.pdf"), { password: "" });
  for (const n of [1,2]) expect(doc.getForm().getTextField(key(n)).acroField.getWidgets()[0].getRectangle().width).toBeCloseTo(identifierGeometry.width, 3);
  let fits = "i";
  while (!productTextLimitation("ndcOrUniqueId", fits + "i")) fits += "i";
  expect(fits.length).toBeGreaterThan(40);
  expect(productTextLimitation("ndcOrUniqueId", fits)).toBeUndefined();
  expect(productTextLimitation("ndcOrUniqueId", fits + "i")).toContain("native font size");
  expect((await inspect(correctCapacityProduct(fixture(), 0, { ndcOrUniqueId: { kind: "known", value: fits } }))).fields[key(1)]).toBe(fits);
});
