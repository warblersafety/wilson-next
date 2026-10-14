import { expect, test } from "@playwright/test";

test("resume refreshes a saved stage, explains the transition and preserves the case", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  const original = await page.evaluate(() => {
    const state = JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!);
    sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify({ ...state, stage: "output" }));
    return state;
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
