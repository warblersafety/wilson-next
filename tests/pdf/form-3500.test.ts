import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FORM_3500_PAGE_COUNT,
  fillRepresentativeForm,
  type RepresentativeFormValues,
} from "../../src/server/pdf/form-3500";

const execFileAsync = promisify(execFile);
const sourcePath = fileURLToPath(
  new URL("../../assets/fda/form-fda-3500-09-2025.pdf", import.meta.url),
);
const independentReaderPath = fileURLToPath(
  new URL("../../tools/pdf/independent_readback.py", import.meta.url),
);

const representativeValues: RepresentativeFormValues = {
  patientIdentifier: "SLICE0-TEST-57",
  eventNarrative:
    "Synthetic compatibility evidence only.\nTwo-line narrative proves multiline rendering.",
  hospitalized: true,
  productOneName: "SLICE0 APIXABAN",
  productOneRoute: "Oral",
  productTwoName: "SLICE0 NAPROXEN",
};

describe("Form FDA 3500 Slice 0 adapter gate", () => {
  it("rejects any source that does not match the approved versioned bytes", async () => {
    const source = new Uint8Array(await readFile(sourcePath));
    source[source.length - 1] ^= 1;

    await expect(fillRepresentativeForm(source, representativeValues)).rejects
      .toThrow("Unsupported Form FDA 3500 source");
  });

  it("fills and reads the representative fields through supported APIs", async () => {
    const source = new Uint8Array(await readFile(sourcePath));
    const { readback } = await fillRepresentativeForm(
      source,
      representativeValues,
    );

    expect(readback).toEqual({
      ...representativeValues,
      pageCount: FORM_3500_PAGE_COUNT,
    });
  });

  it("saves and reloads with pypdf 6.16.2 independent readback", async () => {
    const source = new Uint8Array(await readFile(sourcePath));
    const { output } = await fillRepresentativeForm(
      source,
      representativeValues,
    );
    const evidenceDirectory = await mkdtemp(join(tmpdir(), "wilson-slice-0-"));
    const outputPath = join(evidenceDirectory, "independent-readback.pdf");
    await writeFile(outputPath, output);

    const python = process.env.PYPDF_PYTHON ?? "python3";
    const { stdout } = await execFileAsync(python, [
      independentReaderPath,
      outputPath,
    ]);
    const independent = JSON.parse(stdout) as Record<string, unknown>;

    expect(independent).toEqual({
      pypdfVersion: "6.16.2",
      encrypted: false,
      pageCount: FORM_3500_PAGE_COUNT,
      fieldValues: [
        "/1",
        "Oral",
        "SLICE0 APIXABAN",
        "SLICE0 NAPROXEN",
        "SLICE0-TEST-57",
        representativeValues.eventNarrative,
      ].sort(),
    });
  });
});
