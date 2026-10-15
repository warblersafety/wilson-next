import { expect, test } from "@playwright/test";
import { flowAlignmentState } from "../fixtures/flow-alignment";
import { seedStoredState, storedState } from "./draft4-helpers";

test("named serial-test headings and actions survive review/reload without changing observations", async ({ page }) => {
  const pending = await flowAlignmentState();
  await page.goto("/");
  await seedStoredState(page, pending); await page.reload();
  const first = page.locator("#case-card-test-1"), second = page.locator("#case-card-test-2");
  const labels = ["Hemoglobin — 11-Sep-2026 (test 1)", "Hemoglobin — 12-Sep-2026 (test 2)"];
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

test("an accepted unnamed observation keeps its fallback until the name/date update is reviewed", async ({ page }) => {
  const { reviewedLaboratoryCase } = await import("../fixtures/laboratory-case");
  const { applyCaseCommand } = await import("../../src/domain/case/commands");
  const { browserStateVersion } = await import("../../src/server/case/browser-state");
  const baseline = reviewedLaboratoryCase([{ testResult: "9.1 g/dL" }], "A fictional unnamed test result was 9.1 g/dL.");
  const id = baseline.relevantTests[0].id;
  const text = "The test was hemoglobin, collected on 11 September 2026.";
  const source = { id: "label-source", inputId: "label-input", inputType: "correction" as const, actor: "clinician" as const, excerpt: text, start: 0, end: text.length, recordedAt: "2026-09-20T12:01:00.000Z" };
  const pending = applyCaseCommand(baseline, { type: "attach-grounded-proposals", commandId: "label-update", expectedRevision: baseline.revision, products: [], sources: [source], proposals: [
    { proposalId: "label-name", groupId: "label-repair", intent: "fact", target: { entity: "test", entityId: id, field: "testName" }, value: { kind: "known", value: "hemoglobin" }, sourceIds: [source.id] },
    { proposalId: "label-date", groupId: "label-repair", intent: "fact", target: { entity: "test", entityId: id, field: "date" }, value: { kind: "known", value: "2026-09-11" }, sourceIds: [source.id] },
  ] }).case;
  await page.goto("/"); await seedStoredState(page, { version: browserStateVersion, stage: "review-update", case: pending, unrepresented: [] }); await page.reload();
  const card = page.locator("#case-card-test-1");
  await expect(card.getByRole("heading", { name: "Relevant test 1", exact: true })).toBeVisible();
  await expect(card.getByRole("status")).toContainText("Test identity is not recorded as known");
  await expect(card.getByRole("heading", { name: /hemoglobin/ })).toHaveCount(0);
  expect((await storedState(page)).case.relevantTests[0].facts.testName.resolvedValue).toBeUndefined();
  await page.getByRole("button", { name: "Accept these changes", exact: true }).click();
  await expect(card.getByRole("heading", { name: "hemoglobin — 11-Sep-2026 (test 1)", exact: true })).toBeVisible();
  await expect(card.getByRole("status")).toHaveCount(0);
  expect((await storedState(page)).case.relevantTests[0].id).toBe(id);
  await page.reload();
  await expect(card.getByRole("heading", { name: "hemoglobin — 11-Sep-2026 (test 1)", exact: true })).toBeVisible();
});
