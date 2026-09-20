import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import type { Form3500Projection } from "../../src/domain/case/projection";

const exec = promisify(execFile);
const first = "topmostSubform[0].Page4[0].Prod1[0].Prod1";
const second = "topmostSubform[0].Page5[0].Prod2[0].Prod2";

describe("report completeness PDF", () => {
  it("separates strength and dose in both slots, preserves concentrations, and freezes the reviewed report date", async () => {
    const projection: Form3500Projection = {
      revision: 1, sections: {
        A: {}, B: { reportDate: "2026-09-20", eventDate: "2026-09-03", relevantTests: [] }, C: {},
        D: { suspectProducts: [
          { productId: "tablets", name: "Fictional tablets", dose: "500 mg", strength: "250 mg" },
          { productId: "liquid", name: "Fictional liquid", dose: "10 mL", strength: "250 mg/5 mL" },
        ] }, E: {}, F: { concomitantProducts: [] }, G: { reporter: {} },
      }, sourceTrace: {}, omissions: [], notIncluded: [],
    };
    const source = new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf"));
    const directory = await mkdtemp(join(tmpdir(), "wilson-report-completeness-"));
    const inspect = async () => {
      const { output, readback } = await fillForm3500Projection(source, projection);
      expect(readback.sections).toEqual(projection.sections);
      const path = join(directory, "report.pdf");
      await writeFile(path, output);
      const { stdout } = await exec(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
      return JSON.parse(stdout).namedFields as Record<string, string>;
    };
    const named = await inspect();
    expect(named).toMatchObject({
      "topmostSubform[0].Page1[0].SecA_Patient[0].ReportDate[0]": "20-SEP-2026",
      "topmostSubform[0].Page1[0].SecA_Patient[0].EventDate[0]": "03-SEP-2026",
      [`${first}Dose[0]`]: "500", [`${first}DoseUnit[0]`]: "25",
      [`${first}Strength[0]`]: "250", [`${first}StrengthUnit[0]`]: "25",
      [`${second}Dose[0]`]: "10", [`${second}DoseUnit[0]`]: "30",
      [`${second}Strength[0]`]: "250 mg/5 mL", [`${second}StrengthUnit[0]`]: "40",
    });
    delete projection.sections.D.suspectProducts[0].strength;
    projection.sections.D.suspectProducts[1].dose = "two capsules (500 mg total)";
    const regenerated = await inspect();
    expect(regenerated[`${first}Strength[0]`]).toBeUndefined();
    expect(regenerated[`${second}Dose[0]`]).toBe("two capsules (500 mg total)");
    expect(regenerated[`${second}DoseUnit[0]`]).toBe("40");
    expect(regenerated["topmostSubform[0].Page1[0].SecA_Patient[0].ReportDate[0]"]).toBe("20-SEP-2026");
  });
});
