import { expect, test } from "@playwright/test";
import { productCapacityCase } from "../fixtures/product-capacity";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { goTo, storedState } from "./draft4-helpers";

test("submitted input history is separate from unsent drafts and unrelated unfinished edits stay local", async ({ page }, info) => {
  const current = productCapacityCase();
  const state = { version: browserStateVersion, stage: "output" as const, case: current, unrepresented: [] };
  const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
  const submitted = "Fictional submitted account, including an unquoted continuation.";
  let openings = 0, updates = 0;
  await page.route("**/api/case", async route => {
    if (route.request().postDataJSON()?.action?.action === "submit-opening") {
      openings++;
      return route.fulfill({ json: { state, snapshot } });
    }
    if (route.request().postDataJSON()?.action?.action === "submit-update") {
      updates++;
      return route.fulfill({ json: { state, snapshot } });
    }
    return route.continue();
  });
  await page.goto("/");
  await page.getByLabel("Case description", { exact: true }).fill(submitted);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await goTo(page, "Describe");
  await expect(page.getByText(submitted, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Case description", { exact: true })).toHaveCount(0);
  await goTo(page, "Reporter details");
  await page.getByLabel("Reporter email", { exact: true }).fill("unfinished@example.test");
  await page.getByLabel("Date of this report", { exact: true }).fill("");
  await page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true }).check();
  await goTo(page, "Review details");
  const row = page.locator('#case-card-event [data-field="symptoms"]');
  await row.getByRole("button", { name: "Change", exact: true }).click();
  await row.getByLabel("New Symptoms", { exact: true }).fill("Unfinished local symptoms");
  await page.getByLabel("Clinical update", { exact: true }).fill(" Unsent update with spaces ");
  await goTo(page, "Review & save");
  await expect(page.getByText("You have unsaved reporter details.", { exact: false })).toBeVisible();
  await expect(page.getByText("You have an unsent clinical draft", { exact: false })).toBeVisible();
  await goTo(page, "Reporter details");
  await expect(page.getByLabel("Reporter email", { exact: true })).toHaveValue("unfinished@example.test");
  await expect(page.getByLabel("Date of this report", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true })).toBeChecked();
  await goTo(page, "Review details");
  await expect(row.getByLabel("New Symptoms", { exact: true })).toHaveValue("Unfinished local symptoms");
  await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue(" Unsent update with spaces ");
  const submittedUpdate = " Unsent update with spaces ";
  await page.getByRole("button", { name: "Prepare changes for review", exact: true }).click();
  await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue("");
  await page.getByText("Previous clinical updates", { exact: true }).click();
  const history = page.locator("details").filter({ has: page.getByText("Previous clinical updates", { exact: true }) });
  expect(await history.locator("p").last().textContent()).toBe(submittedUpdate);
  await expect(row.getByLabel("New Symptoms", { exact: true })).toHaveValue("Unfinished local symptoms");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`input-history-${width}.png`), fullPage: true });
  }
  expect(await storedState(page)).toEqual(state);
  expect(openings).toBe(1);
  expect(updates).toBe(1);
});
