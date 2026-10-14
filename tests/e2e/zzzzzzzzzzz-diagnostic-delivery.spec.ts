import { expect, test } from "@playwright/test";
import { productCapacityCase } from "../fixtures/product-capacity";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { goTo, storedState } from "./draft4-helpers";

for (const mode of ["held", "offline"] as const) {
  test(`useful case/PDF work and failure recovery continue with ${mode} diagnostics`, async ({ page }) => {
    const captured: Array<{ event: { phase: string; request?: { body?: unknown } }; trace: unknown[] }> = [];
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/diagnostics/browser", async route => {
      captured.push(route.request().postDataJSON());
      if (mode === "offline") return route.abort();
      await gate;
      try { await route.fulfill({ status: 204 }); } catch { /* The resource deadline may already have aborted it. */ }
    });
    const current = productCapacityCase();
    const state = { version: browserStateVersion, stage: "output" as const, case: current, unrepresented: [] };
    const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
    let openings = 0, updates = 0;
    await page.route("**/api/case", async route => {
      const action = route.request().postDataJSON()?.action;
      if (action?.action === "submit-opening") {
        openings++;
        return route.fulfill(openings === 1 ? { status: 422, json: { error: "Synthetic opening failure" } } : { json: { state, snapshot } });
      }
      if (action?.action === "submit-update") {
        updates++;
        return route.fulfill(updates === 1 ? { status: 422, json: { error: "Synthetic update failure" } } : { json: { state, snapshot } });
      }
      return route.continue();
    });
    try {
      await page.goto("/");
      const opening = page.getByLabel("Case description", { exact: true });
      await expect(opening).toBeVisible({ timeout: 2_000 });
      await opening.fill("Fictional transport-only opening.");
      const open = page.getByRole("button", { name: "Review Wilson’s understanding", exact: true });
      await open.click();
      await expect(page.locator("main").getByRole("alert")).toContainText("Synthetic opening failure", { timeout: 2_000 });
      await expect(opening).toHaveValue("Fictional transport-only opening.");
      await open.click();
      await expect(page.getByRole("heading", { name: "Review the case details", exact: true })).toBeVisible({ timeout: 2_000 });
      const accepted = await storedState(page);
      const update = page.getByLabel("Clinical update", { exact: true });
      await update.fill("Fictional transport-only update.");
      const submit = page.getByRole("button", { name: "Prepare changes for review", exact: true });
      await submit.click();
      await expect(page.locator("main").getByRole("alert")).toContainText("Synthetic update failure", { timeout: 2_000 });
      await expect(update).toHaveValue("Fictional transport-only update.");
      expect(await storedState(page)).toEqual(accepted);
      await submit.click();
      await expect(update).toHaveValue("", { timeout: 2_000 });
      await page.route("**/api/case/pdf", route => route.fulfill({ status: 422, json: { error: "Synthetic PDF failure" } }), { times: 1 });
      await goTo(page, "Review & save");
      await expect(page.locator("main").getByRole("alert")).toContainText("Synthetic PDF failure", { timeout: 2_000 });
      expect(await storedState(page)).toEqual(accepted);
      await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
      await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toBeVisible();
      expect(await storedState(page)).toEqual(accepted);
      expect(openings).toBe(2);
      expect(updates).toBe(2);
      expect(captured.some(report => report.event.phase === "response-received" && report.trace.length === 2)).toBe(true);
      const requests = JSON.stringify(captured.flatMap(report => report.event.request ? [report.event.request] : []));
      expect(requests).not.toContain("Fictional transport-only");
      expect(requests).toContain("[BROWSER STATE NOT LOGGED]");
      expect(pageErrors).toEqual([]);
    } finally { release(); }
  });
}
