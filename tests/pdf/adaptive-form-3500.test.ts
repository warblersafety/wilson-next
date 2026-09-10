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
  it("round-trips the added patient, outcome, test, history, and reporter fields", async () => {
    const projection: Form3500Projection = {
      revision: 1,
      sections: {
        A: { patientIdentifier: "TEST-72", ageYears: 72, sex: "female", weight: { value: 64, unit: "kg" } },
        B: {
          reportType: "adverse-event", eventDate: "2026-09-03", eventDescription: "Symptoms: generalized rash and wheezing.",
          death: false, lifeThreatening: true, hospitalized: true, disability: false, requiredIntervention: false,
          congenitalAnomaly: false, otherSerious: false, relevantHistory: "Penicillin allergy",
          relevantTests: [{ testId: "test-1", testResult: "Serum tryptase: 18 ng/mL", lowRange: "0 ng/mL", highRange: "11.4 ng/mL", date: "2026-09-03" }],
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
      "topmostSubform[0].Page7[0].SecG_Reporter[0].LastName[0]": "Chen",
      "topmostSubform[0].Page7[0].SecG_Reporter[0].IdentityNo[0]": "/1",
      "topmostSubform[0].Page7[0].SecG_Reporter[0].Packer[0]": "/1",
    });
  });
});
