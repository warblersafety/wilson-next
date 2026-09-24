import { expect, type Page } from "@playwright/test";
import { nextCompletionQuestion } from "../../src/domain/case/completion-policy";
import { projectForm3500 } from "../../src/domain/case/projection";
import type { BrowserJourneyState } from "../../src/server/case/browser-state";

export async function storedState(page: Page): Promise<BrowserJourneyState> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!));
}
export async function goTo(page: Page, name: "Describe" | "Review details" | "Reporter details" | "Review & save") {
  await page.getByRole("navigation", { name: "Report steps" }).getByRole("button", { name: new RegExp(name.replace("&", "\\&") + "$") }).click();
}
export async function directAnswers(page: Page) {
  await goTo(page, "Review details");
  await expect(page.locator("#clinical-question")).toBeVisible();
}
/** Explicit navigation used by older regression paths; navigation is never a case action. */
export async function showActiveTask(page: Page) {
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  const state = await storedState(page);
  if (state.stage === "describe") return;
  const question = nextCompletionQuestion(state.case);
  if (state.stage === "clarify" && question?.kind === "reporter") return goTo(page, "Reporter details");
  await goTo(page, "Review details");
  if (state.stage === "clarify") await directAnswers(page);
}
export async function serverAction(page: Page, click: () => Promise<unknown>) {
  const response = page.waitForResponse((r) => r.url().endsWith("/api/case") && r.request().method() === "POST");
  await click();
  expect((await response).ok()).toBe(true);
  await showActiveTask(page);
}
export async function acceptOpeningGroups(page: Page) {
  await goTo(page, "Review details");
  for (let i = 0; i < 20; i++) {
    const state = await storedState(page);
    if (state.stage !== "understanding") { await showActiveTask(page); return; }
    const button = page.locator('article button').filter({ hasText: /^Accept / }).first();
    await serverAction(page, () => button.click());
  }
  throw new Error("Opening review exceeded available groups");
}
export async function savePdf(page: Page) {
  await goTo(page, "Review & save");
  await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Save PDF", exact: true }).click();
  return download;
}
export async function projectedText(page: Page) {
  return JSON.stringify(projectForm3500((await storedState(page)).case));
}
