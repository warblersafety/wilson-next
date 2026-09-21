import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { projectForm3500 } from "../../src/domain/case/projection";
import { medicationCase, setMedication } from "../fixtures/medication-case";
import type { SemanticCase } from "../../src/domain/case/types";

const known = <T>(value: T) => ({ kind: "known" as const, value });
const first = "topmostSubform[0].Page4[0].Prod1[0].Prod1";
const second = "topmostSubform[0].Page5[0].Prod2[0].Prod2";

it("reads both actual D5/D7/D8 slots independently, including correction, no resurrection and unknown versus not applicable", async () => {
  const source = new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf"));
  const dir = await mkdtemp(join(tmpdir(), "wilson-medication-pdf-"));
  const read = async (current: SemanticCase) => {
    const projection = projectForm3500(current);
    const { output, readback } = await fillForm3500Projection(source, projection);
    expect(readback.sections).toEqual(projection.sections);
    const file = join(dir, "medication.pdf");
    await writeFile(file, output);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
    return JSON.parse(stdout).namedFields as Record<string, string>;
  };
  let current = setMedication(medicationCase(true), "amoxicillin", { stopped: known(true), stopDate: known("2026-09-18"), improvedAfterChange: known(true), restarted: known(true), recurred: known(true), medicationType: known(["generic-biosimilar", "otc"]) });
  current = setMedication(current, "naproxen", { stopped: known(false), doseReduced: known(true), improvedAfterChange: known(false), restarted: known(false), medicationType: known(["brand"]) });
  let fields = await read(current);
  const checked = (fields: Record<string, string>, key: string) => Boolean(fields[key] && fields[key] !== "/Off");
  for (const suffix of ["Generic", "OTC", "AbatedYes", "ReappearYes"]) expect(checked(fields, `${first}${suffix}[0]`)).toBe(true);
  for (const suffix of ["Brand", "AbatedNo", "ReappearNA"]) expect(checked(fields, `${second}${suffix}[0]`)).toBe(true);
  expect(fields[`${first}TherapyStopDate[0]`]).toBe("18-SEP-2026");
  expect(checked(fields, `${first}Brand[0]`)).toBe(false);
  current = setMedication(current, "amoxicillin", { restarted: known(false) });
  fields = await read(current);
  expect(checked(fields, `${first}ReappearYes[0]`)).toBe(false);
  expect(checked(fields, `${first}ReappearNA[0]`)).toBe(true);
  current = setMedication(current, "amoxicillin", { restarted: known(true) });
  fields = await read(current);
  for (const suffix of ["Yes", "No", "NA"]) expect(checked(fields, `${first}Reappear${suffix}[0]`)).toBe(false);
  current = setMedication(current, "amoxicillin", { recurred: known(false) });
  fields = await read(current);
  expect(checked(fields, `${first}ReappearNo[0]`)).toBe(true);
  current = setMedication(current, "amoxicillin", { restarted: { kind: "unknown" }, improvedAfterChange: { kind: "declined" } });
  fields = await read(current);
  for (const suffix of ["Yes", "No", "NA"]) {
    expect(checked(fields, `${first}Reappear${suffix}[0]`)).toBe(false);
    expect(checked(fields, `${first}Abated${suffix}[0]`)).toBe(false);
  }
});
