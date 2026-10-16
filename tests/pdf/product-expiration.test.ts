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
const key = (n: number) => `topmostSubform[0].Page${n + 3}[0].Prod${n}[0].Prod${n}ExpDate[0]`;
function fixture() {
  let c = correctCapacityProduct(productCapacityCase(), 0, { expirationDate: { kind: "known", value: "2028-02-29" } });
  return correctCapacityProduct(c, 1, { expirationDate: { kind: "known", value: "2027-12-31" } });
}
async function inspect(c: ReturnType<typeof fixture>, evidence = false) {
  const projection = projectForm3500(c), before = structuredClone(c);
  const result = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  expect(result.readback.sections).toEqual(projection.sections);
  const path = join(await mkdtemp(join(tmpdir(), "wilson162-")), "expiration.pdf"); await writeFile(path, result.output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  if (evidence && process.env.WILSON_EXPIRATION_EVIDENCE) {
    await writeFile(join(process.env.WILSON_EXPIRATION_EVIDENCE, "expiration.pdf"), result.output);
    await writeFile(join(process.env.WILSON_EXPIRATION_EVIDENCE, "readback.json"), stdout);
  }
  expect(c).toEqual(before); return { projection, fields: JSON.parse(stdout).namedFields as Record<string,string> };
}
it("writes both native expiration dates with source attribution, without changing unrelated controls", async () => {
  const c = fixture(), { fields, projection } = await inspect(c, true), before = (await inspect(productCapacityCase())).fields;
  expect(fields[key(1)]).toBe("29-FEB-2028"); expect(fields[key(2)]).toBe("31-DEC-2027");
  const withoutExpiration = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([k]) => k !== key(1) && k !== key(2)));
  expect(withoutExpiration(fields)).toEqual(withoutExpiration(before));
  for (let i = 0; i < 2; i++) expect(projection.sourceTrace[`sections.D.suspectProducts.${i}.expirationDate`]).toEqual(c.products[i].facts.expirationDate.resolvedValue!.sourceIds);
  expect(projection.notIncluded.join(" ")).toContain("Expiration precision outside complete dates");
  expect(productCardFields("drug-or-biologic", {})).toContain("expirationDate");
});
it("corrects and restores exact dates and retains previous accepted history", async () => {
  const original = fixture(), c = correctCapacityProduct(original, 1, { expirationDate: { kind: "known", value: "2029-11-30", qualifier: "label checked twice" } });
  const restored = parseBrowserJourneyState(JSON.parse(JSON.stringify({ version: browserStateVersion, stage: "output", case: c, unrepresented: [] }))).case;
  const { fields, projection } = await inspect(restored);
  expect(fields[key(1)]).toBe("29-FEB-2028"); expect(fields[key(2)]).toBe("30-NOV-2029");
  expect(restored.products[1].facts.expirationDate.supersededValues[0].value).toEqual({ kind: "known", value: "2027-12-31" });
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: `product:${c.products[1].id}:expirationDate`, reason: "qualifier-not-included", qualifier: "label checked twice", baseValueIncluded: true }));
});
it.each(["unknown", "declined", "explicitly-absent", "inapplicable"] as const)("leaves the native field blank for current %s without resurrecting history", async kind => {
  const c = correctCapacityProduct(fixture(), 0, { expirationDate: { kind } });
  const { fields, projection } = await inspect(c);
  expect(fields[key(1)] ?? "").toBe(""); expect(fields[key(2)]).toBe("31-DEC-2027");
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: `product:${c.products[0].id}:expirationDate`, reason: kind }));
});
it("keeps expiration with its product on withdrawal and discloses concomitant omission", async () => {
  const original = fixture();
  const c = applyCaseCommand(original, { type: "withdraw-case-entity", commandId: "withdraw-expiration-first", expectedRevision: original.revision, target: { entity: "product", entityId: original.products[0].id }, source: contextSource("withdraw-expiration-first") }).case;
  const { fields } = await inspect(c); expect(fields[key(1)]).toBe("31-DEC-2027"); expect(fields[key(2)] ?? "").toBe("");
  const concomitant = correctCapacityProduct(original, 1, { role: { kind: "known", value: "concomitant" } });
  const p = projectForm3500(concomitant);
  expect(p.sections.D.suspectProducts).toHaveLength(1);
  expect(p.notIncluded.join(" ")).toContain("Expiration date remains in reviewed knowledge");
  expect(productCardFields("device", {})).toContain("expirationDate");
});
it("does not promote pending or conflicting expiration proposals", async () => {
  const c = fixture(), source = contextSource("expiration-alternatives"), target = { entity: "product" as const, entityId: c.products[0].id, field: "expirationDate" as const };
  const pending = applyCaseCommand(c, { type: "attach-grounded-proposals", commandId: "pending-expiration", expectedRevision: c.revision, products: [], sources: [source], proposals: ["2029-01-01", "2030-01-01"].map((value, i) => ({ proposalId: `expiry-${i}`, groupId: "expiry-alternative", intent: "alternative" as const, target, value: { kind: "known" as const, value }, sourceIds: [source.id] })) }).case;
  expect(projectForm3500(pending).sections.D.suspectProducts[0].expirationDate).toBe("2028-02-29");
  const conflict = applyCaseCommand(pending, { type: "review-proposal-groups", commandId: "accept-expiration-alternatives", expectedRevision: pending.revision, decisions: [{ groupId: "expiry-alternative", action: "accept" }] }).case;
  expect(projectForm3500(conflict).sections.D.suspectProducts[0].expirationDate).toBeUndefined();
  expect((await inspect(conflict)).fields[key(1)] ?? "").toBe("");
});
