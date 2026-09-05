import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  FORM_3500_SHA256,
  FORM_3500_VERSION,
  fillRepresentativeForm,
  inspectCantooReload,
  type RepresentativeFormValues,
} from "../../src/server/pdf/form-3500.ts";

const execFileAsync = promisify(execFile);
const sourcePath = "assets/fda/form-fda-3500-09-2025.pdf";
const outputPath = "evidence/slice-0/filled-form.pdf";
const resultPath = "evidence/slice-0/gate-result.json";
const independentReaderPath = "tools/pdf/independent_readback.py";

const values: RepresentativeFormValues = {
  patientIdentifier: "SLICE0-TEST-57",
  eventNarrative:
    "Synthetic compatibility evidence only.\nTwo-line narrative proves multiline rendering.",
  hospitalized: true,
  productOneName: "SLICE0 APIXABAN",
  productOneRoute: "Oral",
  productTwoName: "SLICE0 NAPROXEN",
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const source = new Uint8Array(await readFile(sourcePath));
const { output, readback } = await fillRepresentativeForm(source, values);
await writeFile(outputPath, output);

const python = process.env.PYPDF_PYTHON ?? "python3";
const { stdout } = await execFileAsync(python, [
  independentReaderPath,
  outputPath,
]);
const independentReadback = JSON.parse(stdout) as Record<string, unknown>;
const cantooReload = await inspectCantooReload(output);

const result = {
  gate: "Experiment 1 Slice 0",
  source: {
    form: "Form FDA 3500",
    version: FORM_3500_VERSION,
    sha256: sha256(source),
    expectedSha256: FORM_3500_SHA256,
  },
  output: {
    sha256: sha256(output),
    cantooReload,
    ordinarySupportedApiReadback: readback,
    independentReadback,
  },
};

await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
