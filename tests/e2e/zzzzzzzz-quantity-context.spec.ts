import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { setContextFact } from "../fixtures/reviewed-context";
import { productCapacityCase, correctCapacityProduct } from "../fixtures/product-capacity";
import { appliedCaseResponse, goTo, seedStoredState, storedState, savePdf } from "./draft4-helpers";
const narrative = "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]";
test("qualified quantities survive reload and correction with actual native units and exact B5 context", async ({ page }, info) => {
  let unexpected = 0;
  await page.route("**/api/case", async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || body?.operation === "resume" || body?.action?.action === "set-fact") await route.continue();
    else { unexpected++; await route.abort(); }
  });
  const current = correctCapacityProduct(productCapacityCase(), 0, { strength: { kind: "known", value: "5 mg", qualifier: "reported, uncertain" }, dose: { kind: "known", value: "500 mg", qualifier: "approximate" } });
  await page.goto("/"); await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: current, unrepresented: [] });
  await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  for (const qualifier of ["reported, uncertain", "confirmed label"]) {
    await goTo(page, "Review & save");
    const download = await savePdf(page), path = info.outputPath(qualifier === "confirmed label" ? "corrected.pdf" : "qualified.pdf");
    await download.saveAs(path);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
    const fields = JSON.parse(stdout).namedFields;
    expect(fields[narrative]).toContain(`Suspect product #1 strength: 5 mg (${qualifier}).`);
    expect(fields[narrative]).toContain("Suspect product #1 dose: 500 mg (approximate).");
    expect(fields["topmostSubform[0].Page4[0].Prod1[0].Prod1Strength[0]"]).toBe("5 (see B5)");
    expect(fields["topmostSubform[0].Page4[0].Prod1[0].Prod1StrengthUnit[0]"]).toBe("25");
    if (qualifier === "confirmed label") { expect(fields[narrative]).not.toContain("reported, uncertain"); break; }
    await goTo(page, "Review details");
    const row = page.locator('#case-card-product-1 [data-field="strength"]');
    await row.getByRole("button", { name: "Change", exact: true }).click();
    await row.getByLabel("Uncertainty or context for Product strength", { exact: true }).fill("confirmed label");
    const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === "set-fact");
    await row.getByRole("button", { name: "Apply correction", exact: true }).click(); await appliedCaseResponse(page, await response);
    await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
    const saved = await storedState(page);
    expect(saved.case.products[0].facts.strength.resolvedValue?.value).toEqual({ kind: "known", value: "5 mg", qualifier: "confirmed label" });
    await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  }
  expect(unexpected).toBe(0);
});

test("a base B5 glyph failure remains attributed and blocked after a valid quantity qualifier is removed", async ({ page }) => {
  let pdfRequests = 0, unexpected = 0;
  page.on("request", request => { if (request.url().endsWith("/api/case/pdf") && request.method() === "POST") pdfRequests++; });
  await page.route("**/api/case", async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || body?.operation === "resume" || body?.action?.action === "set-fact") await route.continue();
    else { unexpected++; await route.abort(); }
  });
  const current = setContextFact(correctCapacityProduct(productCapacityCase(), 0, { dose: { kind: "known", value: "500 mg", qualifier: "approximate" } }), "event:event:symptoms", { kind: "known", value: ["rash ≥ 5 cm"] });
  await page.goto("/"); await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: current, unrepresented: [] });
  await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  for (const removed of [false, true]) {
    if (removed) {
      await goTo(page, "Review details");
      const row = page.locator('#case-card-product-1 [data-field="dose"]');
      await row.getByRole("button", { name: "Change", exact: true }).click();
      await row.getByLabel(/^Uncertainty or context for /).fill("");
      const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === "set-fact");
      await row.getByRole("button", { name: "Apply correction", exact: true }).click(); await appliedCaseResponse(page, await response);
      expect((await storedState(page)).case.products[0].facts.dose.resolvedValue?.value).toEqual({ kind: "known", value: "500 mg" });
    }
    await goTo(page, "Review & save");
    await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toHaveCount(0);
    await expect(page.locator('[data-screen="save"]')).toContainText("The reviewed B5 event description contains characters");
    const saved = await storedState(page);
    expect(saved.case.event.facts.symptoms.resolvedValue?.value).toEqual({ kind: "known", value: ["rash ≥ 5 cm"] });
  }
  expect(pdfRequests).toBe(0); expect(unexpected).toBe(0);
});
