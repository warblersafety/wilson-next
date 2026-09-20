import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { projectForm3500 } from "../../src/domain/case/projection";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { reviewedLaboratoryCase } from "../fixtures/laboratory-case";

it("writes independent numeric, qualitative and partial observations to B6 without inferred units or dates", async () => {
  const state = reviewedLaboratoryCase([
    { testName: "Serum tryptase", testResult: "18 ng/mL", lowRange: "0", highRange: "11.4", date: "2026-09-03" },
    { testName: "hemoglobin", testResult: "9.1 g/dL", lowRange: "12", highRange: "16", date: "2026-09-11" },
    { testName: "stool test", testResult: "positive for occult blood", date: "2026-09-11" },
    { testName: "Urine culture", testResult: "no growth" },
    { testResult: "negative" },
    { testName: "skin biopsy" },
    { testName: "serum trip tase", testResult: "6.2" },
    { testName: "Platelet count", testResult: "82" },
  ], "Synthetic test-only fixture: eight independent observations.");
  const projection = projectForm3500(state);
  const { output } = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  const directory = await mkdtemp(join(tmpdir(), "wilson-laboratory-"));
  const path = join(directory, "laboratory.pdf");
  await writeFile(path, output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  const fields = JSON.parse(stdout).namedFields;
  const prefix = "topmostSubform[0].Page3[0].TestDataTable[0]";
  expect(fields).toMatchObject({
    [`${prefix}.Row1[0].TestData1[0]`]: "Serum tryptase: 18 ng/mL",
    [`${prefix}.Row1[0].TLowRange1[0]`]: "0", [`${prefix}.Row1[0].THighRange1[0]`]: "11.4", [`${prefix}.Row1[0].TDate1[0]`]: "03-SEP-2026",
    [`${prefix}.Row2[0].TestData2[0]`]: "hemoglobin: 9.1 g/dL",
    [`${prefix}.Row2[0].TLowRange2[0]`]: "12", [`${prefix}.Row2[0].THighRange2[0]`]: "16", [`${prefix}.Row2[0].TDate2[0]`]: "11-SEP-2026",
    [`${prefix}.Row3[0].TestData3[0]`]: "stool test: positive for occult blood", [`${prefix}.Row8[0].TDate3[0]`]: "11-SEP-2026",
    [`${prefix}.Row4[0].TestData4[0]`]: "Urine culture: no growth",
    [`${prefix}.Row8[0].TestData8[0]`]: "Test identity not recorded: negative",
    [`${prefix}.Row5[0].TestData5[0]`]: "skin biopsy: Result not recorded",
    [`${prefix}.Row6[0].TestData6[0]`]: "serum trip tase: 6.2",
    [`${prefix}.Row7[0].TestData7[0]`]: "Platelet count: 82",
  });
  for (let row = 4; row <= 8; row++) expect(fields[`${prefix}.Row8[0].TDate${row}[0]`]).toBeUndefined();
  if (process.env.WILSON_LAB_EVIDENCE_DIRECTORY) await writeFile(join(process.env.WILSON_LAB_EVIDENCE_DIRECTORY, "laboratory.pdf"), output);
});


it("preserves clinician Unicode including Greek and inequality symbols in downloaded PDF readback", async () => {
  const input = new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf"));
  const state = reviewedLaboratoryCase([{ testName: "Clinician’s test", testResult: "4 µg/L at 38 °C", lowRange: "2–6" }], "Clinician’s test was 4 µg/L at 38 °C; range 2–6.");
  const { output } = await fillForm3500Projection(input, projectForm3500(state));
  const directory = await mkdtemp(join(tmpdir(), "wilson-unicode-"));
  const path = join(directory, "unicode.pdf");
  await writeFile(path, output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  expect(stdout).toContain("Clinician");
  const fields = JSON.parse(stdout).namedFields;
  expect(fields["topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TestData1[0]"]).toBe("Clinician’s test: 4 µg/L at 38 °C");
  expect(fields["topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TLowRange1[0]"]).toBe("2–6");
  const extended = reviewedLaboratoryCase([{ testName: "β marker", testResult: "≥ 4" }], "β marker was ≥ 4.");
  const extendedPdf = await fillForm3500Projection(input, projectForm3500(extended));
  const extendedPath = join(directory, "extended.pdf");
  await writeFile(extendedPath, extendedPdf.output);
  const extendedReadback = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", extendedPath, "--named"]);
  expect(JSON.parse(extendedReadback.stdout).namedFields["topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TestData1[0]"]).toBe("β marker: ≥ 4");
  if (process.env.WILSON_UNICODE_PDF) await writeFile(process.env.WILSON_UNICODE_PDF, extendedPdf.output);
});
