import { describe, expect, it } from "vitest";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { projectForm3500 } from "../../src/domain/case/projection";
import { productCapacityCase, correctCapacityProduct } from "../fixtures/product-capacity";
const first = "topmostSubform[0].Page4[0].Prod1[0].Prod1";
const second = "topmostSubform[0].Page5[0].Prod2[0].Prod2";
const run = promisify(execFile);
async function inspect(current: ReturnType<typeof productCapacityCase>) {
  const before = structuredClone(current), projection = projectForm3500(current);
  const { output, readback } = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  expect(current).toEqual(before);
  const dir = await mkdtemp(join(tmpdir(), "wilson128-route-")), file = join(dir, "routes.pdf"); await writeFile(file, output);
  const { stdout } = await run(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
  return { file, readback, named: JSON.parse(stdout).namedFields as Record<string, string> };
}

describe("faithful native and Other FDA route controls", () => {
  it("uses native route labels with formatting-only normalization in both suspect slots", async () => {
    let current = correctCapacityProduct(productCapacityCase(), 0, { route: { kind: "known", value: " INTRAMUSCULAR " } });
    current = correctCapacityProduct(current, 1, { route: { kind: "known", value: "Intravenous bolus" } });
    const { named } = await inspect(current);
    expect(named[`${first}Route[0]`]).toBe("Intramuscular"); expect(named[`${second}Route[0]`]).toBe("Intravenous bolus");
    expect(named[`${first}RouteOther[0]`]).toBeUndefined(); expect(named[`${second}RouteOther[0]`]).toBeUndefined();
    expect(current.products[0].facts.route.resolvedValue?.value).toEqual({ kind: "known", value: " INTRAMUSCULAR " });
  });
  it("preserves custom wording and abbreviations verbatim in visible printable Other controls", async () => {
    let current = correctCapacityProduct(productCapacityCase(), 0, { route: { kind: "known", value: " IV " }, frequency: { kind: "known", value: "every other morning" } });
    current = correctCapacityProduct(current, 1, { route: { kind: "known", value: "custom route as reported" }, frequency: { kind: "known", value: "with breakfast on alternate days" } });
    const { named, file, readback } = await inspect(current);
    for (const prefix of [first, second]) expect(named[`${prefix}Route[0]`]).toBe("Other");
    expect(named[`${first}RouteOther[0]`]).toBe(" IV "); expect(named[`${second}RouteOther[0]`]).toBe("custom route as reported");
    expect(named[`${first}FreqOther[0]`]).toBe("every other morning"); expect(named[`${second}FreqOther[0]`]).toBe("with breakfast on alternate days");
    expect(readback.sections.D.suspectProducts.map(p => p.route)).toEqual([" IV ", "custom route as reported"]);
    const code = `import sys,json
from pypdf import PdfReader
r=PdfReader(sys.argv[1]);a=[]
for p in r.pages:
 for ref in p.get('/Annots',[]):
  w=ref.get_object();n=str(w.get('/T',''))
  if 'RouteOther' in n or 'FreqOther' in n:
   a.append({'name':n,'flags':int(w.get('/F',0)),'fieldFlags':int(w.get('/Ff',0)),'value':str(w.get('/V',''))})
print(json.dumps(a))`;
    const metadata = JSON.parse((await run(process.env.PYPDF_PYTHON ?? "python3", ["-c", code, file])).stdout);
    expect(metadata).toHaveLength(4);
    for (const field of metadata) { expect(field.flags & 32).toBe(0); expect(field.flags & 4).toBe(4); expect(field.flags).toBe(68); expect(field.fieldFlags).toBe(8388609); expect(field.value.trim()).not.toBe(""); }
    console.log(JSON.stringify({ routeEvidencePdf: file }));
  });
  it("explicit correction to native oral clears prior Other text without changing retained history", async () => {
    const custom = correctCapacityProduct(productCapacityCase(), 0, { route: { kind: "known", value: "unlisted supplied route" } });
    const prior = await inspect(custom); expect(prior.named[`${first}RouteOther[0]`]).toBe("unlisted supplied route");
    const corrected = correctCapacityProduct(custom, 0, { route: { kind: "known", value: "oral" } });
    const { named, readback } = await inspect(corrected);
    expect(named[`${first}Route[0]`]).toBe("Oral"); expect(named[`${first}RouteOther[0]`]).toBeUndefined();
    expect(readback.sections.D.suspectProducts[0].route).toBe("oral");
    expect(corrected.products[0].facts.route.supersededValues.map(v => v.value)).toContainEqual({ kind: "known", value: "unlisted supplied route" });
  });
  it("does not turn non-known route facts into a known Unknown/Other option", async () => {
    let current = correctCapacityProduct(productCapacityCase(), 0, { route: { kind: "unknown" } });
    current = correctCapacityProduct(current, 1, { route: { kind: "declined" } });
    const { named, readback } = await inspect(current);
    for (const prefix of [first, second]) { expect(named[`${prefix}Route[0]`]?.trim() ?? "").toBe(""); expect(named[`${prefix}RouteOther[0]`]).toBeUndefined(); }
    expect(readback.sections.D.suspectProducts.every(p => p.route === undefined)).toBe(true);
  });
});
