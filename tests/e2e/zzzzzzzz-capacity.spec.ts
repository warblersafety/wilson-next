import { seedStoredState } from "./draft4-helpers";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { capacityProductIds, capacityProductNames, correctCapacityProduct, productCapacityCase } from "../fixtures/product-capacity";
import { goTo, savePdf, storedState } from "./draft4-helpers";

for (const scenario of [
  { name: "three suspect products", index: 2, excessRole: "suspect", supportedRole: "concomitant", limit: "at most 2 suspect medicines or other non-device products" },
  { name: "two concomitant products", index: 1, excessRole: "concomitant", supportedRole: "suspect", limit: "at most 1 concomitant product" },
] as const) {
  test(`capacity: ${scenario.name} stays visible and recovers through explicit correction`, async ({ page }, info) => {
    let pdfRequests = 0, interpretations = 0;
    page.on("request", request => { if (request.url().endsWith("/api/case/pdf") && request.method() === "POST") pdfRequests++; });
    await page.route("**/api/case", async route => {
      if (["submit-opening", "submit-update"].includes(route.request().postDataJSON()?.action?.action)) {
        interpretations++; await route.abort();
      } else await route.continue();
    });
    const current = correctCapacityProduct(productCapacityCase(), scenario.index, { role: { kind: "known", value: scenario.excessRole } });
    const state = { version: browserStateVersion, stage: "output" as const, case: current, unrepresented: [] };
    await page.goto("/");
    await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
    await seedStoredState(page, state);
    await page.reload();
    await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
    const before = await storedState(page);
    const details = page.locator('[data-screen="details"]');
    await expect(details).toContainText("This case exceeds the preview’s PDF capacity.");
    await expect(details).not.toContainText("Your accepted details will be used in the report.");
    const output = page.locator('[data-screen="save"]');
    await goTo(page, "Review & save");
    await expect(output.getByRole("heading", { name: "This case exceeds the preview’s PDF capacity", exact: true })).toBeVisible();
    await expect(output).toContainText(scenario.limit);
    await expect(output).toContainText("are retained");
    await expect(output.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
    expect(pdfRequests).toBe(0);
    expect(await storedState(page)).toEqual(before);
    await page.setViewportSize({ width: 390, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });

    const setRole = async (role: "suspect" | "concomitant") => {
      await goTo(page, "Review details");
      const row = page.locator(`#case-card-product-${scenario.index + 1} [data-field="role"]`);
      await row.getByRole("button", { name: "Change", exact: true }).click();
      await row.getByLabel("New Role", { exact: true }).selectOption(role);
      const response = page.waitForResponse(value => value.url().endsWith("/api/case") && value.request().postDataJSON()?.action?.action === "set-fact");
      await row.getByRole("button", { name: "Apply correction", exact: true }).click();
      expect((await response).ok()).toBe(true);
      await expect(row.getByRole("button", { name: "Change", exact: true })).toBeVisible();
    };
    await setRole(scenario.supportedRole);
    const supported = await storedState(page);
    expect(supported.case.products.map(({ id }) => id)).toEqual([...capacityProductIds]);
    for (let i = 0; i < 3; i++) {
      if (i !== scenario.index) expect(supported.case.products[i]).toEqual(before.case.products[i]);
      expect(supported.case.products[i].facts.name).toEqual(before.case.products[i].facts.name);
      expect(supported.case.products[i].facts.dose).toEqual(before.case.products[i].facts.dose);
    }
    const download = await savePdf(page), file = info.outputPath("supported.pdf");
    await download.saveAs(file);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
    const named = JSON.parse(stdout).namedFields;
    expect(named["topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]"]).toBe(capacityProductNames[0]);
    expect(named["topmostSubform[0].Page5[0].Prod2[0].Prod2Name[0]"]).toBe(capacityProductNames[1]);
    expect(named["topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Prod1[0]"]).toBe(capacityProductNames[2]);
    const values = Object.values(named);
    for (const name of capacityProductNames) expect(values).toContain(name);
    expect((JSON.parse(stdout)).pageCount).toBe(8);
    const savedCount = pdfRequests;

    await setRole(scenario.excessRole);
    await expect(details).toContainText("The earlier PDF is not current.");
    await expect(details).not.toContainText("New work needs review before a current PDF is ready.");
    await expect(details).not.toContainText("Your accepted details will be used in the report.");
    await goTo(page, "Review & save");
    await expect(output.getByRole("heading", { name: "This case exceeds the preview’s PDF capacity", exact: true })).toBeVisible();
    await expect(output.getByRole("button", { name: "Generate updated PDF", exact: true })).toBeDisabled();
    await expect(output.getByRole("link", { name: "Save PDF", exact: true })).toHaveCount(0);
    await expect(output).toContainText("Earlier PDF");
    expect(pdfRequests).toBe(savedCount);
    expect((await storedState(page)).case.products).toHaveLength(3);
    await setRole(scenario.supportedRole);
    await goTo(page, "Review & save");
    await expect(output.getByRole("link", { name: "Save PDF", exact: true })).toBeVisible();
    expect(interpretations).toBe(0);
  });
}
