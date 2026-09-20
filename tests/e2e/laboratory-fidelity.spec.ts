import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { completeResolvedCase } from "../domain/fixture";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { journeyResponse } from "../../src/server/case/browser-state";
import { laboratoryOpening } from "../fixtures/laboratory-case";
import { laboratoryRepairOpening } from "../fixtures/laboratory-fidelity";

// Supply the actual historical extraction failure at the server's typed
// boundary; repair and download use the running application and real API.
test("repairs missing laboratory identity, corrects one result, and downloads faithful separate PDF rows", async ({ page }, testInfo) => {
  const prior = structuredClone(completeResolvedCase());
  prior.id = "case-00000000-0000-4000-8000-000000000091";
  const envelope = laboratoryOpening([
    { testResult: "9.1 g/dL", lowRange: "12", highRange: "16", date: "2026-09-11" },
    { testResult: "positive for occult blood", date: "2026-09-11" },
  ], laboratoryRepairOpening);
  const state = applyCaseCommand(prior, { type: "attach-grounded-proposals", commandId: "demo24-extraction", expectedRevision: prior.revision, ...envelope }).case;
  const repository = new InMemoryCaseRepository({ initialCase: state });
  const response = await journeyResponse(repository, await getJourneySnapshot(repository, state.id));
  await page.addInitScript((state) => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), response.state);
  await page.goto("/");
  const first = page.locator("#case-card-test-2");
  const second = page.locator("#case-card-test-3");
  await expect(first.getByRole("status")).toContainText("Test identity is not recorded as known");
  await expect(second.getByRole("status")).toContainText("accept the understanding");
  await expect(first).toContainText("Her hemoglobin was 9.1 g/dL");
  await page.getByRole("button", { name: "Accept all remaining proposals and continue" }).click();
  await expect(page.getByRole("button", { name: "Download official PDF" })).toBeEnabled();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("Test identity not recorded: 9.1 g/dL");
  for (const [card, name] of [[first, "hemoglobin"], [second, "stool test"]] as const) {
    const row = card.locator("dl > div").filter({ has: page.getByText("Test identity", { exact: true }) });
    await row.getByRole("button", { name: "Add", exact: true }).click();
    await row.getByLabel("New Test identity", { exact: true }).fill(name);
    await row.getByRole("button", { name: "Add fact", exact: true }).click();
    await expect(card.getByRole("status")).toHaveCount(0);
  }
  const resultRow = first.locator("dl > div").filter({ has: page.getByText("Result and stated units", { exact: true }) });
  await resultRow.getByRole("button", { name: "Change", exact: true }).click();
  await resultRow.getByLabel("New Result and stated units", { exact: true }).fill("8.9 g/dL");
  await resultRow.getByRole("button", { name: "Apply correction", exact: true }).click();
  await expect(first).toContainText("Earlier: 9.1 g/dL");
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("hemoglobin: 8.9 g/dL");
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("stool test: positive for occult blood");
  const accepted = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!).case);
  expect(accepted.relevantTests.slice(1).map((test: { id: string }) => test.id)).toEqual(["test-t0", "test-t1"]);
  expect(accepted.relevantTests[1].facts.date.resolvedValue.value).toEqual({ kind: "known", value: "2026-09-11" });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download official PDF" }).click();
  const path = testInfo.outputPath("laboratory-correction.pdf");
  await (await downloaded).saveAs(path);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  const fields = JSON.parse(stdout).namedFields;
  const prefix = "topmostSubform[0].Page3[0].TestDataTable[0]";
  expect(fields).toMatchObject({
    [`${prefix}.Row2[0].TestData2[0]`]: "hemoglobin: 8.9 g/dL",
    [`${prefix}.Row2[0].TLowRange2[0]`]: "12", [`${prefix}.Row2[0].THighRange2[0]`]: "16", [`${prefix}.Row2[0].TDate2[0]`]: "11-SEP-2026",
    [`${prefix}.Row3[0].TestData3[0]`]: "stool test: positive for occult blood", [`${prefix}.Row8[0].TDate3[0]`]: "11-SEP-2026",
  });
});
