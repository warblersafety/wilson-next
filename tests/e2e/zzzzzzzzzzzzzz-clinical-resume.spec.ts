import { expect, test } from "@playwright/test";

test("resume refreshes a saved stage, explains the transition and preserves the case", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  const original = await page.evaluate(() => {
    const state = JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!);
    // The durable record is changed below; the session mirror is no longer authority.
    return state;
  });
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("wilson-browser-persistence", 1); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction("active-case", "readwrite"), table = tx.objectStore("active-case"), r = table.get("active"); r.onsuccess = () => { const record = r.result; record.payload.state.stage = "output"; record.generation = crypto.randomUUID(); table.put(record, "active"); }; tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
  });
  const actions: string[] = [];
  page.on("request", request => {
    if (request.url().endsWith("/api/case") && request.method() === "POST") actions.push(request.postDataJSON().operation);
  });
  await page.reload();
  await expect(page.getByText("Your case was restored. Review the current case details before continuing.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  const restored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!));
  expect(restored).toEqual(original);
  expect(actions).toEqual(["resume"]);
});
