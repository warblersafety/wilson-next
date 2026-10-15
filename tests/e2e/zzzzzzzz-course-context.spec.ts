import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { courseContext, courseContextCase } from "../fixtures/b5-course-context";
import { appliedCaseResponse, goTo, seedStoredState, storedState, savePdf } from "./draft4-helpers";
const narrative = "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]";
test("clinical-course context reaches the PDF and survives explicit correction/removal and reload without reordering facts", async ({ page }, info) => {
  let unexpected = 0;
  await page.route("**/api/case", async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || body?.operation === "resume" || body?.action?.action === "set-fact") await route.continue();
    else { unexpected++; await route.abort(); }
  });
  await page.goto("/"); await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: courseContextCase(), unrepresented: [] });
  await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  const initial = await storedState(page);
  async function readPdf(name: string) {
    const download = await savePdf(page), path = info.outputPath(name); await download.saveAs(path);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
    return JSON.parse(stdout).namedFields as Record<string, string>;
  }
  const first = await readPdf("course.pdf");
  for (const text of Object.values(courseContext)) expect(first[narrative]).toContain(text);
  expect(first[narrative]).toContain(`Treatment: oral fluids reported first; second treatment reported later (${courseContext.treatments}).`);
  expect(first[narrative]).toContain(`Discharged 21-Aug-2026 (${courseContext.dischargeDate}).`);
  const output = page.locator('[data-screen="save"]');
  for (const label of ["Treatment", "Outcome", "Discharged"]) await expect(output).not.toContainText(`${label}: base value included; reviewed uncertainty or context not included`);
  for (const [field, qualifier] of [["outcome", "later telephone account; exact timing unconfirmed"], ["treatments", ""]]) {
    await goTo(page, "Review details");
    const row = page.locator(`#case-card-event [data-field="${field}"]`);
    await row.getByRole("button", { name: "Change", exact: true }).click();
    await row.getByLabel(/^Uncertainty or context for /).fill(qualifier);
    const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === "set-fact");
    await row.getByRole("button", { name: "Apply correction", exact: true }).click(); await appliedCaseResponse(page, await response);
    await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
    await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  }
  const saved = await storedState(page), corrected = await readPdf("course-corrected.pdf");
  expect(corrected[narrative]).toContain("Outcome: improved but not back to baseline (later telephone account; exact timing unconfirmed).");
  expect(corrected[narrative]).toContain("Treatment: oral fluids reported first; second treatment reported later.");
  expect(corrected[narrative]).not.toContain(courseContext.outcome); expect(corrected[narrative]).not.toContain(courseContext.treatments);
  expect(corrected[narrative]).toContain(courseContext.dischargeDate);
  for (const key of Object.keys(first).filter(key => key !== narrative)) expect(corrected[key]).toEqual(first[key]);
  expect(saved.case.products).toEqual(initial.case.products); expect(saved.case.relevantTests).toEqual(initial.case.relevantTests);
  expect(saved.case.event.facts.dischargeDate).toEqual(initial.case.event.facts.dischargeDate);
  expect(saved.case.event.facts.treatments.resolvedValue?.value).toEqual({ kind: "known", value: ["oral fluids reported first", "second treatment reported later"] });
  expect(saved.case.event.facts.outcome.supersededValues.some(value => value.value.kind === "known" && value.value.qualifier === courseContext.outcome)).toBe(true);
  expect(unexpected).toBe(0);
});
