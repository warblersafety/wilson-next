import { expect, test } from "@playwright/test";
import { flowAlignmentState } from "../fixtures/flow-alignment";
import { seedStoredState, storedState } from "./draft4-helpers";

test("named serial-test headings and actions survive review/reload without changing observations", async ({ page }) => {
  const pending = await flowAlignmentState();
  await page.goto("/");
  await seedStoredState(page, pending); await page.reload();
  const first = page.locator("#case-card-test-1"), second = page.locator("#case-card-test-2");
  const labels = ["Hemoglobin — 2026-09-11 (test 1)", "Hemoglobin — 2026-09-12 (test 2)"];
  for (const [index, card] of [first, second].entries()) {
    await expect(card.getByRole("heading", { name: labels[index], exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: `Accept ${labels[index]}`, exact: true })).toBeDisabled();
  }
  const updates = page.getByRole("button", { name: "Accept these changes", exact: true });
  await expect(updates).toHaveCount(2);
  await updates.first().click(); await expect(updates).toHaveCount(1);
  await updates.click(); await expect(updates).toHaveCount(0);
  const before = (await storedState(page)).case.relevantTests;
  await first.getByRole("button", { name: `Accept ${labels[0]}`, exact: true }).click();
  await expect(first.getByRole("button", { name: `Accept ${labels[0]}`, exact: true })).toHaveCount(0);
  const one = (await storedState(page)).case.relevantTests;
  expect(one[0].id).toBe(before[0].id); expect(one[0].state).toBe("resolved");
  expect(one[1]).toEqual(before[1]);
  await second.getByRole("button", { name: `Accept ${labels[1]}`, exact: true }).click();
  await expect(second.getByRole("button", { name: `Accept ${labels[1]}`, exact: true })).toHaveCount(0);
  const accepted = (await storedState(page)).case.relevantTests;
  expect(accepted.map(t => t.id)).toEqual(before.map(t => t.id));
  await page.reload();
  for (const label of labels) await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  expect((await storedState(page)).case.relevantTests).toEqual(accepted);
});
