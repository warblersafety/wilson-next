import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { medicationSparseOpening } from "../fixtures/medication-model";
import { usabilityUpdate } from "../fixtures/usability-model";
import { acceptOpeningGroups, goTo, savePdf, storedState } from "./draft4-helpers";

// Hold an actual operation until the test releases it; no fabricated progress clock.
async function holdNext(page: Page, path: string, fail = false) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**${path}`, async (route) => {
    await gate;
    if (fail) await route.fulfill({ status: 422, json: { error: "This request could not be completed." } });
    else await route.continue();
  }, { times: 1 });
  return release;
}

test("focused usability: truthful activity, draft demo reporter, review dependencies and regenerated PDFs", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByLabel("Case description", { exact: true }).fill(medicationSparseOpening);
  const blank = await storedState(page);
  const releaseOpening = await holdNext(page, "/api/case", true);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  const openingStatus = page.getByRole("status").filter({ hasText: "Preparing case details for your review…" });
  await expect(openingStatus).toBeVisible();
  await expect(openingStatus).toHaveCount(1);
  await expect(openingStatus).toBeInViewport();
  await expect(page.getByLabel("Adverse event", { exact: true })).toBeDisabled();
  const spinner = openingStatus.locator('[aria-hidden="true"]');
  expect(await spinner.evaluate((el) => getComputedStyle(el).animationName)).not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await spinner.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await page.screenshot({ path: info.outputPath("opening-processing.png"), fullPage: true });
  expect(await storedState(page)).toEqual(blank);
  releaseOpening();
  await expect(page.locator("main").getByRole("alert")).toContainText("Your description is retained");
  expect(await storedState(page)).toEqual(blank);
  await expect(page.getByLabel("Case description", { exact: true })).toHaveValue(medicationSparseOpening);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review the case details", exact: true })).toBeFocused();
  const event = page.locator("#case-card-event");
  await event.getByRole("button", { name: "Show all outcomes", exact: true }).click();
  await expect(event.getByText("Hospitalized", { exact: true })).toBeVisible();
  await expect(event.getByText("Report date", { exact: true })).toHaveCount(0);
  await event.getByRole("button", { name: "Hide individual outcomes", exact: true }).click();
  await expect(event.getByText("Hospitalized", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Continuing does not accept proposed details.", { exact: false })).toBeVisible();
  const proposed = await storedState(page);
  await page.getByRole("button", { name: "Continue to reporter details", exact: true }).click();
  await page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true }).check();
  await page.getByLabel("Manufacturer or compounder", { exact: true }).check();
  await page.getByLabel("Date of this report", { exact: true }).fill("2026-09-22");
  await page.getByLabel("Reporter phone", { exact: true }).fill("202-555-0142");
  await page.getByLabel("Health professional", { exact: true }).selectOption("false");
  await page.getByRole("button", { name: "Use demo reporter details", exact: true }).click();
  for (const [label, value] of [["Reporter first name", "Casey"], ["Reporter last name", "Reed"], ["Reporter email", "casey.reed@example.test"], ["Reporter occupation", "Physician"], ["Health professional", "true"], ["Reporter phone", "202-555-0142"], ["Date of this report", "2026-09-22"]]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  await expect(page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Manufacturer or compounder", { exact: true })).toBeChecked();
  expect(await storedState(page)).toEqual(proposed);
  await expect(page.getByRole("button", { name: "Add reporter details", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Prefer not to provide reporter details", exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Professional details", exact: true })).toBeVisible();
  for (const name of ["Professional details", "Have you also reported this to anyone below?", "Your privacy"]) {
    const panel = await page.getByRole("group", { name, exact: true }).boundingBox();
    const heading = await page.getByRole("heading", { name, exact: true }).boundingBox();
    expect(heading!.y).toBeGreaterThan(panel!.y + 10);
  }
  await page.screenshot({ path: info.outputPath("reporter-pending-desktop.png"), fullPage: true });
  await goTo(page, "Review & save");
  await expect(page.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
  await goTo(page, "Reporter details");
  await page.getByRole("button", { name: "Continue clinical review", exact: true }).click();
  await acceptOpeningGroups(page);
  await goTo(page, "Review details");
  await page.getByLabel("Clinical update", { exact: true }).fill(usabilityUpdate);
  const accepted = await storedState(page);
  const releaseUpdate = await holdNext(page, "/api/case", true);
  await page.getByRole("button", { name: "Review this update", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Preparing your update for review…" })).toBeInViewport();
  releaseUpdate();
  await expect(page.locator("main").getByRole("alert")).toContainText("Accepted details and your draft are retained");
  expect(await storedState(page)).toEqual(accepted);
  await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue(usabilityUpdate);
  await page.getByRole("button", { name: "Review this update", exact: true }).click();
  const test1 = page.locator("#case-card-test-1"), test2 = page.locator("#case-card-test-2");
  await expect(test2).toContainText("Review the proposed updates above first");
  await expect(test2.getByRole("button", { name: "Accept Relevant test 2", exact: true })).toHaveCount(0);
  await test2.getByRole("link", { name: "Go to proposed updates" }).click();
  await expect(page.getByRole("heading", { name: "Review the proposed update", exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath("update-dependencies-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Accept this update", exact: true }).click();
  await expect(test1.getByRole("heading")).toBeFocused();
  await expect(test2).not.toContainText("Review the proposed updates above first");
  await acceptOpeningGroups(page);
  await goTo(page, "Reporter details");
  await expect(page.getByLabel("Reporter email", { exact: true })).toHaveValue("casey.reed@example.test");
  const releasePdf = await holdNext(page, "/api/case/pdf");
  await page.getByRole("button", { name: "Add reporter details", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Preparing the PDF from accepted details…" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toHaveCount(0);
  releasePdf();
  await expect(page.getByRole("status").filter({ hasText: "PDF ready" })).toBeVisible();
  async function readPdf(name: string) {
    const download = await savePdf(page), path = info.outputPath(name);
    await download.saveAs(path);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
    return JSON.parse(stdout).namedFields as Record<string, unknown>;
  }
  const first = await readPdf("demo-reporter.pdf");
  expect(first["topmostSubform[0].Page7[0].SecG_Reporter[0].Email[0]"]).toBe("casey.reed@example.test");
  expect(first["topmostSubform[0].Page7[0].SecG_Reporter[0].IdentityNo[0]"]).toBe("/1");
  const earlierUrl = await page.getByTitle("Generated Form FDA 3500", { exact: true }).getAttribute("src");
  await goTo(page, "Review details");
  const result = test2.locator("dl > div").filter({ has: page.getByText("Result and stated units", { exact: true }) });
  await result.getByRole("button", { name: "Change", exact: true }).click();
  await result.getByLabel("New Result and stated units", { exact: true }).fill("9.6 g/dL");
  await result.getByRole("button", { name: "Apply correction", exact: true }).click();
  await expect(result).toContainText("Earlier: 9.4 g/dL");
  const corrected = await storedState(page);
  const failPdf = await holdNext(page, "/api/case/pdf", true);
  await goTo(page, "Review & save");
  await expect(page.getByRole("status").filter({ hasText: "Updating the PDF from accepted details…" })).toBeVisible();
  await expect(page.getByTitle("Earlier generated Form FDA 3500", { exact: true })).toHaveAttribute("src", earlierUrl!);
  await expect(page.getByRole("button", { name: "Generate updated PDF", exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("pdf-updating-desktop.png") });
  failPdf();
  await expect(page.locator("main").getByRole("alert")).toContainText("earlier PDF below has not been updated");
  await expect(page.getByRole("button", { name: "Generate updated PDF", exact: true })).toBeEnabled();
  expect(await storedState(page)).toEqual(corrected);
  await page.getByRole("button", { name: "Generate updated PDF", exact: true }).click();
  const second = await readPdf("clinical-corrected.pdf");
  const changed = Object.keys(first).filter((key) => first[key] !== second[key]);
  expect(changed).toHaveLength(1);
  expect(second[changed[0]]).toBe("Hemoglobin: 9.6 g/dL");
  await goTo(page, "Reporter details");
  await page.getByLabel("Reporter email", { exact: true }).fill("casey.updated@example.test");
  await page.getByRole("button", { name: "Save reporter details", exact: true }).click();
  const third = await readPdf("reporter-corrected.pdf");
  expect(Object.keys(second).filter((key) => second[key] !== third[key])).toEqual(["topmostSubform[0].Page7[0].SecG_Reporter[0].Email[0]"]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ["Review details", "Reporter details", "Review & save"] as const) {
      await goTo(page, screen);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${screen.replaceAll(/\W+/g, "-")}-${width}.png`), fullPage: true });
    }
  }
});
