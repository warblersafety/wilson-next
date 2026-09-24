import { acceptOpeningGroups, directAnswers, goTo, projectedText, savePdf, serverAction, showActiveTask, storedState } from "./draft4-helpers";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { sourceReferenceOpening, sourceReferenceUpdate, omittedTestRecovery } from "../fixtures/source-reference-case";

test("corrects DEMO-91 conversationally before initial acceptance, downloads five aligned rows, and recovers an omitted test", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel("Case description", { exact: true }).fill(sourceReferenceOpening);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review the case details" })).toBeVisible();
  await expect(page.locator('[id^="case-card-test-"]')).toHaveCount(5);
  await expect(page.getByText("Some details were left out")).toHaveCount(0);
  await expect(page.locator("#case-card-test-3")).toContainText("don’t have its units");
  await page.screenshot({ path: testInfo.outputPath("initial-review.png"), fullPage: true });
  await page.getByLabel("Clinical update", { exact: true }).fill(sourceReferenceUpdate);
  await serverAction(page, () => page.getByRole("button", { name: "Prepare changes for review", exact: true }).click());
  await expect(page.getByRole("heading", { name: "Review the proposed update" })).toBeVisible();
  const pending = await state(page);
  expect(pending.relevantTests).toHaveLength(5);
  expect(pending.relevantTests[0].facts.testResult.resolvedValue).toBeUndefined();
  await expect(page.getByRole("button", { name: "Accept these changes", exact: true })).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("conversational-review.png"), fullPage: true });
  await page.getByRole("button", { name: "Accept these changes", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Accept these changes", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Review the proposed update", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Review the proposed update", exact: true })).toBeInViewport();
  await serverAction(page, () => page.getByRole("button", { name: "Accept these changes", exact: true }).click());
  await expect(page.getByRole("heading", { name: "Review the case details" })).toBeVisible();
  await expect(page.locator("#case-card-test-1")).toContainText("Earlier: 9.1 g/dL");
  await acceptOpeningGroups(page);
  await complete(page);
  const reviewed = await state(page);
  expect(reviewed.relevantTests.map((test: { id: string }) => test.id)).toEqual(pending.relevantTests.map((test: { id: string }) => test.id));
  expect(reviewed.relevantTests[4].facts.testName.resolvedValue.value.value).toBe("Helicobacter pylori stool antigen");
  expect(reviewed.relevantTests[4].facts.testResult.resolvedValue.value.value).toBe("negative");
  const downloaded = savePdf(page);
  const path = testInfo.outputPath("source-reference-correction.pdf");
  await (await downloaded).saveAs(path);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  const fields = JSON.parse(stdout).namedFields;
  const prefix = "topmostSubform[0].Page3[0].TestDataTable[0]";
  expect(fields).toMatchObject({
    [`${prefix}.Row1[0].TestData1[0]`]: "hemoglobin: 8.9 g/dL",
    [`${prefix}.Row1[0].TLowRange1[0]`]: "12", [`${prefix}.Row1[0].THighRange1[0]`]: "16", [`${prefix}.Row1[0].TDate1[0]`]: "11-SEP-2026",
    [`${prefix}.Row2[0].TestData2[0]`]: "stool occult blood: positive", [`${prefix}.Row2[0].TDate2[0]`]: "11-SEP-2026",
    [`${prefix}.Row3[0].TestData3[0]`]: "platelet count: 82",
    [`${prefix}.Row4[0].TestData4[0]`]: "ferritin: Result not recorded",
    [`${prefix}.Row8[0].TestData8[0]`]: "Helicobacter pylori stool antigen: negative",
  });
  for (const row of [3, 4, 5]) expect(fields[`${prefix}.Row8[0].TDate${row}[0]`]).toBeUndefined();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await page.getByLabel("Case description", { exact: true }).fill(sourceReferenceOpening);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await expect(page.locator('[id^="case-card-test-"]')).toHaveCount(4);
  await expect(page.getByText("Some details were left out")).toBeVisible();
  await page.getByLabel("Clinical update", { exact: true }).fill(omittedTestRecovery);
  await page.getByRole("button", { name: "Prepare changes for review", exact: true }).click();
  await expect(page.locator('[id^="case-card-test-"]')).toHaveCount(5);
  await expect(page.locator("#case-card-test-5")).toContainText("ferritin");
  await expect(page.locator("#case-card-test-5").getByRole("heading")).toBeFocused();
  await expect(page.locator("#case-card-test-5").getByRole("heading")).toBeInViewport();
  await acceptOpeningGroups(page);
  await complete(page);
  expect(await projectedText(page)).toContain("ferritin: Result not recorded");
});

async function state(page: Page) { return page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!).case); }
async function complete(page: Page) {
  await directAnswers(page);
  await serverAction(page, () => page.getByRole("button", { name: "Confirm outcomes" }).click());
  await page.getByLabel("No relevant history to add", { exact: true }).check();
  await serverAction(page, () => page.getByRole("button", { name: "Add this context" }).click());
  await serverAction(page, () => page.getByRole("button", { name: "These remaining details are unknown", exact: true }).click());
  await page.getByLabel("Date of this report", { exact: true }).fill("2026-09-20");
  await serverAction(page, () => page.getByRole("button", { name: "Prefer not to provide reporter details" }).click());
  expect((await storedState(page)).stage).toBe("output");
}
