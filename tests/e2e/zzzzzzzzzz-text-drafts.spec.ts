import { seedStoredState } from "./draft4-helpers";
import { expect, test } from "@playwright/test";
import { productCapacityCase } from "../fixtures/product-capacity";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { storedState } from "./draft4-helpers";

test("top-level opening and no-selection drafts survive cancelled/failed reset; successful reset restores defaults", async ({ page }) => {
  await page.goto("/");
  const opening = page.getByLabel("Case description", { exact: true });
  await opening.fill("  Unsubmitted fictional account.  ");
  await page.getByLabel("Adverse event", { exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "Review Wilson’s understanding", exact: true })).toBeDisabled();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await expect(opening).toHaveValue("  Unsubmitted fictional account.  ");
  await page.route("**/api/case", route => route.fulfill({ status: 503, json: { error: "Synthetic reset failure" } }), { times: 1 });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Synthetic reset failure");
  await expect(opening).toHaveValue("  Unsubmitted fictional account.  ");
  await expect(page.getByLabel("Adverse event", { exact: true })).not.toBeChecked();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await expect(opening).toHaveValue("");
  await expect(page.getByLabel("Adverse event", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Product problem", { exact: true })).not.toBeChecked();
});

test("update failure retains text and success acknowledges only the submitted draft", async ({ page }) => {
  const current = productCapacityCase();
  const state = { version: browserStateVersion, stage: "output" as const, case: current, unrepresented: [] };
  const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
  await page.goto("/");
  await page.getByLabel("Case description", { exact: true }).waitFor();
  await seedStoredState(page, state);
  await page.reload();
  const update = page.getByLabel("Clinical update", { exact: true });
  const submit = page.getByRole("button", { name: "Prepare changes for review", exact: true });
  await update.fill("  First unsent update.  ");
  let requests = 0;
  await page.route("**/api/case", async route => {
    if (route.request().postDataJSON()?.action?.action !== "submit-update") return route.continue();
    requests++;
    await route.fulfill({ status: 422, json: { error: "Synthetic update failure" } });
  }, { times: 1 });
  await submit.click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Synthetic update failure");
  await expect(update).toHaveValue("  First unsent update.  ");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  // A valid unchanged response isolates transport acknowledgement from model behavior.
  await page.route("**/api/case", async route => {
    requests++;
    expect(route.request().postDataJSON().action.text).toBe("  First unsent update.  ");
    await gate;
    await route.fulfill({ json: { state, snapshot, provenance: { stateVersion: browserStateVersion, release: null } } });
  }, { times: 1 });
  await submit.click();
  await expect(page.getByRole("button", { name: "Preparing update…", exact: true })).toBeDisabled();
  await update.fill("Later typing while pending");
  release();
  await expect(submit).toBeEnabled();
  await expect(update).toHaveValue("Later typing while pending");
  await page.route("**/api/case", async route => {
    requests++;
    await route.fulfill({ json: { state, snapshot, provenance: { stateVersion: browserStateVersion, release: null } } });
  }, { times: 1 });
  await submit.click();
  await expect(update).toHaveValue("");
  expect(requests).toBe(3);
  expect(await storedState(page)).toEqual(state);
});
