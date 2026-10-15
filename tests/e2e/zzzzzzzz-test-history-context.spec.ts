import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { testHistoryContextCase, historyWording, historyContext, labHistoryContext } from "../fixtures/test-history-context";
import { goTo, seedStoredState, storedState, savePdf } from "./draft4-helpers";
const comments = "topmostSubform[0].Page3[0].AdditionalComments[0]", history = "topmostSubform[0].Page3[0].Sec6Data[0].OtherHistory[0]";
async function seed(page: Page) {
  let unexpected = 0;
  await page.route("**/api/case", async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || body?.operation === "resume" || body?.action?.action === "set-fact") await route.continue();
    else { unexpected++; await route.abort(); }
  });
  await page.goto("/"); await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: testHistoryContextCase(), unrepresented: [] });
  await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  return () => expect(unexpected).toBe(0);
}
async function readPdf(page: Page, path: string) {
  const download = await savePdf(page); await download.saveAs(path);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  return JSON.parse(stdout).namedFields as Record<string,string>;
}
async function historyQualifier(page: Page, text: string) {
  await goTo(page, "Review details");
  const row = page.locator('#case-card-event [data-field="relevantHistory"]');
  await row.getByRole("button", { name: "Change", exact: true }).click();
  await row.getByLabel(/^Uncertainty or context for /).fill(text);
  const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === "set-fact");
  await row.getByRole("button", { name: "Apply correction", exact: true }).click(); expect((await response).ok()).toBe(true);
  // Response headers can arrive before the body is applied. An old Saved label
  // is not evidence that this correction reached browser state or durable storage.
  await expect.poll(async () => (await storedState(page)).case.event.facts.relevantHistory.resolvedValue?.value)
    .toEqual({ kind: "known", value: historyWording, ...(text ? { qualifier: text } : {}) });
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
}
test("B6 row/field context and B7 history survive exact correction/removal and reload without changing serial results or dates", async ({ page }, info) => {
  const noInterpretation = await seed(page), before = await storedState(page);
  const first = await readPdf(page, info.outputPath("test-history.pdf"));
  expect(first[comments]).toContain(`B6 table row 1 - Result and stated units context: ${labHistoryContext.testResult}`);
  expect(first[comments]).toContain(`B6 table row 2 - Result and stated units context: second report: ${labHistoryContext.testResult}`);
  expect(first[history]).toBe(`${historyWording}\nHistory context: ${historyContext}`);
  for (const context of ["later recollection; exact dates still uncertain", ""]) {
    await historyQualifier(page, context); await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
    const fields = await readPdf(page, info.outputPath(context ? "history-corrected.pdf" : "history-context-removed.pdf"));
    expect(fields[history]).toBe(context ? `${historyWording}\nHistory context: ${context}` : historyWording);
    for (const key of Object.keys(first).filter(key => key !== history)) expect(fields[key]).toEqual(first[key]);
  }
  const saved = await storedState(page);
  expect(saved.case.relevantTests).toEqual(before.case.relevantTests); expect(saved.case.products).toEqual(before.case.products);
  expect(saved.case.event.facts.relevantHistory.supersededValues.some(value => value.value.kind === "known" && value.value.qualifier === historyContext)).toBe(true);
  noInterpretation();
});
test("unrepresentable accepted B7 context blocks fresh output and remains retained after reload", async ({ page }, info) => {
  let requests = 0; page.on("request", request => { if (request.url().endsWith("/api/case/pdf") && request.method() === "POST") requests++; });
  const noInterpretation = await seed(page); await readPdf(page, info.outputPath("prior-supported.pdf"));
  const before = requests;
  await historyQualifier(page, "β uncertainty retained verbatim"); await goTo(page, "Review & save");
  await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-screen="save"]')).toContainText("The reviewed B7 history contains characters");
  expect(requests).toBe(before);
  await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled(); await goTo(page, "Review & save");
  await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toHaveCount(0);
  expect((await storedState(page)).case.event.facts.relevantHistory.resolvedValue?.value).toEqual({ kind: "known", value: historyWording, qualifier: "β uncertainty retained verbatim" });
  expect(requests).toBe(before); noInterpretation();
});
