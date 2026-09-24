import { expect, test } from "@playwright/test";
import { createAnthropicJourneyModel } from "../../src/server/model/anthropic-journey";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { performJourneyAction } from "../../src/server/journey/service";
import protocol from "../../evidence/issue-94/live-protocol.json" with { type: "json" };
import tablets from "../../evidence/issue-94/retained-tablets-model.json" with { type: "json" };
import count from "../../evidence/issue-94/count-without-total-model.json" with { type: "json" };
import { acceptOpeningGroups, goTo, storedState } from "./draft4-helpers";

async function pending(output: unknown, id: string) {
  const repository = new InMemoryCaseRepository();
  const caseId = "case-11111111-1111-4111-8111-111111111194";
  const model = createAnthropicJourneyModel(async () => ({ id: "retained-first-pass", model: "deterministic-replay", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(output) }], usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null } }));
  const snapshot = await performJourneyAction(repository, caseId, { action: "submit-opening", text: protocol.cases.find(c => c.id === id)!.text, reportType: "adverse-event" }, model);
  return { version: browserStateVersion, stage: snapshot.stage, case: (await repository.load(caseId))!, unrepresented: snapshot.unrepresented };
}

test("retained symptom/dose proposals have separate acceptance and visible uncertainty", async ({ page }, info) => {
  let interpretationRequests = 0;
  await page.route("**/api/case", async route => {
    if (route.request().method() === "POST" && ["submit-opening", "submit-update"].includes(route.request().postDataJSON()?.action?.action)) {
      interpretationRequests++; await route.abort();
    } else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await page.evaluate(state => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), await pending(tablets, "retained-tablets"));
  await page.reload(); await goTo(page, "Review details");
  await expect(page.locator("dd").filter({ hasText: "two tablets, a total dose of 500 mg" })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^abdominal pain/ })).toBeVisible();
  await expect(page.locator("dt").filter({ hasText: /^Product problem$/ })).toHaveCount(0);
  const eventButton = page.getByRole("button", { name: "Accept event details", exact: true });
  await eventButton.click(); await expect(eventButton).toHaveCount(0);
  const eventAccepted = await storedState(page);
  expect(eventAccepted.case.event.facts.symptoms.resolvedValue?.value).toEqual({ kind: "known", value: ["abdominal pain"] });
  expect(eventAccepted.case.products[0].facts.dose.resolvedValue).toBeUndefined();
  expect(eventAccepted.case.products[0].facts.dose.proposedValues).toHaveLength(1);
  await goTo(page, "Review & save");
  await expect(page.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();

  await page.evaluate(state => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), await pending(count, "count-without-total"));
  await page.reload(); await goTo(page, "Review details");
  const qualified = "prickly skin and no rash (patient is unsure whether the prickly feeling was a reaction to the medicine)";
  await expect(page.locator("dd").filter({ hasText: qualified })).toBeVisible();
  await page.screenshot({ path: info.outputPath("visible-symptom-uncertainty.png"), fullPage: true });
  await page.getByRole("button", { name: "Accept event details", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept event details", exact: true })).toHaveCount(0);
  await expect(page.locator("dd").filter({ hasText: qualified })).toBeVisible();
  expect((await storedState(page)).case.event.facts.symptoms.resolvedValue?.value).toEqual({ kind: "known", value: ["prickly skin", "no rash"], qualifier: "patient is unsure whether the prickly feeling was a reaction to the medicine" });
  await acceptOpeningGroups(page);
  // A value-only correction preserves uncertainty; removing it is explicit.
  const symptomRow = page.locator("dt").filter({ hasText: /^Symptoms$/ }).locator("..");
  await symptomRow.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByLabel("New Symptoms", { exact: true }).fill("prickly forearm skin\nno rash");
  await expect(page.getByLabel("Uncertainty or context for Symptoms", { exact: true })).toHaveValue("patient is unsure whether the prickly feeling was a reaction to the medicine");
  await page.getByRole("button", { name: "Apply correction", exact: true }).click();
  await expect(symptomRow.locator("dd").first()).toContainText("prickly forearm skin and no rash (patient is unsure");
  await symptomRow.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByLabel("Uncertainty or context for Symptoms", { exact: true }).fill("");
  await expect(page.getByLabel("Uncertainty or context for Symptoms", { exact: true })).toBeVisible();
  await page.getByLabel("Uncertainty or context for Symptoms", { exact: true }).pressSequentially("patient remains unsure");
  await page.getByRole("button", { name: "Apply correction", exact: true }).click();
  await expect(symptomRow.locator("dd").first()).toContainText("(patient remains unsure)");
  await symptomRow.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByLabel("Uncertainty or context for Symptoms", { exact: true }).fill("");
  await page.getByRole("button", { name: "Apply correction", exact: true }).click();
  await expect(symptomRow.locator("dd").first()).toHaveText("prickly forearm skin and no rash");
  expect((await storedState(page)).case.event.facts.symptoms.resolvedValue?.value).toEqual({ kind: "known", value: ["prickly forearm skin", "no rash"] });
  expect((await storedState(page)).case.event.facts.symptoms.supersededValues.some(v => v.value.kind === "known" && v.value.qualifier)).toBe(true);
  expect(interpretationRequests).toBe(0);
});
