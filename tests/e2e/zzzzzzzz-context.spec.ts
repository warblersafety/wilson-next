import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { assayContext, contextCase, conflictedContextCase, setContextFact } from "../fixtures/reviewed-context";
import { goTo, seedStoredState, storedState, savePdf } from "./draft4-helpers";
const narrative = "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]";

async function seed(page: Page, current: ReturnType<typeof contextCase>) {
  let unexpected = 0;
  await page.route("**/api/case", async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || body?.operation === "resume" || ["set-fact", "resolve-conflict"].includes(body?.action?.action)) await route.continue();
    else { unexpected++; await route.abort(); }
  });
  await page.goto("/"); await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: current, unrepresented: [] });
  await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  return () => expect(unexpected).toBe(0);
}
async function pdf(page: Page, file: string) {
  const download = await savePdf(page); await download.saveAs(file);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
  const output = JSON.parse(stdout); expect(output.pageCount).toBe(8); return output.namedFields as Record<string, string>;
}
async function apply(page: Page, click: () => Promise<unknown>, action = "set-fact") {
  const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === action);
  await click(); expect((await response).ok()).toBe(true);
}
async function saved(page: Page) { await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser"); }

test("context: add, restore draft, accept, replace, remove and re-add qualifier with exact omission and unchanged PDF", async ({ page }, info) => {
  let requests = 0; page.on("request", r => { if (r.url().endsWith("/api/case/pdf") && r.method() === "POST") requests++; });
  const noInterpretation = await seed(page, contextCase());
  const baseline = await storedState(page), original = await pdf(page, info.outputPath("plain.pdf"));
  await goTo(page, "Review details");
  const row = page.locator('#case-card-test-1 [data-field="testResult"]');
  await row.getByRole("button", { name: "Change", exact: true }).click();
  await row.getByRole("button", { name: "Add uncertainty or context", exact: true }).click();
  const input = row.getByLabel("Uncertainty or context for Result and stated units", { exact: true });
  await input.fill(assayContext); await saved(page);
  expect((await storedState(page)).case.relevantTests[0].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "14.2" });
  await page.reload(); await expect(input).toHaveValue(assayContext);
  await goTo(page, "Review & save"); await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toBeVisible();
  const beforeApply = requests;
  await goTo(page, "Review details");
  await apply(page, () => row.getByRole("button", { name: "Apply correction", exact: true }).click());
  await expect(row.getByRole("button", { name: "Change", exact: true })).toBeVisible();
  const accepted = await storedState(page);
  expect(accepted.case.relevantTests[0].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "14.2", qualifier: assayContext });
  expect(accepted.case.products).toEqual(baseline.case.products); expect(accepted.case.event).toEqual(baseline.case.event);
  expect(accepted.case.relevantTests[0].facts.date).toEqual(baseline.case.relevantTests[0].facts.date);
  await goTo(page, "Review & save");
  const output = page.locator('[data-screen="save"]'), coverage = output.locator("details").filter({ has: page.getByText("Report coverage and omitted information", { exact: true }) });
  await expect(coverage).toHaveAttribute("open", "");
  await expect(coverage).toContainText("Fictional assay"); await expect(coverage).toContainText("Result and stated units: base value included; reviewed uncertainty or context not included");
  await expect(coverage).toContainText(assayContext);
  await expect(output).toContainText("PDF ready — supported values are included; some reviewed context is omitted.");
  expect(requests).toBe(beforeApply); // No new PDF for a metadata-only qualification.
  expect(await pdf(page, info.outputPath("qualified.pdf"))).toEqual(original);
  await page.setViewportSize({ width: 390, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("omitted-context-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const qualifier of ["first result remains uncertain", "", "explicitly supplied again"]) {
    await goTo(page, "Review details"); await row.getByRole("button", { name: "Change", exact: true }).click();
    if (!await input.isVisible()) await row.getByRole("button", { name: "Add uncertainty or context", exact: true }).click();
    await input.fill(qualifier);
    await apply(page, () => row.getByRole("button", { name: "Apply correction", exact: true }).click());
    await expect(row.getByRole("button", { name: "Change", exact: true })).toBeVisible();
    await goTo(page, "Review & save");
    if (qualifier) await expect(coverage).toContainText(qualifier);
    else await expect(output).not.toContainText("Some reviewed uncertainty or context is not included");
    expect(await pdf(page, info.outputPath(`context-${qualifier ? qualifier.split(" ")[0] : "removed"}.pdf`))).toEqual(original);
  }
  const current = await storedState(page);
  expect(current.case.relevantTests[0].facts.testResult.supersededValues.some(v => v.value.kind === "known" && v.value.qualifier === assayContext)).toBe(true);
  await saved(page); await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  await goTo(page, "Review & save"); await expect(coverage).toContainText("explicitly supplied again");
  noInterpretation();
});

test("context: unresolved narrative omission, explicit chosen alternative, retained rejected context and actual PDF", async ({ page }, info) => {
  const noInterpretation = await seed(page, conflictedContextCase());
  const baseline = await storedState(page);
  const before = await pdf(page, info.outputPath("conflicted.pdf")); expect(before[narrative]).not.toContain("Outcome:");
  const output = page.locator('[data-screen="save"]');
  await output.getByText("Report coverage and omitted information", { exact: true }).click();
  await expect(output).toContainText("Outcome: unresolved conflict");
  await goTo(page, "Review details");
  await apply(page, () => page.getByRole("button", { name: "Use partially improved (chart A uncertain)", exact: true }).click(), "resolve-conflict");
  const current = await storedState(page);
  expect(current.case.event.facts.outcome.resolvedValue?.value).toEqual({ kind: "known", value: "partially improved", qualifier: "chart A uncertain" });
  expect(current.case.event.facts.outcome.supersededValues.some(v => v.value.kind === "known" && v.value.qualifier === "chart B follow-up incomplete")).toBe(true);
  expect(current.case.products).toEqual(baseline.case.products); expect(current.case.relevantTests).toEqual(baseline.case.relevantTests);
  const after = await pdf(page, info.outputPath("resolved.pdf")); expect(after[narrative]).toContain("Outcome: partially improved (chart A uncertain).");
  await expect(output).not.toContainText("Outcome: base value included; reviewed uncertainty or context not included");
  const coverage = output.locator("details").filter({ has: page.getByText("Report coverage and omitted information", { exact: true }) });
  await expect(coverage).not.toContainText("chart A uncertain"); await expect(coverage).not.toContainText("chart B follow-up incomplete");
  await saved(page); await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  expect((await storedState(page)).case).toEqual(current.case);
  noInterpretation();
});

test("context: indirect restart/routing qualifiers remain visible without claiming their base values are native fields", async ({ page }, info) => {
  const wording = "pharmacy refill suggests possible resumption, unconfirmed";
  const current = setContextFact(contextCase(), "product:product-apixaban:restarted", { kind: "known", value: false, qualifier: wording });
  const noInterpretation = await seed(page, current);
  const named = await pdf(page, info.outputPath("restart-context.pdf"));
  expect(named["topmostSubform[0].Page4[0].Prod1[0].Prod1ReappearNA[0]"]).toBe("/1");
  const output = page.locator('[data-screen="save"]');
  const coverage = output.locator("details").filter({ has: page.getByText("Report coverage and omitted information", { exact: true }) });
  await expect(coverage).toContainText("Restarted: reviewed uncertainty or context not included");
  await expect(coverage).toContainText(wording);
  await expect(coverage).not.toContainText("Restarted: base value included");
  await expect(output).not.toContainText("PDF ready — it reflects the accepted report contents.");
  await goTo(page, "Review details");
  const role = page.locator('#case-card-product-1 [data-field="role"]');
  await role.getByRole("button", { name: "Change", exact: true }).click();
  await role.getByRole("button", { name: "Add uncertainty or context", exact: true }).click();
  await role.getByLabel("Uncertainty or context for Role", { exact: true }).fill("classification supplied, not independently inferred");
  await apply(page, () => role.getByRole("button", { name: "Apply correction", exact: true }).click());
  await expect(role.getByRole("button", { name: "Change", exact: true })).toBeVisible();
  await goTo(page, "Review & save"); await expect(coverage).toContainText("Role: reviewed uncertainty or context not included");
  await expect(coverage).toContainText("classification supplied, not independently inferred");
  const after = await pdf(page, info.outputPath("routing-context.pdf")); expect(after).toEqual(named);
  await saved(page); await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  await goTo(page, "Review & save"); await expect(coverage).toContainText(wording);
  await expect(coverage).toContainText("classification supplied, not independently inferred");
  noInterpretation();
});
