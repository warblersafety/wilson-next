import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Form3500Projection } from "../../src/domain/case/projection";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";

const execFileAsync = promisify(execFile);
const sourcePath = fileURLToPath(new URL("../../assets/fda/form-fda-3500-09-2025.pdf", import.meta.url));
const readerPath = fileURLToPath(new URL("../../tools/pdf/independent_readback.py", import.meta.url));

describe("adaptive Form FDA 3500 projection fields", () => {
  it("preserves a frequency outside the form's standard vocabulary in its Other field", async () => {
    const projection: Form3500Projection = {
      revision: 1,
      sections: {
        A: {}, B: { relevantTests: [] },
        D: { suspectProducts: [{ productId: "product-acetaminophen", name: "acetaminophen", frequency: "every six hours" }] },
        F: { concomitantProducts: [] }, G: { reporter: {} },
      },
      sourceTrace: {}, omissions: [], notIncluded: [],
    };
    const source = new Uint8Array(await readFile(sourcePath));
    const result = await fillForm3500Projection(source, projection);
    expect(result.readback.sections).toEqual(projection.sections);

    const directory = await mkdtemp(join(tmpdir(), "wilson-frequency-pdf-"));
    const path = join(directory, "frequency.pdf");
    await writeFile(path, result.output);
    const python = process.env.PYPDF_PYTHON ?? "python3";
    const { stdout } = await execFileAsync(python, [readerPath, path, "--named"]);
    const { namedFields } = JSON.parse(stdout) as { namedFields: Record<string, string> };
    expect(namedFields).toMatchObject({
      "topmostSubform[0].Page4[0].Prod1[0].Prod1Freq[0]": "Other",
      "topmostSubform[0].Page4[0].Prod1[0].Prod1FreqOther[0]": "every six hours",
    });
  });

  it("round-trips the added patient, outcome, test, history, and reporter fields", async () => {
    const relevantTests = Array.from({ length: 8 }, (_, index) => ({
      testId: `test-${index + 1}`,
      testResult: index === 0 ? "Serum tryptase: 18 ng/mL" : `Test ${index + 1}: result ${index + 1}`,
      lowRange: index === 0 ? "0 ng/mL" : `low ${index + 1}`,
      highRange: index === 0 ? "11.4 ng/mL" : `high ${index + 1}`,
      date: `2026-09-0${index + 1}`,
    }));
    const projection: Form3500Projection = {
      revision: 1,
      sections: {
        A: { patientIdentifier: "TEST-72", ageYears: 72, sex: "female", weight: { value: 64, unit: "kg" } },
        B: {
          reportType: "adverse-event", eventDate: "2026-09-03", eventDescription: "Symptoms: generalized rash and wheezing.",
          death: false, lifeThreatening: true, hospitalized: true, disability: false, requiredIntervention: false,
          congenitalAnomaly: false, otherSerious: false, relevantHistory: "Penicillin allergy",
          relevantTests,
        },
        D: { suspectProducts: [] },
        F: { concomitantProducts: [] },
        G: { reporter: {
          firstName: "Avery", lastName: "Chen", address: "100 Test Avenue", city: "Seattle", state: "WA", postalCode: "98101",
          country: "UNITED STATES", email: "avery.chen@example.test", healthProfessional: true, occupation: "Physician",
          reportedTo: ["manufacturer", "packer"], doNotDiscloseIdentity: true,
        } },
      },
      sourceTrace: {}, omissions: [], notIncluded: [],
    };
    const source = new Uint8Array(await readFile(sourcePath));
    const result = await fillForm3500Projection(source, projection);
    expect(result.readback.sections).toEqual(projection.sections);

    const directory = await mkdtemp(join(tmpdir(), "wilson-adaptive-pdf-"));
    const path = join(directory, "adaptive.pdf");
    await writeFile(path, result.output);
    const python = process.env.PYPDF_PYTHON ?? "python3";
    const { stdout } = await execFileAsync(python, [readerPath, path, "--named"]);
    const { namedFields } = JSON.parse(stdout) as { namedFields: Record<string, string> };
    expect(namedFields).toMatchObject({
      "topmostSubform[0].Page1[0].SecA_Patient[0].WeightValue[0]": "64",
      "topmostSubform[0].Page1[0].SecA_Patient[0].WeightKG[0]": "/1",
      "topmostSubform[0].Page1[0].SecA_Patient[0].LifeThreaten[0]": "/1",
      "topmostSubform[0].Page3[0].Sec6Data[0].OtherHistory[0]": "Penicillin allergy",
      "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TestData1[0]": "Serum tryptase: 18 ng/mL",
      "topmostSubform[0].Page3[0].TestDataTable[0].Row2[0].TestData2[0]": "Test 2: result 2",
      "topmostSubform[0].Page3[0].TestDataTable[0].Row7[0].TestData7[0]": "Test 7: result 7",
      "topmostSubform[0].Page3[0].TestDataTable[0].Row8[0].THighRange7[0]": "high 7",
      "topmostSubform[0].Page3[0].TestDataTable[0].Row8[0].TDate7[0]": "07-SEP-2026",
      "topmostSubform[0].Page3[0].TestDataTable[0].Row8[0].TestData8[0]": "Test 8: result 8",
      "topmostSubform[0].Page3[0].TestDataTable[0].Row8[0].TDate8[0]": "08-SEP-2026",
      "topmostSubform[0].Page7[0].SecG_Reporter[0].LastName[0]": "Chen",
      "topmostSubform[0].Page7[0].SecG_Reporter[0].IdentityNo[0]": "/1",
      "topmostSubform[0].Page7[0].SecG_Reporter[0].Packer[0]": "/1",
    });
  });
});
