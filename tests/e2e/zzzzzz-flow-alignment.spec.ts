import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { flowAlignmentState } from "../fixtures/flow-alignment";
import { goTo, savePdf, storedState } from "./draft4-helpers";
import baselinePdf from "../../evidence/issue-109/pdf-readback.json" with { type: "json" };
import { applyCaseCommand } from "../../src/domain/case/commands";
import { medicationSource } from "../fixtures/medication-case";
import { createSemanticCase } from "../../src/domain/case/create";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { performJourneyAction } from "../../src/server/journey/service";
import { selectJourneyModel } from "../../src/server/model/configured-journey";
import { usabilityScenario } from "../fixtures/usability-model";
import { medicationSparseOpening } from "../fixtures/medication-model";

test("Draft 4 gaps: pending answers, separate tests, direct clinical recovery and retained reporter draft", async ({ page }, info) => {
  let interpretationRequests = 0;
  await page.route("**/api/case", async route => {
    if (route.request().method() === "POST" && ["submit-opening", "submit-update"].includes(route.request().postDataJSON()?.action?.action)) {
      interpretationRequests++;
      await route.abort();
    } else await route.continue();
  });
  const pending = await flowAlignmentState();
  await writeFile(info.outputPath("pending-state.json"), JSON.stringify(pending));
  await page.goto("/");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await page.evaluate(state => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), pending);
  await page.reload();
  const details = page.locator('[data-screen="details"]');
  const invitation = details.getByRole("region", { name: "Useful clinical details" });
  await expect(invitation.getByRole("heading", { name: "Review proposed changes first", exact: true })).toBeVisible();
  await expect(page.getByLabel("Clinical update", { exact: true })).toBeHidden();
  await expect(details.getByRole("button", { name: "Continue to reporter details", exact: true })).toHaveCount(0);
  await expect(details.getByRole("button", { name: "Draft reporter details", exact: true })).toBeVisible();
  for (const id of [1, 2]) {
    const card = page.locator(`#case-card-test-${id}`);
    await expect(card.getByRole("button", { name: `Accept Relevant test ${id}`, exact: true })).toBeDisabled();
    await expect(card.getByRole("button", { name: `Discard proposed Relevant test ${id}`, exact: true })).toBeDisabled();
    for (const button of await card.getByRole("button", { name: "Change", exact: true }).all()) await expect(button).toBeDisabled();
  }
  await expect(invitation).toContainText("Proposed answers awaiting acceptance: Relevant tests or laboratory results and Relevant history");
  await expect(invitation).toContainText("Still needs an answer: Other serious event");
  await expect(invitation).toContainText("Remaining treatment questions will be checked after these proposals are reviewed.");
  await expect(invitation).not.toContainText("Still needs an answer: Dose reduced");
  const medication = details.getByRole("article", { name: "ibuprofen — Treatment history · proposed details", exact: true });
  await expect(medication.getByRole("heading", { name: "Stopped date", exact: true })).toBeVisible();
  await expect(medication.getByRole("heading", { name: "ibuprofen — Stopped date", exact: true })).toHaveCount(0);
  await medication.getByText("View source evidence for this group", { exact: true }).click();
  await expect(medication.locator("blockquote")).toHaveCount(2);
  await expect(medication.locator("details")).toContainText("ibuprofen — Stopped date, ibuprofen — Stopped or removed, and ibuprofen — Improved after stopping or reducing");
  await expect(medication.locator("details")).toContainText("Symptoms improved after stopping ibuprofen and it was never restarted.");
  await invitation.getByText("Draft another update", { exact: true }).click();
  await page.getByLabel("Clinical update", { exact: true }).fill("Unsent fictional draft; do not apply.");
  await invitation.getByRole("button", { name: "How to dictate", exact: true }).click();
  await invitation.getByText("Draft another update — unsent text retained", { exact: true }).click();
  await expect(page.getByLabel("Clinical update", { exact: true })).toBeHidden();
  await page.screenshot({ path: info.outputPath("pending-review-desktop.png"), fullPage: true });
  await goTo(page, "Reporter details");
  await page.getByRole("button", { name: "Use demo reporter details", exact: true }).click();
  await page.getByLabel("Date of this report", { exact: true }).fill("2026-09-23");
  await page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Add reporter details", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Before saving reporter details" })).toContainText("Other serious event");
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`reporter-blocked-${width}.png`), fullPage: true });
  }
  expect(await storedState(page)).toEqual(pending);
  await page.getByRole("button", { name: "Review proposed changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review the proposed update", exact: true })).toBeFocused();
  await goTo(page, "Review & save");
  await expect(page.getByText("You have unsaved reporter details.", { exact: false })).toContainText("Finish the clinical review below");
  await expect(page.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Review proposed changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review the proposed update", exact: true })).toBeFocused();
  await medication.getByRole("button", { name: "Accept these changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept these changes", exact: true })).toHaveCount(1);
  expect((await storedState(page)).case.products[0].facts.stopped.resolvedValue?.value).toEqual({ kind: "known", value: true });
  expect((await storedState(page)).case.event.facts.relevantHistory.resolvedValue).toBeUndefined();
  await expect(page.getByRole("button", { name: "Accept Relevant test 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Accept these changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "2 tests are now ready for separate review" })).toBeVisible();
  const test1 = page.locator("#case-card-test-1"), test2 = page.locator("#case-card-test-2");
  await expect(test1.getByRole("heading")).toBeFocused();
  await expect(test1.getByText("Not yet included in the report.", { exact: false })).toBeInViewport();
  await page.screenshot({ path: info.outputPath("tests-ready-desktop.png") });
  await test1.getByRole("button", { name: "Accept Relevant test 1", exact: true }).click();
  await expect(test2.getByRole("heading")).toBeFocused();
  expect((await storedState(page)).case.relevantTests.map(({ state }) => state)).toEqual(["resolved", "proposed"]);
  await test2.getByRole("button", { name: "Accept Relevant test 2", exact: true }).click();
  await expect(test2.getByRole("button", { name: "Accept Relevant test 2", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Questions before preparing the PDF", exact: true })).toBeFocused();
  await expect(invitation.getByRole("button", { name: "How to dictate", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue("Unsent fictional draft; do not apply.");
  const beforeRecovery = await storedState(page);
  await writeFile(info.outputPath("blocked-state.json"), JSON.stringify(beforeRecovery));
  await goTo(page, "Review & save");
  await expect(page.locator('[data-screen="save"]').getByText("Still needs an answer: Other serious event.", { exact: true })).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`clinical-blocker-output-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Answer clinical questions", exact: true }).click();
  await expect(page.locator("#direct-clinical-question")).toHaveAttribute("open", "");
  await expect(page.locator("#clinical-question")).toBeFocused();
  await expect(page.getByRole("button", { name: "Confirm outcomes", exact: true })).toBeInViewport();
  // Navigation must retain an in-progress direct answer too.
  await page.getByLabel("Other serious or important medical event", { exact: true }).check();
  await goTo(page, "Reporter details");
  await expect(page.getByLabel("Reporter email", { exact: true })).toHaveValue("casey.reed@example.test");
  await expect(page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Answer clinical questions", exact: true }).click();
  await expect(page.getByLabel("Other serious or important medical event", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue("Unsent fictional draft; do not apply.");
  expect(await storedState(page)).toEqual(beforeRecovery);
  await page.getByLabel("Other serious or important medical event", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Confirm outcomes", exact: true }).click();
  await goTo(page, "Review & save");
  await expect(page.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Go to reporter details", exact: true }).click();
  await page.getByRole("button", { name: "Add reporter details", exact: true }).click();
  const file = info.outputPath("accepted.pdf");
  await (await savePdf(page)).saveAs(file);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
  const readback = JSON.parse(stdout);
  expect(readback.namedFields).toEqual(baselinePdf.namedFields);
  await writeFile(info.outputPath("pdf-readback.json"), JSON.stringify(readback, null, 2));
  expect(interpretationRequests).toBe(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await goTo(page, "Review details");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`accepted-review-${width}.png`), fullPage: true });
  }
});

test("discard preserves accepted facts; subsequent questions and previously saved reporter navigation stay truthful", async ({ page }) => {
  await page.route("**/api/case", async route => {
    if (["submit-opening", "submit-update"].includes(route.request().postDataJSON()?.action?.action)) throw new Error("Unexpected interpretation request");
    await route.continue();
  });
  const pending = await flowAlignmentState();
  pending.case = applyCaseCommand(pending.case, {
    type: "record-clinician-facts", commandId: "saved-reporter-fixture", expectedRevision: pending.case.revision,
    source: medicationSource("Fictional reporter Casey Reed, physician, casey@example.test.", "saved-reporter-fixture"),
    facts: Object.entries({ firstName: "Casey", lastName: "Reed", occupation: "Physician", email: "casey@example.test" }).map(([field, value]) => ({
      id: `saved-${field}`, intent: "fact" as const, target: { entity: "reporter" as const, entityId: "reporter", field: field as "firstName" | "lastName" | "occupation" | "email" }, value: { kind: "known" as const, value },
    })),
  }).case;
  await page.goto("/");
  await page.getByLabel("Case description", { exact: true }).waitFor();
  await page.evaluate(state => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), pending);
  await page.reload();
  const event = page.getByRole("article", { name: "Event — Relevant history · proposed details", exact: true });
  await event.getByRole("button", { name: "Discard these changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept these changes", exact: true })).toHaveCount(1);
  const discarded = await storedState(page);
  expect(discarded.case.patient).toEqual(pending.case.patient);
  expect(discarded.case.products).toEqual(pending.case.products);
  expect(discarded.case.event.facts.relevantHistory.resolvedValue).toBeUndefined();
  expect(discarded.case.event.facts.relevantHistory.proposedValues).toEqual([]);
  expect(discarded.case.sources).toEqual(pending.case.sources);
  await page.getByRole("button", { name: "Accept these changes", exact: true }).click();
  await page.locator("#case-card-test-1").getByRole("button", { name: "Discard proposed Relevant test 1", exact: true }).click();
  await expect(page.locator("#case-card-test-2").getByRole("heading")).toBeFocused();
  const remaining = await storedState(page);
  expect(remaining.case.relevantTests[0].state).toBe("withdrawn");
  expect(remaining.case.relevantTests[1]).toEqual(pending.case.relevantTests[1]);
  await page.getByRole("button", { name: "Accept Relevant test 2", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Questions before preparing the PDF", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Edit reporter details", exact: true }).click();
  await expect(page.getByRole("region", { name: "Before saving reporter details" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save reporter details", exact: true })).toBeEnabled();
  await page.getByLabel("Reporter email", { exact: true }).fill("unsaved@example.test");
  await goTo(page, "Review & save");
  await expect(page.getByRole("button", { name: "Generate PDF", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Answer clinical questions", exact: true }).click();
  await expect(page.locator("#clinical-question")).toBeFocused();
  await page.getByRole("button", { name: "Confirm outcomes", exact: true }).click();
  await expect(page.locator("#clinical-question")).toBeFocused();
  await expect(page.getByRole("group", { name: "Other relevant medical history", exact: true })).toBeInViewport();
  await page.getByLabel("No relevant history to add", { exact: true }).check();
  await page.getByRole("button", { name: "Add this context", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue to reporter details", exact: true })).toBeVisible();
  await goTo(page, "Reporter details");
  await expect(page.getByLabel("Reporter email", { exact: true })).toHaveValue("unsaved@example.test");
  expect((await storedState(page)).case.reporter.facts.email.resolvedValue?.value).toEqual({ kind: "known", value: "casey@example.test" });
});

test("opening correction remains a draft until acceptance and discarding proposed patient details preserves other groups", async ({ page }) => {
  const initial = createSemanticCase("case-11111111-1111-4111-8111-111111111119");
  const repository = new InMemoryCaseRepository({ initialCase: initial });
  const model = selectJourneyModel({ WILSON_PREDETERMINED_MODEL_RESPONSES: JSON.stringify(usabilityScenario.slice(0, 1)) });
  const snapshot = await performJourneyAction(repository, initial.id, { action: "submit-opening", text: medicationSparseOpening, reportType: "adverse-event" }, model);
  const opening = { version: browserStateVersion, stage: snapshot.stage, case: (await repository.load(initial.id))!, unrepresented: snapshot.unrepresented };
  await page.route("**/api/case", async route => {
    if (["submit-opening", "submit-update"].includes(route.request().postDataJSON()?.action?.action)) throw new Error("Unexpected interpretation request");
    await route.continue();
  });
  await page.goto("/");
  await page.getByLabel("Case description", { exact: true }).waitFor();
  await page.evaluate(state => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), opening);
  await page.reload();
  const patient = page.locator("#case-card-patient");
  const age = patient.locator("dl > div").filter({ has: page.getByText("Age", { exact: true }) });
  await age.getByRole("button", { name: "Change", exact: true }).click();
  await age.getByLabel("New Age", { exact: true }).fill("41");
  await age.getByRole("button", { name: "Keep draft", exact: true }).click();
  expect(await storedState(page)).toEqual(opening);
  await patient.getByRole("button", { name: "Accept patient details with 1 change", exact: true }).click();
  await expect(patient.getByText("41", { exact: true })).toBeVisible();
  expect((await storedState(page)).case.patient.facts.ageYears.resolvedValue?.value).toEqual({ kind: "known", value: 41 });
  await page.evaluate(state => sessionStorage.setItem("wilson-journey-state-v2", JSON.stringify(state)), opening);
  await page.reload();
  await patient.getByRole("button", { name: "Discard proposed patient details", exact: true }).click();
  await expect(patient.getByRole("button", { name: "Accept patient details", exact: true })).toHaveCount(0);
  const discarded = await storedState(page);
  expect(discarded.case.patient.facts.ageYears.resolvedValue).toBeUndefined();
  expect(discarded.case.patient.facts.ageYears.proposedValues).toEqual([]);
  expect(discarded.case.event).toEqual(opening.case.event);
  expect(discarded.case.products).toEqual(opening.case.products);
  expect(discarded.case.sources).toEqual(opening.case.sources);
});
