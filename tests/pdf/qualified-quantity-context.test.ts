import { expect, it } from "vitest";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest } from "next/server";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { productCapacityCase, correctCapacityProduct } from "../fixtures/product-capacity";
import { setContextFact } from "../fixtures/reviewed-context";
import { PDFDocument } from "@cantoo/pdf-lib";
import { projectForm3500 } from "../../src/domain/case/projection";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { eventNarrativeLimitation } from "../../src/server/pdf/quantity";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, outputReadinessIssues } from "../../src/server/journey/service";
import { medicationCase, setMedication } from "../fixtures/medication-case";
const narrative = "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]";
async function inspect(state: ReturnType<typeof medicationCase>) {
  const before = structuredClone(state), projection = projectForm3500(state);
  const source = new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf"));
  const result = await fillForm3500Projection(source, projection);
  const dir = await mkdtemp(join(tmpdir(), "wilson115-quantity-")), path = join(dir, "qualified.pdf");
  await writeFile(path, result.output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  if (process.env.WILSON_QUANTITY_EVIDENCE && projection.sections.D.suspectProducts.some(product => product.dose?.qualifier !== undefined || product.strength?.qualifier !== undefined)) {
    await writeFile(join(process.env.WILSON_QUANTITY_EVIDENCE, "qualified.pdf"), result.output);
    await writeFile(join(process.env.WILSON_QUANTITY_EVIDENCE, "readback.json"), stdout);
  }
  expect(state).toEqual(before);
  return { fields: JSON.parse(stdout).namedFields as Record<string, string>, projection, source, output: result.output };
}
it.each([["500 mg", "25"], ["2 mL", "30"], ["5 mg/mL", "29"], ["3 mcg", "16"]])("keeps %s native units and exact context in both suspect slots", async (value, unit) => {
  let state = medicationCase(true);
  for (const name of ["amoxicillin", "naproxen"]) state = setMedication(state, name, { dose: { kind: "known", value, qualifier: "reported, uncertain" }, strength: { kind: "known", value, qualifier: "label may be old" } });
  const { fields, projection } = await inspect(state);
  for (const [n, page] of [[1, 4], [2, 5]]) for (const field of ["Dose", "Strength"]) {
    const prefix = `topmostSubform[0].Page${page}[0].Prod${n}[0].Prod${n}${field}`;
    expect(fields[`${prefix}[0]`]).toBe(`${value.split(" ")[0]} (see B5)`);
    expect(fields[`${prefix}Unit[0]`]).toBe(unit);
    expect(fields[narrative]).toContain(`Suspect product #${n} ${field.toLowerCase()}: ${value} (${field === "Dose" ? "reported, uncertain" : "label may be old"}).`);
  }
  for (const product of state.products) for (const field of ["dose", "strength"] as const) expect(projection.sourceTrace["sections.B.eventDescription"]).toEqual(expect.arrayContaining(product.facts[field].resolvedValue!.sourceIds));
});
it("changes PDF content on qualifier correction, preserves history, and retains no superseded context", async () => {
  const first = setMedication(medicationCase(), "amoxicillin", { strength: { kind: "known", value: "5 mg", qualifier: "reported, uncertain" } });
  const corrected = setMedication(first, "amoxicillin", { strength: { kind: "known", value: "5 mg", qualifier: "confirmed label" } });
  const a = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: first }), first.id);
  const b = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: corrected }), corrected.id);
  expect(a.reportContentKey).not.toBe(b.reportContentKey);
  const { fields } = await inspect(corrected);
  expect(fields[narrative]).toContain("5 mg (confirmed label)");
  expect(fields[narrative]).not.toContain("reported, uncertain");
  expect(corrected.products[0].facts.strength.supersededValues.some(value => value.value.kind === "known" && value.value.qualifier === "reported, uncertain")).toBe(true);
  const removed = setMedication(corrected, "amoxicillin", { strength: { kind: "known", value: "5 mg" } });
  const removedFields = (await inspect(removed)).fields;
  expect(removedFields[narrative]).toBe("Symptoms: rash.");
  expect(removedFields["topmostSubform[0].Page4[0].Prod1[0].Prod1StrengthUnit[0]"]).toBe("25");
});
it.each(["β uncertainty", "x".repeat(4100), Array(90).fill("line").join("\n")])("retains unrepresentable context and blocks before output", async qualifier => {
  const state = setMedication(medicationCase(), "amoxicillin", { strength: { kind: "known", value: "5 mg", qualifier } });
  const before = structuredClone(state), projection = projectForm3500(state);
  const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: state }), state.id);
  if (!qualifier.includes("β")) {
    expect(snapshot.outputIssues.some(issue => ["unsupported-test-history", "unsupported-event-narrative"].includes(issue.code))).toBe(false);
    const output = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection);
    expect(output.readback.pageCount).toBeGreaterThan(8);
    expect(state).toEqual(before);
    return;
  }
  expect(snapshot.downloadReady).toBe(false);
  expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({ code: "unsupported-event-narrative", targets: expect.arrayContaining([`product:${state.products[0].id}:strength`]) }));
  expect(projection.sections.B.eventDescription).toContain(qualifier);
  await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection)).rejects.toThrow("B5 event description");
  expect(state).toEqual(before);
});
it("rejects a direct projection missing its full qualified narrative", async () => {
  const projection = projectForm3500(setMedication(medicationCase(), "amoxicillin", { dose: { kind: "known", value: "500 mg", qualifier: "approximate" } }));
  projection.sections.B.eventDescription = "Symptoms: rash.";
  expect(await eventNarrativeLimitation(projection)).toContain("full reviewed quantity context");
});
it("quantity notes cannot replace the existing event-description requirement", () => {
  const state = structuredClone(setMedication(medicationCase(), "amoxicillin", { dose: { kind: "known", value: "500 mg", qualifier: "approximate" } }));
  for (const fact of Object.values(state.event.facts)) { fact.state = "empty"; fact.resolvedValue = undefined; }
  state.products.forEach(product => { product.facts.stopped.state = "empty"; product.facts.stopped.resolvedValue = undefined; });
  const projection = projectForm3500(state);
  expect(projection.sections.B.eventDescription).toContain("500 mg (approximate)");
  expect(outputReadinessIssues(state, projection).some(issue => issue.code === "missing-event-description")).toBe(true);
});
it("checks pinned narrative geometry and unchanged native font size independently", async () => {
  const document = await PDFDocument.load(await readFile("assets/fda/form-fda-3500-09-2025.pdf"), { password: "" });
  const field = document.getForm().getTextField(narrative);
  const rect = field.acroField.getWidgets()[0].getRectangle();
  expect(rect.width).toBeCloseTo(531.102, 3); expect(rect.height).toBeCloseTo(520.574, 3);
  expect(field.getMaxLength()).toBe(4000);
  expect(field.acroField.getDefaultAppearance()).toContain("8.50 Tf");
});

it.each(["rash ≥ 5 cm", "x".repeat(4100), Array(90).fill("line").join("\n")])("attributes base B5 failures to their contributing event facts with and without quantities", async symptoms => {
  let state = setContextFact(correctCapacityProduct(productCapacityCase(), 0, { dose: { kind: "known", value: "500 mg", qualifier: "approximate" } }), "event:event:symptoms", { kind: "known", value: [symptoms] });
  for (const qualified of [true, false]) {
    if (!qualified) state = correctCapacityProduct(state, 0, { dose: { kind: "known", value: "500 mg" } });
    const before = structuredClone(state);
    const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: state }), state.id);
    if (!symptoms.includes("≥")) {
      expect(snapshot.outputIssues.some(issue => issue.code === "unsupported-event-narrative")).toBe(false);
      expect((await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).readback.pageCount).toBeGreaterThan(8);
      expect(state).toEqual(before);
      continue;
    }
    expect(snapshot.downloadReady).toBe(false);
    const issue = snapshot.outputIssues.find(issue => issue.code === "unsupported-event-narrative");
    expect(issue?.targets).toContain("event:event:symptoms");
    expect(issue?.targets).not.toContain(`product:${state.products[0].id}:dose`);
    expect(issue?.entityIds).toContain("event");
    expect(issue?.message).toContain("B5 event description");
    expect(issue?.message).not.toContain("quantity narrative");
    await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).rejects.toThrow("B5 event description");
    for (const mode of ["preview", "download"]) {
      const response = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state: { version: browserStateVersion, stage: "output", case: state, unrepresented: [] } }) }));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "pdf-not-ready", error: expect.stringContaining("B5 event description") });
    }
    expect(state).toEqual(before);
  }
});
