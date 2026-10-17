import { expect, type Page, type Response } from "@playwright/test";
import { nextCompletionQuestion } from "../../src/domain/case/completion-policy";
import { projectForm3500 } from "../../src/domain/case/projection";
import { initialUiDrafts } from "../../src/browser/ui-drafts";
import { workspaceInput } from "../../src/browser/workspace-state";
import { parseBrowserJourneyState, type BrowserJourneyState, type JourneyResponse } from "../../src/server/case/browser-state";

export async function storedState(page: Page): Promise<BrowserJourneyState> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-current-case-debug-v1")!));
}
export async function goTo(page: Page, name: "Describe" | "Review details" | "Reporter details" | "Review & save") {
  await page.getByRole("navigation", { name: "Report steps" }).getByRole("button", { name: new RegExp(name.replace("&", "\\&") + "$") }).click();
}
export async function directAnswers(page: Page) {
  await goTo(page, "Review details");
  await expect(page.getByLabel("Clinical update", { exact: true })).toBeVisible();
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
/** Headers acknowledge transport, not that the UI accepted the returned case.
 * Verify the complete returned authority before navigation or save/reload checks. */
export async function appliedCaseResponse(page: Page, response: Response) {
  expect(response.ok()).toBe(true);
  const acknowledged = await response.json() as JourneyResponse;
  await expect.poll(async () => (await storedState(page))?.case).toEqual(acknowledged.state.case);
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
}
export async function serverAction(page: Page, click: () => Promise<unknown>) {
  const response = page.waitForResponse((r) => r.url().endsWith("/api/case") && r.request().method() === "POST");
  await click();
  await appliedCaseResponse(page, await response);
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

/** Synthetic fixture setup writes the durable authority, not the optional old
 * session mirror. Wait for this page's committed work before replacing it. */
export async function seedStoredState(page: Page, candidate: unknown) {
  const state = parseBrowserJourneyState(candidate);
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
  const ui = { ...initialUiDrafts(state.case.id), screen: state.stage === "describe" ? "describe" as const : "details" as const };
  const input = workspaceInput(state, { version: 1, provenance: { stateVersion: state.version, release: null }, ui, retained: [] });
  await page.evaluate(async json => {
    const input = JSON.parse(json);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("wilson-browser-persistence", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("active-case", "readwrite"); tx.objectStore("active-case").put({ version: 1, generation: crypto.randomUUID(), savedAt: new Date().toISOString(), payload: input }, "active"); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); }
    finally { db.close(); }
  }, JSON.stringify(input));
}
