import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { medicationSparseOpening, medicationSparseUpdate, medicationTwoOpening, medicationNeverRestarted, medicationRestartedAgain } from "../fixtures/medication-model";

test("medication history: conversational grouped answer and two-product corrections reach faithful downloaded PDFs", async ({ page }, testInfo) => {
  const first = "topmostSubform[0].Page4[0].Prod1[0].Prod1";
  const second = "topmostSubform[0].Page5[0].Prod2[0].Prod2";
  const checked = (fields: Record<string, string>, key: string) => Boolean(fields[key] && fields[key] !== "/Off");
  const pdf = async (name: string) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download official PDF", exact: true }).click();
    const path = testInfo.outputPath(name);
    await (await download).saveAs(path);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
    return JSON.parse(stdout).namedFields as Record<string, string>;
  };
  await page.goto("/");
  await opening(page, medicationSparseOpening);
  await expect(page.getByRole("heading", { name: "Treatment history for amoxicillin" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("medication-question.png"), fullPage: true });
  const sparseDraft = await page.evaluate(() => sessionStorage.getItem("wilson-journey-state-v2")!);
  await update(page, medicationSparseUpdate);
  await reporter(page);
  let fields = await pdf("medication-sparse.pdf");
  expect(fields[`${first}TherapyStopDate[0]`]).toBe("18-SEP-2026");
  expect(checked(fields, `${first}AbatedYes[0]`)).toBe(true);
  expect(checked(fields, `${first}ReappearNA[0]`)).toBe(true);
  expect(checked(fields, `${first}ReappearNo[0]`)).toBe(false);
  const sparse = await state(page);
  expect(sparse.askedNeeds.filter((need: { key: string }) => need.key === "medication-history")).toHaveLength(1);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await opening(page, medicationTwoOpening);
  await reporter(page);
  fields = await pdf("medication-two-before.pdf");
  expect(checked(fields, `${first}ReappearYes[0]`)).toBe(true);
  expect(checked(fields, `${second}AbatedNo[0]`)).toBe(true);
  expect(checked(fields, `${second}Generic[0]`)).toBe(true);
  expect(checked(fields, `${second}OTC[0]`)).toBe(true);
  expect((await state(page)).askedNeeds.filter((need: { key: string }) => need.key === "medication-history")).toHaveLength(0);
  await update(page, medicationNeverRestarted);
  fields = await pdf("medication-two-never-restarted.pdf");
  expect(checked(fields, `${first}ReappearYes[0]`)).toBe(false);
  expect(checked(fields, `${first}ReappearNA[0]`)).toBe(true);
  const corrected = await state(page);
  expect(corrected.products[0].facts.recurred.resolvedValue).toBeUndefined();
  expect(corrected.products[0].facts.recurred.supersededValues[0].value.value).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("medication-correction.png"), fullPage: true });
  await update(page, medicationRestartedAgain);
  await expect(page.getByRole("heading", { name: "Treatment history for amoxicillin" })).toBeVisible();
  await expect(page.getByLabel("Did the event return after restarting it?", { exact: true })).toBeVisible();
  expect((await state(page)).products[0].facts.recurred.resolvedValue).toBeUndefined();
  await page.getByLabel("Did the event return after restarting it?", { exact: true }).selectOption("false");
  await page.getByRole("button", { name: "Add medication answers", exact: true }).click();
  fields = await pdf("medication-two-final.pdf");
  expect(checked(fields, `${first}ReappearNo[0]`)).toBe(true);
  expect(checked(fields, `${first}ReappearYes[0]`)).toBe(false);
  expect(checked(fields, `${second}ReappearNA[0]`)).toBe(true);
  expect(checked(fields, `${second}AbatedNo[0]`)).toBe(true);

  // Remaining-unknown preserves a clinician's already selected answer and
  // answers newly revealed conditional fields in this one task (no model call).
  await page.evaluate((draft) => sessionStorage.setItem("wilson-journey-state-v2", draft), sparseDraft);
  await page.reload();
  await page.getByLabel("Was this medication stopped?", { exact: true }).selectOption("true");
  await page.getByRole("button", { name: "These remaining details are unknown", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  const answered = await state(page);
  expect(answered.products[0].facts.stopped.resolvedValue.value).toEqual({ kind: "known", value: true });
  expect(answered.products[0].facts.stopDate.resolvedValue.value).toEqual({ kind: "unknown" });
  expect(answered.products[0].facts.improvedAfterChange.resolvedValue.value).toEqual({ kind: "unknown" });
  expect(answered.products[0].facts.restarted.resolvedValue.value).toEqual({ kind: "unknown" });
});

async function opening(page: Page, text: string) {
  await page.getByLabel("Clinical account", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await page.getByRole("button", { name: "Accept all remaining proposals and continue" }).click();
}
async function update(page: Page, text: string) {
  await page.getByLabel("Clinical update", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Review this update", exact: true }).click();
  await page.getByRole("button", { name: "Accept this update", exact: true }).click();
}
async function reporter(page: Page) {
  await page.getByLabel("Date of this report", { exact: true }).fill("2026-09-21");
  await page.getByRole("button", { name: "Prefer not to provide reporter details" }).click();
}
async function state(page: Page) { return page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!).case); }
