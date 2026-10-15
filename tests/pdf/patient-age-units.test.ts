import { expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest } from "next/server";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { isPatientAge, type PatientAge } from "../../src/domain/case/age";
import { projectForm3500 } from "../../src/domain/case/projection";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { nativeAgeGeometry } from "../../src/server/pdf/patient-age";
import { productCapacityCase } from "../fixtures/product-capacity";
import { contextSource, setContextFact } from "../fixtures/reviewed-context";
const prefix = "topmostSubform[0].Page1[0].SecA_Patient[0].Age";
const checked = (fields: Record<string,string>, unit: string) => Boolean(fields[`${prefix}${unit}[0]`] && fields[`${prefix}${unit}[0]`] !== "/Off");
const ageKeys = ["Value", "Years", "Months", "Weeks", "Days"].map(suffix => `${prefix}${suffix}[0]`);
function fixture(value: PatientAge) { return setContextFact(productCapacityCase(), "patient:patient:ageYears", { kind: "known", value }); }
async function inspect(c: ReturnType<typeof productCapacityCase>, evidence?: string) {
  const projection = projectForm3500(c), before = structuredClone(c);
  const result = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  expect(result.readback.sections).toEqual(projection.sections); expect(c).toEqual(before);
  const path = join(await mkdtemp(join(tmpdir(), "wilson167-")), "age.pdf"); await writeFile(path, result.output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  if (evidence && process.env.WILSON_AGE_EVIDENCE) { await writeFile(join(process.env.WILSON_AGE_EVIDENCE, `${evidence}.pdf`), result.output); await writeFile(join(process.env.WILSON_AGE_EVIDENCE, `${evidence}-readback.json`), stdout); }
  return { projection, fields: JSON.parse(stdout).namedFields as Record<string,string> };
}
it.each([{ value: 24, unit: "months" }, { value: 5, unit: "days" }, { value: 6, unit: "weeks" }, { value: 0, unit: "months" }, { value: 0, unit: "days" }, { value: 0, unit: "weeks" }] as const)("maps exact $value $unit with one unit box and unchanged unrelated controls", async age => {
  const c = fixture(age), { fields, projection } = await inspect(c, age.value ? `age-${age.unit}` : undefined), before = (await inspect(productCapacityCase())).fields;
  expect(fields[`${prefix}Value[0]`]).toBe(String(age.value));
  for (const unit of ["Years", "Months", "Weeks", "Days"]) expect(checked(fields, unit)).toBe(unit.toLowerCase() === age.unit);
  const withoutAge = (values: Record<string,string>) => Object.fromEntries(Object.entries(values).filter(([key]) => !ageKeys.includes(key)));
  expect(withoutAge(fields)).toEqual(withoutAge(before));
  expect(projection.sections.A.ageYears).toEqual(age);
  expect(projection.sourceTrace["sections.A.ageYears"]).toEqual(c.patient.facts.ageYears.resolvedValue!.sourceIds);
});
it("corrects amounts/units atomically without conversion, retains qualifier/history and roundtrips numeric years unchanged", async () => {
  let c = fixture({ value: 24, unit: "months" });
  c = setContextFact(c, "patient:patient:ageYears", { kind: "known", value: { value: 24, unit: "days" }, qualifier: "caregiver estimate" });
  let result = await inspect(c); expect(result.fields[`${prefix}Value[0]`]).toBe("24"); expect(checked(result.fields,"Days")).toBe(true);
  expect(result.projection.omissions).toContainEqual(expect.objectContaining({ target: "patient:patient:ageYears", reason: "qualifier-not-included", qualifier: "caregiver estimate", baseValueIncluded: true }));
  c = setContextFact(c, "patient:patient:ageYears", { kind: "known", value: 24 });
  const restored = parseBrowserJourneyState(JSON.parse(JSON.stringify({ version: browserStateVersion, stage: "output", case: c, unrepresented: [] }))).case;
  result = await inspect(restored); expect(result.fields[`${prefix}Value[0]`]).toBe("24"); expect(checked(result.fields,"Years")).toBe(true);
  expect(checked(result.fields,"Months")).toBe(false); expect(checked(result.fields,"Days")).toBe(false);
  expect(restored.patient.facts.ageYears.supersededValues.some(v => v.value.kind === "known" && typeof v.value.value === "object" && v.value.value.unit === "months")).toBe(true);
  expect(restored.patient.facts.ageYears.supersededValues.some(v => v.value.kind === "known" && v.value.qualifier === "caregiver estimate")).toBe(true);
});
it.each(["unknown", "declined", "explicitly-absent", "inapplicable"] as const)("clears every native age control for current %s without resurrecting older units", async kind => {
  const c = setContextFact(fixture({ value: 6, unit: "weeks" }), "patient:patient:ageYears", { kind });
  const { fields, projection } = await inspect(c); expect(fields[`${prefix}Value[0]`] ?? "").toBe("");
  for (const unit of ["Years","Months","Weeks","Days"]) expect(checked(fields,unit)).toBe(false);
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: "patient:patient:ageYears", reason: kind }));
});
it("keeps pending/mixed-unit conflicts unpromoted until explicit resolution", async () => {
  const c = fixture({ value: 24, unit: "months" }), source = contextSource("mixed-age-units");
  const pending = applyCaseCommand(c, { type: "attach-grounded-proposals", commandId: "age-alternatives", expectedRevision: c.revision, products: [], sources: [source], proposals: [{ value: 6, unit: "weeks" }, { value: 24, unit: "months" }].map((value,i) => ({ proposalId: `age-alt-${i}`, groupId: "age-alt-group", intent: "alternative" as const, target: { entity: "patient" as const, entityId: "patient" as const, field: "ageYears" as const }, value: { kind: "known" as const, value }, sourceIds: [source.id] })) }).case;
  expect(projectForm3500(pending).sections.A.ageYears).toEqual({ value: 24, unit: "months" });
  const conflict = applyCaseCommand(pending, { type: "review-proposal-groups", commandId: "accept-age-alternatives", expectedRevision: pending.revision, decisions: [{ groupId: "age-alt-group", action: "accept" }] }).case;
  const conflictFields = (await inspect(conflict)).fields; expect(conflictFields[`${prefix}Value[0]`] ?? "").toBe("");
  const resolved = applyCaseCommand(conflict, { type: "resolve-conflict", commandId: "resolve-age", expectedRevision: conflict.revision, target: { entity: "patient", entityId: "patient", field: "ageYears" }, chosenValueId: "age-alt-0", source: contextSource("choose-weeks") }).case;
  const result = await inspect(resolved); expect(result.fields[`${prefix}Value[0]`]).toBe("6"); expect(checked(result.fields,"Weeks")).toBe(true);
});
it.each(["days", "weeks"] as const)("blocks an accepted %s age beyond native width without losing the value, including both API modes", async unit => {
  const c = fixture({ value: Number.MAX_SAFE_INTEGER, unit }), before = structuredClone(c);
  const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: c }), c.id);
  expect(snapshot.downloadReady).toBe(false); expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({ code: "unsupported-patient-age", targets: ["patient:patient:ageYears"] }));
  await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).rejects.toThrow("age");
  for (const mode of ["preview","download"]) {
    const r = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state: { version: browserStateVersion, stage: "output", case: c, unrepresented: [] } }) }));
    expect(r.status).toBe(409); expect(await r.json()).toMatchObject({ code: "pdf-not-ready" });
  }
  expect(c).toEqual(before);
});
it("pins native age geometry and preserves the old years bounds without accepting other unit/value shapes", async () => {
  const doc = await PDFDocument.load(await readFile("assets/fda/form-fda-3500-09-2025.pdf"), { password: "" });
  expect(doc.getForm().getTextField(`${prefix}Value[0]`).acroField.getWidgets()[0].getRectangle().width).toBeCloseTo(nativeAgeGeometry.width,3);
  for (const value of [0,150,{value:0,unit:"days"},{value:24,unit:"months"},{value:6,unit:"weeks"}]) expect(isPatientAge(value)).toBe(true);
  for (const value of [-1,151,1.5,{value:-1,unit:"days"},{value:1.5,unit:"months"},{value:3,unit:"fortnights"},{value:-1,unit:"weeks"},{value:1.5,unit:"weeks"},{value:2,unit:"years"},{value:2,unit:"months",extra:true},{value:"5",unit:"days"}]) {
    expect(isPatientAge(value)).toBe(false);
    expect(() => setContextFact(productCapacityCase(),"patient:patient:ageYears",{kind:"known",value})).toThrow("valid age");
  }
});

it("retains a qualified week age through unit-only corrections, source/history and numeric years without conversion",async()=>{
  let c=fixture({value:6,unit:"weeks"});
  c=setContextFact(c,"patient:patient:ageYears",{kind:"known",value:{value:6,unit:"weeks"},qualifier:"caregiver estimate"});
  const qualified=await inspect(c);expect(qualified.projection.omissions).toContainEqual(expect.objectContaining({target:"patient:patient:ageYears",reason:"qualifier-not-included",qualifier:"caregiver estimate",baseValueIncluded:true}));
  expect(qualified.fields[`${prefix}Value[0]`]).toBe("6");expect(checked(qualified.fields,"Weeks")).toBe(true);
  for(const value of [{value:6,unit:"days"} as const,{value:6,unit:"months"} as const,6]){
    c=setContextFact(c,"patient:patient:ageYears",{kind:"known",value});
    const restored=parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}).case;
    expect(restored).toEqual(c);const result=await inspect(restored);expect(result.fields[`${prefix}Value[0]`]).toBe("6");expect(checked(result.fields,"Weeks")).toBe(false);
    expect(c.patient.facts.ageYears.supersededValues.some(v=>v.value.kind==="known"&&v.value.qualifier==="caregiver estimate")).toBe(true);
  }
});
