import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { serialTestCase, serialCorrectionText, mixedSerialText, firstSerialTestId, secondSerialTestId } from "../fixtures/serial-test-correction";
import { seedStoredState, storedState, serverAction, savePdf } from "./draft4-helpers";

async function begin(page: import("@playwright/test").Page) {
  const baseline = await serialTestCase(); await page.goto("/");
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: baseline, unrepresented: [] }); await page.reload();
  await expect(page.locator("#case-card-test-2").getByRole("heading", { name: "hemoglobin — 12-Sep-2026 (test 2)", exact: true })).toBeVisible();
  return baseline;
}
async function pdfFields(page: import("@playwright/test").Page, path: string) {
  await (await savePdf(page)).saveAs(path);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  return JSON.parse(stdout).namedFields;
}
const prefix = "topmostSubform[0].Page3[0].TestDataTable[0]";

test("a serial correction changes only the dated observation after review, survives reload and reaches the actual PDF", async ({ page }, info) => {
  const baseline = await begin(page); let calls = 0;
  page.on("request", r => { if (r.method() === "POST" && r.url().endsWith("/api/case") && r.postDataJSON()?.action?.action === "submit-update") calls++; });
  await page.getByLabel("Clinical update", { exact: true }).fill(serialCorrectionText);
  await serverAction(page, () => page.getByRole("button", { name: "Prepare changes for review", exact: true }).click());
  const pending = (await storedState(page)).case;
  expect(pending.relevantTests).toHaveLength(2);
  expect(pending.relevantTests[0]).toEqual(baseline.relevantTests[0]);
  expect(pending.relevantTests[1].facts.testResult.resolvedValue).toEqual(baseline.relevantTests[1].facts.testResult.resolvedValue);
  await serverAction(page, () => page.getByRole("button", { name: "Accept these changes", exact: true }).click());
  const accepted = (await storedState(page)).case;
  expect(accepted.relevantTests.map(t => t.id)).toEqual([firstSerialTestId, secondSerialTestId]);
  expect(accepted.relevantTests[0]).toEqual(baseline.relevantTests[0]);
  expect(accepted.relevantTests[1].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "9.6 g/dL" });
  for (const field of ["testName", "date", "lowRange", "highRange"] as const) expect(accepted.relevantTests[1].facts[field]).toEqual(baseline.relevantTests[1].facts[field]);
  await page.reload(); expect((await storedState(page)).case.relevantTests).toEqual(accepted.relevantTests);
  const fields = await pdfFields(page, info.outputPath("corrected-serial.pdf"));
  expect(fields[`${prefix}.Row1[0].TestData1[0]`]).toBe("hemoglobin: 8.9 g/dL");
  expect(fields[`${prefix}.Row2[0].TestData2[0]`]).toBe("hemoglobin: 9.6 g/dL");
  expect(fields[`${prefix}.Row2[0].TDate2[0]`]).toBe("12-SEP-2026"); expect(calls).toBe(1);
});

test("a mixed correction and genuinely new observation remain independently reviewable", async ({ page }, info) => {
  const baseline = await begin(page);
  await page.getByLabel("Clinical update", { exact: true }).fill(mixedSerialText);
  await serverAction(page, () => page.getByRole("button", { name: "Prepare changes for review", exact: true }).click());
  expect((await storedState(page)).case.relevantTests).toHaveLength(3);
  const third = page.locator("#case-card-test-3"), label = "platelet count — 13-Sep-2026 (test 3)";
  await expect(third.getByRole("button", { name: `Accept ${label}`, exact: true })).toBeDisabled();
  await serverAction(page, () => page.getByRole("button", { name: "Accept these changes", exact: true }).click());
  expect((await storedState(page)).case.relevantTests[2].state).toBe("proposed");
  await serverAction(page, () => third.getByRole("button", { name: `Accept ${label}`, exact: true }).click());
  const current = (await storedState(page)).case;
  expect(current.relevantTests[0]).toEqual(baseline.relevantTests[0]);
  expect(current.relevantTests[1].id).toBe(secondSerialTestId);
  expect(current.relevantTests[2].state).toBe("resolved");
  const fields = await pdfFields(page, info.outputPath("mixed-serial.pdf"));
  expect(fields[`${prefix}.Row2[0].TestData2[0]`]).toBe("hemoglobin: 9.6 g/dL");
  expect(fields[`${prefix}.Row3[0].TestData3[0]`]).toBe("platelet count: 120 x10^9/L");
});

test("a malformed correction reference cannot create a third observation or consume the retained draft", async ({ page }) => {
  const baseline = await begin(page); let calls = 0;
  page.on("request", r => { if (r.method() === "POST" && r.url().endsWith("/api/case") && r.postDataJSON()?.action?.action === "submit-update") calls++; });
  await page.getByLabel("Clinical update", { exact: true }).fill(serialCorrectionText);
  const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === "submit-update");
  await page.getByRole("button", { name: "Prepare changes for review", exact: true }).click();
  expect((await response).ok()).toBe(false);
  await expect(page.locator("main").getByRole("alert")).toContainText("retained");
  await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue(serialCorrectionText);
  expect((await storedState(page)).case.relevantTests).toEqual(baseline.relevantTests); expect(calls).toBe(1);
});
