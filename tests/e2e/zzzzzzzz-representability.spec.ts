import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { correctCapacityProduct, productCapacityCase } from "../fixtures/product-capacity";
import { goTo, savePdf, seedStoredState, storedState } from "./draft4-helpers";

const prefix = ["topmostSubform[0].Page4[0].Prod1[0].Prod1", "topmostSubform[0].Page5[0].Prod2[0].Prod2"];
async function guardAndSeed(page: Page, current: ReturnType<typeof productCapacityCase>) {
  let interpretations = 0;
  await page.route("**/api/case", async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || body?.operation === "resume" || body?.action?.action === "set-fact") await route.continue();
    else { interpretations++; await route.abort(); }
  });
  await page.goto("/");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: current, unrepresented: [] });
  await page.reload();
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  return () => expect(interpretations).toBe(0);
}
async function correct(page: Page, selector: string, label: string, value: string, choice = false) {
  await goTo(page, "Review details");
  const row = page.locator(selector);
  await row.getByRole("button", { name: "Change", exact: true }).click();
  if (choice) await row.getByLabel(label, { exact: true }).selectOption(value);
  else await row.getByLabel(label, { exact: true }).fill(value);
  const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === "set-fact");
  await row.getByRole("button", { name: "Apply correction", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(row.getByRole("button", { name: "Change", exact: true })).toBeVisible();
}
async function readPdf(page: Page, file: string) {
  const download = await savePdf(page); await download.saveAs(file);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
  const result = JSON.parse(stdout); expect(result.pageCount).toBe(8);
  return result.namedFields as Record<string, string>;
}

test("representability: both route slots preserve native and custom corrections through reload and actual PDF", async ({ page }, info) => {
  let current = correctCapacityProduct(productCapacityCase(), 0, { route: { kind: "known", value: "Intramuscular" } });
  current = correctCapacityProduct(current, 1, { route: { kind: "known", value: "custom supplied route" } });
  const noInterpretations = await guardAndSeed(page, current);
  const before = await storedState(page);
  let named = await readPdf(page, info.outputPath("native-and-other.pdf"));
  expect(named[`${prefix[0]}Route[0]`]).toBe("Intramuscular");
  expect(named[`${prefix[1]}Route[0]`]).toBe("Other");
  expect(named[`${prefix[1]}RouteOther[0]`]).toBe("custom supplied route");
  await correct(page, '#case-card-product-1 [data-field="route"]', "New Route", "IV");
  await correct(page, '#case-card-product-2 [data-field="route"]', "New Route", "oral");
  const corrected = await storedState(page);
  expect(corrected.case.products.map(p => p.id)).toEqual(before.case.products.map(p => p.id));
  expect(corrected.case.patient).toEqual(before.case.patient); expect(corrected.case.event).toEqual(before.case.event);
  expect(corrected.case.products[2]).toEqual(before.case.products[2]);
  for (let i = 0; i < 2; i++) {
    const { route: _oldRoute, ...oldFacts } = before.case.products[i].facts;
    const { route: _newRoute, ...newFacts } = corrected.case.products[i].facts;
    expect(newFacts).toEqual(oldFacts);
    expect(corrected.case.products[i].facts.route.supersededValues.map(v => v.value)).toContainEqual(before.case.products[i].facts.route.resolvedValue!.value);
  }
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
  await page.reload();
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  expect((await storedState(page)).case).toEqual(corrected.case);
  named = await readPdf(page, info.outputPath("corrected-after-reload.pdf"));
  expect(named[`${prefix[0]}Route[0]`]).toBe("Other"); expect(named[`${prefix[0]}RouteOther[0]`]).toBe("IV");
  expect(named[`${prefix[1]}Route[0]`]).toBe("Oral"); expect(named[`${prefix[1]}RouteOther[0]`]).toBeUndefined();
  noInterpretations();
});

test("representability: retained intersex blocks current export honestly and explicit correction restores it", async ({ page }, info) => {
  let requests = 0; page.on("request", r => { if (r.url().endsWith("/api/case/pdf") && r.method() === "POST") requests++; });
  const noInterpretations = await guardAndSeed(page, productCapacityCase());
  await readPdf(page, info.outputPath("earlier.pdf"));
  const baseline = await storedState(page), count = requests;
  await correct(page, '#case-card-patient [data-field="sex"]', "New Sex", "intersex", true);
  const changed = await storedState(page);
  expect(changed.case.products).toEqual(baseline.case.products); expect(changed.case.event).toEqual(baseline.case.event);
  expect(changed.case.patient.facts.sex.resolvedValue?.value).toEqual({ kind: "known", value: "intersex" });
  const details = page.locator('[data-screen="details"]');
  await expect(details).toContainText("The earlier PDF is not current.");
  await expect(details).not.toContainText("Your accepted details will be used in the report.");
  await goTo(page, "Review & save");
  const output = page.locator('[data-screen="save"]');
  await expect(output.getByRole("heading", { name: "This PDF cannot represent every reviewed value", exact: true })).toBeVisible();
  await expect(output).toContainText("Your reviewed value is retained");
  await expect(output.getByRole("button", { name: "Generate updated PDF", exact: true })).toBeDisabled();
  await expect(output.getByRole("link", { name: "Save PDF", exact: true })).toHaveCount(0);
  expect(requests).toBe(count);
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("representation-limited-mobile.png"), fullPage: true });
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
  await page.reload();
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  expect((await storedState(page)).case).toEqual(changed.case);
  await goTo(page, "Review & save");
  await expect(output.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
  expect(requests).toBe(count);
  // This is an explicit fictional clinician correction, never an inferred substitution.
  await correct(page, '#case-card-patient [data-field="sex"]', "New Sex", "female", true);
  const recovered = await storedState(page);
  expect(recovered.case.patient.facts.sex.supersededValues.map(v => v.value)).toContainEqual({ kind: "known", value: "intersex" });
  expect(recovered.case.products).toEqual(baseline.case.products);
  const named = await readPdf(page, info.outputPath("explicit-correction.pdf"));
  expect(named["topmostSubform[0].Page1[0].SecA_Patient[0].SexF[0]"]).toBe("/1");
  expect(named["topmostSubform[0].Page1[0].SecA_Patient[0].SexM[0]"]).toBe("/Off");
  noInterpretations();
});

test("representability: oversized route/frequency are retained and blocked before clipping, then explicitly corrected", async ({ page }, info) => {
  let requests = 0; page.on("request", r => { if (r.url().endsWith("/api/case/pdf") && r.method() === "POST") requests++; });
  const noInterpretations = await guardAndSeed(page, productCapacityCase());
  const baseline = await storedState(page);
  await readPdf(page, info.outputPath("before-capacity.pdf"));
  for (const [field, label, replacement] of [["route", "New Route", "IV"], ["frequency", "New Frequency", "every second morning"]] as const) {
    const long = `Fictional supplied ${field}: ` + "wide wording ".repeat(15);
    const beforeRequests = requests;
    await correct(page, `#case-card-product-1 [data-field="${field}"]`, label, long);
    const retained = await storedState(page);
    expect(retained.case.products[0].facts[field].resolvedValue?.value).toEqual({ kind: "known", value: long });
    expect(retained.case.products[1]).toEqual(baseline.case.products[1]); expect(retained.case.products[2]).toEqual(baseline.case.products[2]);
    await goTo(page, "Review & save");
    const output = page.locator('[data-screen="save"]');
    await expect(output.getByRole("heading", { name: "This PDF cannot represent every reviewed value", exact: true })).toBeVisible();
    await expect(output).toContainText("does not fit the Other text control at its native font size");
    await expect(output.getByRole("button", { name: "Generate updated PDF", exact: true })).toBeDisabled();
    expect(requests).toBe(beforeRequests);
    await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
    await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
    expect((await storedState(page)).case).toEqual(retained.case);
    await goTo(page, "Review & save");
    await expect(output.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
    expect(requests).toBe(beforeRequests);
    await correct(page, `#case-card-product-1 [data-field="${field}"]`, label, replacement);
    expect((await storedState(page)).case.products[0].facts[field].supersededValues.map(v => v.value)).toContainEqual({ kind: "known", value: long });
    const named = await readPdf(page, info.outputPath(`explicit-${field}.pdf`));
    expect(named[`${prefix[0]}${field === "route" ? "RouteOther" : "FreqOther"}[0]`]).toBe(replacement);
  }
  noInterpretations();
});
