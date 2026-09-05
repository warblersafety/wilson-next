import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { projectForm3500 } from "../../src/domain/case/projection";
import { fillForm3500Projection, FORM_3500_PAGE_COUNT } from "../../src/server/pdf/form-3500";
import {
  acceptCorrectionAndConflict,
  acceptOpeningCase,
  answerIndications,
  attachCorrectionAndContradiction,
  completeResolvedCase,
} from "../domain/fixture";

const execFileAsync = promisify(execFile);
const sourcePath = fileURLToPath(new URL("../../assets/fda/form-fda-3500-09-2025.pdf", import.meta.url));
const independentReaderPath = fileURLToPath(new URL("../../tools/pdf/independent_readback.py", import.meta.url));

describe("fixed semantic projection to Form FDA 3500", () => {
  it("omits the conflicted date and round-trips every supported projection value", async () => {
    const conflictedCase = acceptCorrectionAndConflict(
      attachCorrectionAndContradiction(answerIndications(acceptOpeningCase())),
    );
    const projection = projectForm3500(conflictedCase);
    const source = new Uint8Array(await readFile(sourcePath));
    const result = await fillForm3500Projection(source, projection);

    expect(projection.sections.D.suspectProducts[0].startDate).toBeUndefined();
    expect(result.readback).toEqual({ pageCount: FORM_3500_PAGE_COUNT, sections: projection.sections });
    const directory = await mkdtemp(join(tmpdir(), "wilson-slice-2-conflicted-"));
    const outputPath = join(directory, "conflicted-form.pdf");
    await writeFile(outputPath, result.output);
    const python = process.env.PYPDF_PYTHON ?? "python3";
    const { stdout } = await execFileAsync(python, [independentReaderPath, outputPath, "--named"]);
    const independent = JSON.parse(stdout) as { namedFields: Record<string, string> };
    expect(independent.namedFields)
      .not.toHaveProperty("topmostSubform[0].Page4[0].Prod1[0].Prod1TherapyStartDate[0]");
  });

  it("produces an independently readable final form matching the resolved case", async () => {
    const projection = projectForm3500(completeResolvedCase());
    const source = new Uint8Array(await readFile(sourcePath));
    const { output, readback } = await fillForm3500Projection(source, projection);
    expect(readback).toEqual({ pageCount: FORM_3500_PAGE_COUNT, sections: projection.sections });

    const directory = await mkdtemp(join(tmpdir(), "wilson-slice-2-"));
    const outputPath = join(directory, "resolved-form.pdf");
    await writeFile(outputPath, output);
    const python = process.env.PYPDF_PYTHON ?? "python3";
    const { stdout } = await execFileAsync(python, [independentReaderPath, outputPath, "--named"]);
    const independent = JSON.parse(stdout) as {
      encrypted: boolean;
      pageCount: number;
      namedFields: Record<string, string>;
    };

    expect(independent.encrypted).toBe(false);
    expect(independent.pageCount).toBe(FORM_3500_PAGE_COUNT);
    expect(independent.namedFields).toMatchObject({
      "topmostSubform[0].Page1[0].SecA_Patient[0].PatientIdentifier[0]": "TEST-57",
      "topmostSubform[0].Page1[0].SecA_Patient[0].AgeValue[0]": "57",
      "topmostSubform[0].Page1[0].SecA_Patient[0].AgeYears[0]": "/1",
      "topmostSubform[0].Page1[0].SecA_Patient[0].SexF[0]": "/1",
      "topmostSubform[0].Page1[0].SecA_Patient[0].RepAdverse[0]": "/1",
      "topmostSubform[0].Page1[0].SecA_Patient[0].Hospital[0]": "/1",
      "topmostSubform[0].Page1[0].SecA_Patient[0].EventDate[0]": "18-AUG-2026",
      "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]": projection.sections.B.eventDescription,
      "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TestData1[0]": "Hemoglobin: 7.8 g/dL",
      "topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]": "apixaban",
      "topmostSubform[0].Page4[0].Prod1[0].Prod1Dose[0]": "5 mg",
      "topmostSubform[0].Page4[0].Prod1[0].Prod1Freq[0]": "BID",
      "topmostSubform[0].Page4[0].Prod1[0].Prod1Route[0]": "Oral",
      "topmostSubform[0].Page4[0].Prod1[0].Prod1TherapyStartDate[0]": "13-AUG-2026",
      "topmostSubform[0].Page4[0].Prod1[0].Prod1Diagnosis[0]": "postoperative VTE prophylaxis after knee replacement",
      "topmostSubform[0].Page5[0].Prod2[0].Prod2Name[0]": "naproxen",
      "topmostSubform[0].Page5[0].Prod2[0].Prod2Dose[0]": "250 mg",
      "topmostSubform[0].Page5[0].Prod2[0].Prod2Freq[0]": "BID",
      "topmostSubform[0].Page5[0].Prod2[0].Prod2Route[0]": "Oral",
      "topmostSubform[0].Page5[0].Prod2[0].Prod2TherapyStartDate[0]": "10-AUG-2026",
      "topmostSubform[0].Page5[0].Prod2[0].Prod2Diagnosis[0]": "postoperative pain",
      "topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Prod1[0]": "lisinopril",
    });
    expect(independent.namedFields["topmostSubform[0].Page4[0].Prod1[0].Prod1TherapyStartDate[0]"])
      .not.toBe("12-AUG-2026");
  });
});
