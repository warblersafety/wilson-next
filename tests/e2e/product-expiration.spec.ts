import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { expirationOpening, expirationCorrection } from "../fixtures/medication-model";
import { acceptOpeningGroups, goTo, savePdf, serverAction, storedState } from "./draft4-helpers";
const key = (n: number) => `topmostSubform[0].Page${n + 3}[0].Prod${n}[0].Prod${n}ExpDate[0]`;
test("conversational product expiration: explicit review, correction, direct unknown, reload and regenerated two-slot PDFs", async ({ page }, info) => {
  let interpret = 0;
  page.on("request", r => { const b = r.method() === "POST" && r.url().endsWith("/api/case") ? r.postDataJSON() : undefined; if (["submit-opening", "submit-update"].includes(b?.action?.action)) interpret++; });
  async function pdf(name: string) {
    const download = await savePdf(page), path = info.outputPath(name); await download.saveAs(path);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
    return JSON.parse(stdout).namedFields as Record<string,string>;
  }
  async function reload() {
    await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
    await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  }
  await page.goto("/"); await page.getByLabel("Case description", { exact: true }).fill(expirationOpening);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await expect(page.locator('[data-field="expirationDate"]').first()).toContainText("2028");
  expect((await storedState(page)).case.products[0].facts.expirationDate.resolvedValue).toBeUndefined();
  await acceptOpeningGroups(page);
  await goTo(page, "Reporter details"); await serverAction(page, () => page.getByRole("button", { name: "Prefer not to provide reporter details" }).click());
  await reload(); const first = await pdf("expiration-opening.pdf");
  expect(first[key(1)]).toBe("29-FEB-2028"); expect(first[key(2)]).toBe("31-DEC-2027");
  await goTo(page, "Review details"); await page.getByLabel("Clinical update", { exact: true }).fill(expirationCorrection);
  await serverAction(page, () => page.getByRole("button", { name: "Prepare changes for review", exact: true }).click());
  const pending = await storedState(page);
  expect(pending.case.products[1].facts.expirationDate.resolvedValue?.value).toEqual({ kind: "known", value: "2027-12-31" });
  await serverAction(page, () => page.getByRole("button", { name: "Accept these changes", exact: true }).click());
  await reload(); const corrected = await pdf("expiration-corrected.pdf");
  expect(corrected[key(2)]).toBe("30-NOV-2029");
  const withoutSecondExpiration = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([k]) => k !== key(2)));
  expect(withoutSecondExpiration(corrected)).toEqual(withoutSecondExpiration(first));
  const c = (await storedState(page)).case;
  expect(c.products).toHaveLength(2); expect(c.products[1].facts.expirationDate.supersededValues.some(v => v.value.kind === "known" && v.value.value === "2027-12-31")).toBe(true);
  await goTo(page, "Review details");
  const row = page.locator('[data-field="expirationDate"]').nth(1);
  await row.getByRole("button", { name: "Change", exact: true }).click();
  await row.getByLabel("Expiration date status", { exact: true }).selectOption("unknown");
  await serverAction(page, () => row.getByRole("button", { name: "Apply correction", exact: true }).click());
  await reload(); const unknown = await pdf("expiration-unknown.pdf");
  expect(unknown[key(1)]).toBe("29-FEB-2028"); expect(unknown[key(2)] ?? "").toBe("");
  expect((await storedState(page)).case.products[1].facts.expirationDate.resolvedValue?.value).toEqual({ kind: "unknown" });
  expect(interpret).toBe(2);
});
