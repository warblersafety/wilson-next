import { expect, test, type Locator } from "@playwright/test";
import { flowAlignmentState } from "../fixtures/flow-alignment";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction, type JourneyAction } from "../../src/server/journey/service";
import { goTo, storedState } from "./draft4-helpers";

test("field-local editing preserves drafts, accepted information and placement across all shared cards", async ({ page }, info) => {
  const state = await flowAlignmentState();
  const repository = new InMemoryCaseRepository({ initialCase: state.case });
  const noModel = { propose: async (): Promise<never> => { throw new Error("No interpretation in this check"); } };
  const act = (action: JourneyAction) => performJourneyAction(repository, state.case.id, action, noModel);
  let snapshot = await getJourneySnapshot(repository, state.case.id);
  for (const groupId of new Set(snapshot.review.attention.flatMap(item => item.groupId && !snapshot.openingGroups.includes(item.groupId) ? [item.groupId] : []))) {
    snapshot = await act({ action: "review-update-group", groupId, decision: "accept" });
  }
  for (const groupId of snapshot.openingGroups) snapshot = await act({ action: "review-opening-group", groupId, corrections: [] });
  snapshot = await act({ action: "set-fact", target: "patient:patient:ageYears", value: { kind: "known", value: 54, qualifier: "approximately" } });
  const baseline = { ...state, case: (await repository.load(state.case.id))!, stage: snapshot.stage };
  let writes = 0;
  await page.route("**/api/case", async route => {
    if (route.request().postDataJSON()?.operation === "act") writes++;
    await route.continue();
  });
  await page.goto("/");
  await page.getByLabel("Case description", { exact: true }).waitFor();
  await page.evaluate(value => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(value)), baseline);
  await page.reload();
  await goTo(page, "Reporter details");
  await page.getByLabel("Reporter email", { exact: true }).fill("retained@example.test");
  await goTo(page, "Review details");
  await page.getByLabel("Clinical update", { exact: true }).fill("Unsent clinical draft.");
  const patient = page.locator("#case-card-patient");
  const age = patient.locator('[data-field="ageYears"]');
  const sex = patient.locator('[data-field="sex"]');
  await age.getByRole("button", { name: "Change", exact: true }).click();
  await expect(age.getByRole("button", { name: "Apply correction", exact: true })).toBeDisabled();
  await expect(age.getByText(/^Unsaved edit:/)).toHaveCount(0);
  await age.getByLabel("New Age", { exact: true }).fill("55");
  await expect(age.getByLabel("Uncertainty or context for Age", { exact: true })).toHaveValue("approximately");
  await sex.getByRole("button", { name: "Change", exact: true }).click();
  await expect(age.getByText("Unsaved edit: 55 (approximately)", { exact: true })).toBeVisible();
  await expect(sex.getByText(/^Unsaved edit:/)).toHaveCount(0);
  const fieldPosition = () => sex.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const position = await fieldPosition();
    await patient.getByRole("button", { name: "Show more fields", exact: true }).click();
    expect(await fieldPosition()).toEqual(position);
    await expect(sex.getByLabel("New Sex", { exact: true })).toHaveValue("female");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`stable-editor-${width}.png`), fullPage: true });
    await patient.getByRole("button", { name: "Show fewer fields", exact: true }).click();
    expect(await fieldPosition()).toEqual(position);
  }
  await sex.getByLabel("New Sex", { exact: true }).selectOption("intersex");
  await sex.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(sex.getByRole("button", { name: "Change", exact: true })).toBeFocused();
  await age.getByRole("button", { name: "Change", exact: true }).click();
  await expect(age.getByLabel("New Age", { exact: true })).toHaveValue("55");
  await age.getByLabel("New Age", { exact: true }).fill("54");
  await expect(age.getByText(/^Unsaved edit:/)).toHaveCount(0);
  await expect(age.getByRole("button", { name: "Apply correction", exact: true })).toBeDisabled();
  await age.getByLabel("Uncertainty or context for Age", { exact: true }).fill("reported");
  await expect(age.getByRole("button", { name: "Apply correction", exact: true })).toBeEnabled();
  await age.getByRole("button", { name: "Cancel", exact: true }).click();

  // A hidden additional-field draft is retained, and reopening resumes it.
  await patient.getByRole("button", { name: "Show more fields", exact: true }).click();
  const weight = patient.locator('[data-field="weight"]');
  await weight.getByRole("button", { name: "Add", exact: true }).click();
  await expect(weight.getByText(/^Unsaved edit:/)).toHaveCount(0);
  await weight.getByLabel("New Weight", { exact: true }).fill("70");
  await patient.getByRole("button", { name: "Show fewer fields", exact: true }).click();
  await patient.getByRole("button", { name: "Show more fields — unsaved edits retained", exact: true }).click();
  await weight.getByRole("button", { name: "Add", exact: true }).click();
  await expect(weight.getByLabel("New Weight", { exact: true })).toHaveValue("70");

  const draftText = async (card: string, field: string, label: string, value: string): Promise<Locator> => {
    const row = page.locator(`${card} [data-field="${field}"]`);
    await row.getByRole("button", { name: "Change", exact: true }).click();
    await row.getByLabel(`New ${label}`, { exact: true }).fill(value);
    return row;
  };
  const symptoms = await draftText("#case-card-event", "symptoms", "Symptoms", "Retained symptom draft");
  const result = await draftText("#case-card-test-1", "testResult", "Result and stated units", "9.0 g/dL");
  const dose = await draftText("#case-card-product-1", "dose", "Dose", "200 mg");
  await dose.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(result.getByLabel("New Result and stated units", { exact: true })).toHaveValue("9.0 g/dL");
  await expect(symptoms.getByLabel("New Symptoms", { exact: true })).toHaveValue("Retained symptom draft");
  await expect(weight.getByLabel("New Weight", { exact: true })).toHaveValue("70");
  await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue("Unsent clinical draft.");
  await goTo(page, "Reporter details");
  await expect(page.getByLabel("Reporter email", { exact: true })).toHaveValue("retained@example.test");
  await goTo(page, "Review details");
  expect(await storedState(page)).toEqual(baseline);
  expect(writes).toBe(0);

  // Applying just the test correction preserves the other drafts and observation.
  await result.getByRole("button", { name: "Apply correction", exact: true }).click();
  await expect.poll(async () => (await storedState(page)).case.relevantTests[0].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "9.0 g/dL" });
  const saved = await storedState(page);
  expect(saved.case.patient).toEqual(baseline.case.patient);
  expect(saved.case.products).toEqual(baseline.case.products);
  expect(saved.case.relevantTests[1]).toEqual(baseline.case.relevantTests[1]);
  await expect(symptoms.getByLabel("New Symptoms", { exact: true })).toHaveValue("Retained symptom draft");
  await expect(weight.getByLabel("New Weight", { exact: true })).toHaveValue("70");
  await symptoms.getByRole("button", { name: "Cancel", exact: true }).click();
  await weight.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(writes).toBe(1);
});
