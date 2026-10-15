import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { identifierOpening, identifierCorrection } from "../fixtures/medication-model";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { productCapacityCase } from "../fixtures/product-capacity";
import { seedStoredState, acceptOpeningGroups, goTo, savePdf, serverAction, storedState } from "./draft4-helpers";
const key = (n: number) => `topmostSubform[0].Page${n + 3}[0].Prod${n}[0].Prod${n}NDC_ID[0]`;
test("conversational product identifier: explicit review, correction, direct unknown, reload and regenerated two-slot PDFs", async ({ page }, info) => {
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
  await page.goto("/"); await page.getByLabel("Case description", { exact: true }).fill(identifierOpening);
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await expect(page.locator('[data-field="ndcOrUniqueId"]').first()).toContainText("00123");
  expect((await storedState(page)).case.products[0].facts.ndcOrUniqueId.resolvedValue).toBeUndefined();
  await acceptOpeningGroups(page);
  await goTo(page, "Reporter details"); await serverAction(page, () => page.getByRole("button", { name: "Prefer not to provide reporter details" }).click());
  await reload(); const first = await pdf("identifier-opening.pdf");
  expect(first[key(1)]).toBe("00123-0045-06"); expect(first[key(2)]).toBe("00045-0067-08");
  await goTo(page, "Review details"); await page.getByLabel("Clinical update", { exact: true }).fill(identifierCorrection);
  await serverAction(page, () => page.getByRole("button", { name: "Prepare changes for review", exact: true }).click());
  const pending = await storedState(page);
  expect(pending.case.products[1].facts.ndcOrUniqueId.resolvedValue?.value).toEqual({ kind: "known", value: "00045-0067-08" });
  await serverAction(page, () => page.getByRole("button", { name: "Accept these changes", exact: true }).click());
  await reload(); const corrected = await pdf("identifier-corrected.pdf");
  expect(corrected[key(2)]).toBe("00045-0067-09");
  const withoutSecondIdentifier = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([k]) => k !== key(2)));
  expect(withoutSecondIdentifier(corrected)).toEqual(withoutSecondIdentifier(first));
  const c = (await storedState(page)).case;
  expect(c.products).toHaveLength(2); expect(c.products[1].facts.ndcOrUniqueId.supersededValues.some(v => v.value.kind === "known" && v.value.value === "00045-0067-08")).toBe(true);
  await goTo(page, "Review details");
  const row = page.locator('[data-field="ndcOrUniqueId"]').nth(1);
  await row.getByRole("button", { name: "Change", exact: true }).click();
  await row.getByRole("button", { name: "Add uncertainty or context", exact: true }).click();
  await row.getByLabel("Uncertainty or context for NDC number or Unique ID", { exact: true }).fill("label partly obscured; clinician wording retained");
  await serverAction(page, () => row.getByRole("button", { name: "Apply correction", exact: true }).click());
  await reload(); const qualified = await pdf("identifier-qualified.pdf"); expect(qualified).toEqual(corrected);
  const coverage = page.locator('[data-screen="save"] details').filter({ has: page.getByText("Report coverage and omitted information", { exact: true }) });
  if (await coverage.getAttribute("open") === null) await coverage.locator("summary").click();
  await expect(coverage.getByText("label partly obscured; clinician wording retained", { exact: false })).toBeVisible();
  await goTo(page, "Review details");
  await row.getByRole("button", { name: "Change", exact: true }).click();
  await row.getByLabel("NDC number or Unique ID status", { exact: true }).selectOption("unknown");
  await serverAction(page, () => row.getByRole("button", { name: "Apply correction", exact: true }).click());
  await reload(); const unknown = await pdf("identifier-unknown.pdf");
  expect(unknown[key(1)]).toBe("00123-0045-06"); expect(unknown[key(2)] ?? "").toBe("");
  expect((await storedState(page)).case.products[1].facts.ndcOrUniqueId.resolvedValue?.value).toEqual({ kind: "unknown" });
  expect((await storedState(page)).case.products[1].facts.ndcOrUniqueId.supersededValues.some(v => v.value.kind === "known" && v.value.qualifier === "label partly obscured; clinician wording retained")).toBe(true);
  // A role correction must retain the identifier without putting it into Section F.
  for (const role of ["concomitant", "suspect"]) {
    await goTo(page, "Review details"); const roleRow = page.locator('[data-field="role"]').first();
    await roleRow.getByRole("button", { name: "Change", exact: true }).click();
    await roleRow.getByLabel("New Role", { exact: true }).selectOption(role);
    await serverAction(page, () => roleRow.getByRole("button", { name: "Apply correction", exact: true }).click());
    await reload(); const fields = await pdf(`identifier-role-${role}.pdf`);
    expect(fields[key(1)] ?? "").toBe(role === "suspect" ? "00123-0045-06" : "");
    expect((await storedState(page)).case.products[0].facts.ndcOrUniqueId.resolvedValue?.value).toEqual({ kind: "known", value: "00123-0045-06" });
    if (role === "concomitant") await expect(page.locator('[data-screen="save"]')).toContainText("NDC number or Unique ID remains in reviewed knowledge but is not included in Section F");
  }
  expect(interpret).toBe(2);
});

test("genuine v10 native workspace retains an unfinished dose edit, then accepts and recovers an identifier PDF limit", async ({ page }, info) => {
  let unexpected = 0;
  await page.route("**/api/case", async route => {
    const b = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || b?.operation === "resume" || b?.action?.action === "set-fact") await route.continue();
    else { unexpected++; await route.abort(); }
  });
  const saved = () => expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
  await page.goto("/");
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: productCapacityCase(), unrepresented: [] });
  await page.reload(); await saved(); await goTo(page, "Review details");
  const dose = page.locator('[data-field="dose"]').first();
  await dose.getByRole("button", { name: "Change", exact: true }).click();
  await dose.getByLabel("New Dose", { exact: true }).fill("Retained 00 dose words"); await saved();
  const before = await storedState(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => { const r = indexedDB.open("wilson-browser-persistence",1); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
    try { await new Promise<void>((resolve,reject) => { const tx=db.transaction("active-case","readwrite"),store=tx.objectStore("active-case"),get=store.get("active"); get.onsuccess=()=>{ const r=get.result; r.payload.state.version="wilson-browser-state-v10"; for (const p of r.payload.state.case.products) delete p.facts.ndcOrUniqueId; r.payload.drafts.data.provenance.stateVersion="wilson-browser-state-v10";
      // A draft saved before this field existed has no identifier fingerprint.
      for (const record of Object.values(r.payload.drafts.data.ui.records) as Array<{ kind: string; data: { factVersions?: Record<string, string> } }>) {
        if (record.kind === "card" && record.data.factVersions) delete record.data.factVersions.ndcOrUniqueId;
      }
      store.put(r,"active"); }; tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error); }); } finally { db.close(); }
  });
  await page.reload(); await saved(); await goTo(page, "Review details");
  await expect(dose.getByLabel("New Dose", { exact: true })).toHaveValue("Retained 00 dose words");
  const restored = await storedState(page); expect(restored.version).toBe(browserStateVersion); expect(restored.case).toEqual(before.case);
  await dose.getByRole("button", { name: "Cancel", exact: true }).click();
  const card = page.locator('article').filter({ has: page.locator('[data-field="dose"]') }).first();
  await card.getByRole("button", { name: "Show more fields", exact: true }).click();
  const row = card.locator('[data-field="ndcOrUniqueId"]');
  await row.getByRole("button", { name: "Add", exact: true }).click();
  await row.getByLabel("New NDC number or Unique ID", { exact: true }).fill("β-00");
  await serverAction(page, () => row.getByRole("button", { name: "Add fact", exact: true }).click());
  await goTo(page, "Review & save"); await expect(page.getByRole("link", { name: "Save PDF", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-screen="save"]')).toContainText("NDC number or Unique ID contains characters");
  await saved(); await page.reload(); await saved(); await goTo(page, "Review details");
  await row.getByRole("button", { name: "Change", exact: true }).click();
  await row.getByLabel("New NDC number or Unique ID", { exact: true }).fill(" 00-A/07 ");
  await serverAction(page, () => row.getByRole("button", { name: "Apply correction", exact: true }).click());
  await saved(); await page.reload(); await saved();
  const download = await savePdf(page), path = info.outputPath("v10-identifier-recovered.pdf"); await download.saveAs(path);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  expect(JSON.parse(stdout).namedFields[key(1)]).toBe(" 00-A/07 ");
  expect((await storedState(page)).case.products[0].facts.ndcOrUniqueId.supersededValues.some(v => v.value.kind === "known" && v.value.value === "β-00")).toBe(true);
  expect(unexpected).toBe(0);
});
