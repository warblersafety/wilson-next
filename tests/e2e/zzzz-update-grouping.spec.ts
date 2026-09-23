import { expect, test } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { groupingAcceptedCase, groupingUpdate } from "../fixtures/grouping-failure";
import { goTo, storedState } from "./draft4-helpers";

test("one unchanged cross-entity response creates separately accepted history, medication and test groups", async ({ page }, info) => {
  const baseline = groupingAcceptedCase();
  let interpretationRequests = 0;
  page.on("request", request => {
    if (request.method() === "POST" && request.url().endsWith("/api/case") && request.postDataJSON()?.action?.action === "submit-update") interpretationRequests++;
  });
  await page.goto("/");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await page.evaluate(state => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), { version: browserStateVersion, stage: "clarify", case: baseline, unrepresented: [] });
  await page.reload();
  await goTo(page, "Review details");
  await page.getByLabel("Clinical update", { exact: true }).fill(groupingUpdate);
  await page.getByRole("button", { name: "Review this update", exact: true }).click();
  const accepts = page.getByRole("button", { name: "Accept this update", exact: true });
  await expect(accepts).toHaveCount(2);
  const pending = await storedState(page);
  expect(pending.case.event.facts.relevantHistory.resolvedValue).toBeUndefined();
  expect(pending.case.products[0].facts.stopped.resolvedValue).toBeUndefined();
  expect(pending.case.products[0].facts.dose).toEqual(baseline.products[0].facts.dose);
  expect(pending.case.relevantTests).toHaveLength(2);
  await expect(page.getByRole("button", { name: "Accept Relevant test 1", exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("separate-update-groups.png"), fullPage: true });
  // Choose medication by its field, independently of presentation order.
  await page.locator("article").filter({ has: page.getByRole("heading", { name: /Stopped/ }) }).getByRole("button", { name: "Accept this update", exact: true }).click();
  await expect(accepts).toHaveCount(1);
  const medicationAccepted = await storedState(page);
  expect(medicationAccepted.case.products[0].facts.stopped.resolvedValue?.value).toEqual({ kind: "known", value: true });
  expect(medicationAccepted.case.event.facts.relevantHistory.resolvedValue).toBeUndefined();
  await accepts.click();
  for (const n of [1, 2]) {
    const button = page.getByRole("button", { name: `Accept Relevant test ${n}`, exact: true });
    await button.click();
    await expect(button).toHaveCount(0);
  }
  const reviewed = await storedState(page);
  expect(reviewed.case.event.facts.relevantHistory.resolvedValue?.value).toEqual({ kind: "explicitly-absent" });
  expect(reviewed.case.relevantTests.every(test => test.state === "resolved")).toBe(true);
  expect(reviewed.case.patient).toEqual(baseline.patient);
  expect(interpretationRequests).toBe(1);
  await goTo(page, "Review & save");
  await expect(page.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
});
