import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  regressionOpening,
  regressionUpdate,
  adaptiveRichOpening,
  adaptiveSparseOpening,
  layer1DeathOpening,
  layer1RoleOpening,
  layer1RoleUpdate,
  layer1TestsOpening,
  layer1TestsUpdate,
  layer2DeviceOpening,
  layer2ProductQualityOpening,
  layer3CombinedOpening,
  layer3ConditionalOpening,
  layer3CorrectionOpening,
  layer3CorrectionUpdate,
  identityQuarantineOpening,
  predeterminedModelResponses,
  repeatedOpening,
  repeatedUpdate,
  richOpening,
  quarantineOpening,
  sparseOpening,
} from "./build-predetermined-responses";
import type { BrowserJourneyState } from "../../src/server/case/browser-state";
import type { ReportType } from "../../src/domain/case/types";

const execFileAsync = promisify(execFile);
const retainEvidence = process.env.WILSON_RETAIN_STAGE3_EVIDENCE === "1";
const evidenceDirectory = process.env.WILSON_STAGE3_EVIDENCE_DIRECTORY ?? "evidence/experiment-2/stage-3";
const retainAdaptiveOnly = evidenceDirectory.includes("issue-57");
const retainLayer1RepresentativeOnly = evidenceDirectory.includes("issue-60");
const retainLayer2RepresentativeOnly = evidenceDirectory.includes("issue-62");
const retainLayer3RepresentativeOnly = evidenceDirectory.includes("issue-64");
const retainIssue66Only = evidenceDirectory.includes("issue-66");
const retainIssue78Only = evidenceDirectory.includes("issue-78");
const readbacks: Record<string, IndependentReadback> = {};
const checkpoints: Array<{ journey: string; state: string; assertion: string }> = [];
const pdfs: Array<{ journey: string; bytes: number; sha256: string }> = [];
const questionTrace: Array<{ journey: string; question: string; reason: string; answer: string }> = [];

test("runs Issue 78 recovery and layout, Issue 66 direct correction, Issue 67 quarantine, and all prior deterministic regressions through one assembled desktop path", async ({ page, browser }, testInfo) => {
  if (retainEvidence) await mkdir(evidenceDirectory, { recursive: true });

  const initial = await page.goto("/");
  expect(initial?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.getByRole("heading", { name: "Describe what happened" })).toBeVisible();
  await expect(page.getByLabel("Experiment boundary")).toContainText("Fictional information only");

  await submitOpening(page, identityQuarantineOpening);
  const identityQuarantine = page.getByRole("status").filter({ hasText: "Some details were left out" });
  await expect(identityQuarantine).toContainText("Product — Name");
  await expect(identityQuarantine).toContainText("Product — Product type");
  await expect(identityQuarantine).toContainText("add missing identity in its reviewed product card");
  await expect(productCard(page, "Product 1")).toContainText("500 mg");
  const quarantinedIdentityCase = await semanticCase(page);
  expect(quarantinedIdentityCase.products).toHaveLength(1);
  expect(quarantinedIdentityCase.products[0].facts.name.state).toBe("empty");
  expect(quarantinedIdentityCase.products[0].facts.productType.state).toBe("empty");
  expect(quarantinedIdentityCase.products[0].facts.role.resolvedValue).toBeUndefined();
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await page.getByRole("button", { name: "Confirm outcomes" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Required before adding" }))
    .toContainText("first name, last name, and phone or email");

  const reporterControls = [
    "Reporter first name", "Reporter last name", "Reporter phone", "Reporter email", "Reporter address",
    "Reporter city", "Reporter state", "Reporter postal code", "Reporter country", "Reporter occupation",
  ].map((label) => page.getByLabel(label));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await assertTaskControlsOperable(page, reporterControls);
    await expectNoDocumentOverflow(page);
    await retainViewportScreenshot(page, `issue78-reporter-${viewport.width}x${viewport.height}.png`);
  }
  await fillReporter(page, { firstName: "Casey", lastName: "Reed", email: "casey.reed@example.test" });
  await expect(page.getByRole("status").filter({ hasText: "Required before adding" })).toHaveCount(0);
  const addReporter = page.getByRole("button", { name: "Add reporter details" });
  await expect(addReporter).toBeEnabled();
  await addReporter.click({ trial: true });
  await addReporter.click();

  await expect(page.getByRole("heading", { name: "The form needs more reviewed information" })).toBeVisible();
  await expect(page.getByText("Product 1 needs Name and Product type", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download official PDF" })).toBeDisabled();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).not.toContainText("amoxicillin");
  await retainViewportScreenshot(page, "issue78-blocked-output-1280x800.png");
  await page.getByRole("button", { name: "Review Product 1" }).click();

  const nameRow = productCard(page, "Product 1").locator("dl > div").filter({ has: page.getByText("Name", { exact: true }) });
  await nameRow.getByRole("button", { name: "Add" }).click();
  await page.getByLabel("New Name").fill("amoxicillin");
  await nameRow.getByRole("button", { name: "Add fact" }).click();
  const typeRow = productCard(page, "amoxicillin").locator("dl > div").filter({ has: page.getByText("Product type", { exact: true }) });
  await typeRow.getByRole("button", { name: "Add" }).click();
  await page.getByLabel("New Product type").selectOption("drug-or-biologic");
  await typeRow.getByRole("button", { name: "Add fact" }).click();

  await expect(page.getByRole("heading", { name: "What was amoxicillin being used for?" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "another report detail applicable" })).toBeVisible();
  const indicationGroup = page.getByRole("group", { name: "amoxicillin" });
  const indicationControls = [
    indicationGroup.getByLabel("Known", { exact: true }),
    page.getByLabel("amoxicillin indication"),
    indicationGroup.getByLabel("Unknown", { exact: true }),
    indicationGroup.getByLabel("Prefer not to answer", { exact: true }),
  ];
  for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await assertTaskControlsOperable(page, indicationControls);
    await expectNoDocumentOverflow(page);
    await retainViewportScreenshot(page, `issue78-indication-${viewport.width}x${viewport.height}.png`);
  }
  await indicationGroup.getByLabel("Known", { exact: true }).check();
  await page.getByLabel("amoxicillin indication").fill("sinusitis");
  const addIndication = page.getByRole("button", { name: "Add these answers" });
  await expect(addIndication).toBeEnabled();
  await addIndication.click({ trial: true });
  await addIndication.click();
  questionTrace.push({
    journey: "issue78-identity-recovery",
    question: "newly applicable suspect indication",
    reason: "direct repair supplied the quarantined name and product type, making only the medication indication newly applicable",
    answer: "sinusitis",
  });
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const repairedCase = await semanticCase(page);
  expect(repairedCase.products[0].facts.name.resolvedValue?.value).toEqual({ kind: "known", value: "amoxicillin" });
  expect(repairedCase.products[0].facts.productType.resolvedValue?.value).toEqual({ kind: "known", value: "drug-or-biologic" });
  expect(repairedCase.products[0].facts.indication.resolvedValue?.value).toEqual({ kind: "known", value: "sinusitis" });
  checkpoints.push({ journey: "issue78-identity-recovery", state: "repaired-output", assertion: "Exact-evidence quarantine stayed outside accepted state; direct identity repair reopened one applicable clarification and restored aligned reviewed output and PDF without another model call." });
  await retainViewportScreenshot(page, "issue78-repaired-output-1440x900.png");
  await downloadAndCheck(page, "issue78-identity-recovery", ["TEST-72", "amoxicillin", "500 mg", "01-SEP-2026", "Casey", "Reed"], []);

  await newCase(page);

  await submitOpening(page, quarantineOpening);
  const quarantine = page.getByRole("status").filter({ hasText: "Some details were left out" });
  await expect(quarantine).toContainText("Event — Symptoms");
  await expect(quarantine).toContainText("Event — Product availability");
  await expect(quarantine).toContainText("she developed hypotension and was hospitalized");
  await expect(quarantine).toContainText("The device is available for evaluation");
  const quarantinedCase = await semanticCase(page);
  expect(quarantinedCase.event.facts.symptoms.state).toBe("empty");
  expect(quarantinedCase.event.facts.productAvailability.state).toBe("empty");
  expect(quarantinedCase.products).toHaveLength(1);
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  await expect(quarantine).toBeVisible();
  await fillReporter(page, { firstName: "Taylor", lastName: "Quinn", email: "taylor.quinn@example.test" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(quarantine).toBeVisible();
  await downloadAndCheck(page, "issue67-quarantine", ["TEST-74", "Acme FlowGuard", "Taylor", "Quinn"], ["hypotension"], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].RepAdverse[0]": "/1",
    "topmostSubform[0].Page3[0].TestDataTable[0].EvalYes[0]": "/Off",
    "topmostSubform[0].Page6[0].SecE_Device[0].BrandName[0]": "Acme FlowGuard",
  });
  checkpoints.push({ journey: "issue67-quarantine", state: "partial-output", assertion: "Two malformed suggestions stayed visible and outside accepted case/PDF state while valid proposals completed through review and PDF download." });

  await newCase(page);
  await submitOpening(page, layer3CombinedOpening, "adverse-event-and-product-problem");
  await expect(productCard(page, "Acme ThermoPatch")).toContainText("wearable temperature monitor");
  await expect(productOrCaseCard(page, "Event")).toContainText("blistering burn on left arm");
  await expect(productOrCaseCard(page, "Event")).toContainText("Adverse event and product problem");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  questionTrace.push({ journey: "layer3-combined", question: "reporter block", reason: "accepted combined event, problem, outcome, context, and device facts suppress redundant questions", answer: "structured reporter details" });
  await fillReporter(page, { firstName: "Alex", lastName: "Morgan", email: "alex.morgan@example.test" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const combinedCase = await semanticCase(page);
  expect(combinedCase.event.facts.reportType.resolvedValue?.value).toEqual({ kind: "known", value: "adverse-event-and-product-problem" });
  expect(combinedCase.products).toHaveLength(1);
  expect(combinedCase.askedNeeds.map(({ key }) => key)).toEqual(["reporter-details"]);
  checkpoints.push({ journey: "layer3-combined", state: "output", assertion: "One report-type fact retained both selected meanings and one stable device supplied aligned event, product-problem, availability, and Section E output." });
  await downloadAndCheck(page, "layer3-combined", ["TEST-67", "Acme ThermoPatch", "Problem detail: Acme ThermoPatch overheated after its adhesive backing split. Symptoms: blistering burn on left arm. Treatment: cool compresses. Outcome: recovered.", "Alex", "Morgan"], [], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].RepAdverse[0]": "/1",
    "topmostSubform[0].Page1[0].SecA_Patient[0].Defects[0]": "/1",
    "topmostSubform[0].Page3[0].TestDataTable[0].EvalYes[0]": "/1",
    "topmostSubform[0].Page6[0].SecE_Device[0].BrandName[0]": "Acme ThermoPatch",
  });

  await newCase(page);
  await submitOpening(page, layer3ConditionalOpening, "product-problem");
  await expect(productCard(page, "Acme PulseLine")).toContainText("Implanted device");
  await expect(productCard(page, "Acme PulseLine")).toContainText("Reprocessed single-use device");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Add the applicable device details for Acme PulseLine" })).toBeVisible();
  const implantGroup = page.getByRole("group", { name: "Implant date" });
  await implantGroup.getByLabel("Known", { exact: true }).check();
  await page.getByLabel("Device implant date").fill("2026-08-12");
  const explantGroup = page.getByRole("group", { name: "Explant date" });
  await explantGroup.getByLabel("Not applicable", { exact: true }).check();
  const reprocessorGroup = page.getByRole("group", { name: "Reprocessor" });
  await reprocessorGroup.getByLabel("Known", { exact: true }).check();
  await page.getByLabel("Device reprocessor").fill("ReNew Medical LLC");
  questionTrace.push({ journey: "layer3-conditional", question: "applicable device details", reason: "accepted implanted and reprocessed-single-use states make implant timing and reprocessor identity material", answer: "implant date known; explant inapplicable; reprocessor known" });
  await page.getByRole("button", { name: "Add device details" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  await fillReporter(page, { firstName: "Sam", lastName: "Ortiz", phone: "202-555-0194" });
  questionTrace.push({ journey: "layer3-conditional", question: "reporter block", reason: "reporter identity remains direct entry", answer: "structured reporter details" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const conditionalCase = await semanticCase(page);
  expect(conditionalCase.products[0].facts.implantDate.resolvedValue?.value).toEqual({ kind: "known", value: "2026-08-12" });
  expect(conditionalCase.products[0].facts.explantDate.resolvedValue?.value).toEqual({ kind: "inapplicable" });
  expect(conditionalCase.products[0].facts.reprocessor.resolvedValue?.value).toEqual({ kind: "known", value: "ReNew Medical LLC" });
  expect(conditionalCase.askedNeeds.map(({ key }) => key)).toEqual(["device-details", "reporter-details"]);
  checkpoints.push({ journey: "layer3-conditional", state: "output", assertion: "One grouped turn asked only details made applicable by accepted implanted and reprocessed states, then closed them without repetition." });
  await downloadAndCheck(page, "layer3-conditional", ["Acme PulseLine", "12-AUG-2026", "ReNew Medical LLC", "Sam", "Ortiz"], [], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].Defects[0]": "/1",
    "topmostSubform[0].Page6[0].SecE_Device[0].ImplantDate[0]": "12-AUG-2026",
    "topmostSubform[0].Page6[0].SecE_Device[0].ReuseYes[0]": "/1",
    "topmostSubform[0].Page6[0].SecE_Device[0].ReprocInfo[0]": "ReNew Medical LLC",
  }, ["topmostSubform[0].Page6[0].SecE_Device[0].ExplantDate[0]"]);

  await newCase(page);
  await submitOpening(page, layer3CorrectionOpening, "product-problem");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await fillReporter(page, { firstName: "Jamie", lastName: "Kim", email: "jamie.kim@example.test" });
  questionTrace.push({ journey: "layer3-correction", question: "reporter block", reason: "opening device facts require no conditional detail turn", answer: "structured reporter details" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await page.getByLabel("Clinical update").fill(layer3CorrectionUpdate);
  await page.getByRole("button", { name: "Review this update" }).click();
  await page.getByRole("article").filter({ hasText: "SN-1002" }).getByRole("button", { name: "Accept this update" }).click();
  await expect(page.getByText("Earlier: SN-1001", { exact: true })).toBeVisible();
  await page.getByRole("article").filter({ hasText: "NS-8" }).getByRole("button", { name: "Accept this update" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(page.getByText("Acme NeuroSense — Model number has incompatible sources", { exact: false })).toBeVisible();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("SN-1002");
  await expect(page.getByRole("button", { name: "Download official PDF" })).toBeEnabled();
  const correctedDeviceCase = await semanticCase(page);
  expect(correctedDeviceCase.products).toHaveLength(1);
  expect(correctedDeviceCase.products[0].id).toBe("product-layer3-correction-device");
  expect(correctedDeviceCase.products[0].facts.serialNumber.resolvedValue?.value).toEqual({ kind: "known", value: "SN-1002" });
  expect(correctedDeviceCase.products[0].facts.serialNumber.supersededValues.map(({ value }) => value)).toEqual([{ kind: "known", value: "SN-1001" }]);
  expect(correctedDeviceCase.products[0].facts.modelNumber.state).toBe("conflicted");
  expect(correctedDeviceCase.askedNeeds.map(({ key }) => key)).toEqual(["reporter-details"]);
  checkpoints.push({ journey: "layer3-correction", state: "unresolved-partial-output", assertion: "The stable device retained its serial correction and history while incompatible model alternatives stayed visible and absent from the enabled partial PDF." });
  await retainScreenshot(page, "layer3-correction-output.png");
  await downloadAndCheck(page, "layer3-correction", ["Acme NeuroSense", "SN-1002", "Jamie", "Kim"], ["SN-1001", "NS-7", "NS-8"], {
    "topmostSubform[0].Page6[0].SecE_Device[0].SerialNum[0]": "SN-1002",
  }, ["topmostSubform[0].Page6[0].SecE_Device[0].ModelNum[0]"]);

  await newCase(page);
  await submitOpening(page, layer2DeviceOpening);
  await expect(productCard(page, "Acme FlowGuard")).toContainText("Suspect medical device");
  await expect(productCard(page, "Acme FlowGuard")).toContainText("(01)00812345000017(21)SN7721");
  await expect(productCard(page, "Acme FlowGuard")).toContainText("Stopped or removed");
  await expect(productCard(page, "Acme FlowGuard")).toContainText("Patient or consumer");
  await expect(page.getByText("health-professional", { exact: true })).toHaveCount(0);
  await expect(productOrCaseCard(page, "Event")).toContainText("available");
  await productCard(page, "Relevant test 1").getByRole("button", { name: "Remove Relevant test 1" }).click();
  const operatorRow = productCard(page, "Acme FlowGuard").locator("dl > div").filter({ has: page.getByText("Device operator", { exact: true }) });
  await operatorRow.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Device operator").selectOption("health-professional");
  await operatorRow.getByRole("button", { name: "Keep draft" }).click();
  await productCard(page, "Acme FlowGuard").getByRole("button", { name: "Accept Acme FlowGuard with 1 change" }).click();
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  questionTrace.push({ journey: "layer2-device", question: "reporter block", reason: "accepted outcomes and clinical context suppress medication-only and redundant clinical questions", answer: "structured reporter details" });
  await fillReporter(page, { firstName: "Dana", lastName: "Mills", email: "dana.mills@example.test" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("No relevant tests");
  const modelRow = productCard(page, "Acme FlowGuard").locator("dl > div").filter({ has: page.getByText("Model number", { exact: true }) });
  await modelRow.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Model number").fill("FG-201");
  await modelRow.getByRole("button", { name: "Apply correction" }).click();
  await expect(page.getByText("Earlier: FG-200", { exact: true })).toBeVisible();
  const deviceCase = await semanticCase(page);
  expect(deviceCase.products).toHaveLength(1);
  expect(deviceCase.products[0].id).toBe("product-layer2-device-device");
  expect(deviceCase.products[0].facts.productType.resolvedValue?.value).toEqual({ kind: "known", value: "device" });
  expect(deviceCase.products[0].facts.deviceOperator.resolvedValue?.value).toEqual({ kind: "known", value: "health-professional" });
  expect(deviceCase.products[0].facts.modelNumber.resolvedValue?.value).toEqual({ kind: "known", value: "FG-201" });
  expect(deviceCase.products[0].facts.modelNumber.supersededValues.map(({ value }) => value)).toEqual([{ kind: "known", value: "FG-200" }]);
  expect(deviceCase.products[0].facts.stopped.resolvedValue?.value).toEqual({ kind: "known", value: true });
  expect(deviceCase.products[0].facts.implantDate.resolvedValue?.value).toEqual({ kind: "inapplicable" });
  expect(deviceCase.relevantTests[0]).toMatchObject({ state: "rejected" });
  expect(deviceCase.askedNeeds.map(({ key }) => key)).toEqual(["reporter-details"]);
  expect(await page.locator('[aria-label="Form FDA 3500 preview"]').textContent()).toContain("Acme Medical, Reno, Nevada");
  checkpoints.push({ journey: "layer2-device", state: "directly-corrected-output", assertion: "The operator rejected an erroneous test, atomically corrected a typed opening value, then directly corrected the reviewed stable device; explicit no-tests and stopped status remained visible without another model call." });
  await retainScreenshot(page, "layer2-device-output.png");
  await downloadAndCheck(page, "layer2-device", ["TEST-74", "Acme FlowGuard", "infusion pump", "Acme Medical, Reno, Nevada", "FG-201", "L-904", "SN-7721", "(01)00812345000017(21)SN7721", "Dana", "Mills"], ["FG-200"], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].RepAdverse[0]": "/1",
    "topmostSubform[0].Page3[0].TestDataTable[0].EvalYes[0]": "/1",
    "topmostSubform[0].Page6[0].SecE_Device[0].BrandName[0]": "Acme FlowGuard",
    "topmostSubform[0].Page6[0].SecE_Device[0].ModelNum[0]": "FG-201",
    "topmostSubform[0].Page6[0].SecE_Device[0].HealthPro[0]": "/1",
    "topmostSubform[0].Page6[0].SecE_Device[0].ReuseNo[0]": "/1",
    "topmostSubform[0].Page6[0].SecE_Device[0].ServicedNo[0]": "/1",
  }, ["topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]"]);

  await newCase(page);
  await submitOpening(page, layer2ProductQualityOpening, "product-problem");
  await expect(productCard(page, "Cardiovex 20 mg tablets")).toContainText("CV-442");
  await expect(productOrCaseCard(page, "Patient")).not.toContainText("TEST-");
  await expect(productOrCaseCard(page, "Event")).toContainText("Product problem");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  questionTrace.push({ journey: "layer2-product-quality", question: "reporter block", reason: "a product-problem-only report does not trigger indication, serious-outcome, or clinical-context interrogation", answer: "structured reporter details" });
  await fillReporter(page, { firstName: "Elliot", lastName: "Ross", phone: "202-555-0188" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const qualityCase = await semanticCase(page);
  expect(qualityCase.patient.facts.identifier.state).toBe("empty");
  expect(qualityCase.event.facts.reportType.resolvedValue?.value).toEqual({ kind: "known", value: "product-problem" });
  expect(qualityCase.event.facts.symptoms.resolvedValue?.value).toEqual({ kind: "explicitly-absent" });
  expect(qualityCase.products[0].facts.lotNumber.resolvedValue?.value).toEqual({ kind: "known", value: "CV-442" });
  expect(qualityCase.askedNeeds.map(({ key }) => key)).toEqual(["reporter-details"]);
  checkpoints.push({ journey: "layer2-product-quality", state: "partial-output", assertion: "No patient or adverse event was invented; one sparse non-device product projected to Section D with the product-problem and availability selections." });
  await downloadAndCheck(page, "layer2-product-quality", ["Cardiovex 20 mg tablets", "CV-442", "Problem detail: Unopened Cardiovex 20 mg tablets contained visible brown particles under the seal.", "Elliot", "Ross"], ["TEST-74", "Acme FlowGuard"], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].Defects[0]": "/1",
    "topmostSubform[0].Page3[0].TestDataTable[0].EvalYes[0]": "/1",
    "topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]": "Cardiovex 20 mg tablets",
    "topmostSubform[0].Page4[0].Prod1[0].Prod1LotNum[0]": "CV-442",
  }, ["topmostSubform[0].Page6[0].SecE_Device[0].BrandName[0]"]);

  await newCase(page);
  await submitOpening(page, layer1DeathOpening);
  await expect(productOrCaseCard(page, "Event")).toContainText("Death");
  await expect(productOrCaseCard(page, "Relevant test 1")).toContainText("Skin biopsy: full-thickness epidermal necrosis");
  await expect(productCard(page, "trimethoprim-sulfamethoxazole")).toContainText("urinary tract infection");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Which serious outcomes applied to this event?" })).toBeVisible();
  await expect(page.getByLabel("Death — already recorded")).toBeChecked();
  questionTrace.push({ journey: "layer1-death", question: "serious outcomes", reason: "preserve accepted death and resolve only the remaining outcome flags", answer: "no additional outcomes" });
  await page.getByRole("button", { name: "Confirm outcomes" }).click();
  await expect(page.getByRole("heading", { name: "What was the date of death?" })).toBeVisible();
  questionTrace.push({ journey: "layer1-death", question: "death date", reason: "death was accepted and its conditional date remained empty", answer: "7-Sep-2026" });
  await page.locator("#death-date").fill("2026-09-07");
  await page.getByRole("button", { name: "Add date" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  questionTrace.push({ journey: "layer1-death", question: "reporter block", reason: "reporter identity must be entered directly", answer: "structured reporter details" });
  await fillReporter(page, { firstName: "Morgan", lastName: "Reed", email: "morgan.reed@example.test" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const deathCase = await semanticCase(page);
  expect(deathCase.event.facts.death.resolvedValue?.value).toEqual({ kind: "known", value: true });
  expect(deathCase.event.facts.deathDate.resolvedValue?.value).toEqual({ kind: "known", value: "2026-09-07" });
  expect(deathCase.askedNeeds.map(({ key }) => key)).toEqual(["serious-outcomes", "death-date", "reporter-details"]);
  expect(deathCase.relevantTests).toHaveLength(1);
  checkpoints.push({ journey: "layer1-death", state: "output", assertion: "Accepted death stayed true; only unresolved outcomes, the conditional death date, and reporter details were asked." });
  await downloadAndCheck(page, "layer1-death", ["TEST-63", "trimethoprim-sulfamethoxazole", "Skin biopsy: full-thickness epidermal necrosis", "07-SEP-2026", "Morgan", "Reed"], [], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].Death[0]": "/1",
    "topmostSubform[0].Page1[0].SecA_Patient[0].DeathDate[0]": "07-SEP-2026",
  });

  await newCase(page);
  await submitOpening(page, layer1TestsOpening);
  await expect(productOrCaseCard(page, "Relevant test 1")).toContainText("ALT: 132 U/L");
  await expect(productOrCaseCard(page, "Relevant test 2")).toContainText("AST: 118 U/L");
  await expect(productOrCaseCard(page, "Relevant test 3")).toContainText("Total bilirubin: 2.1 mg/dL");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  questionTrace.push({ journey: "layer1-tests", question: "reporter block", reason: "accepted indications, outcomes, three tests, and history suppress earlier groups", answer: "structured reporter details" });
  await fillReporter(page, { firstName: "Riley", lastName: "Patel", phone: "202-555-0162" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const testsBeforeCorrection = await semanticCase(page);
  expect(testsBeforeCorrection.relevantTests.map(({ id }) => id)).toEqual([
    "test-layer1-tests-alt", "test-layer1-tests-ast", "test-layer1-tests-bilirubin",
  ]);
  await page.getByLabel("Clinical update").fill(layer1TestsUpdate);
  await page.getByRole("button", { name: "Review this update" }).click();
  await expect(page.getByRole("heading", { name: "Review the proposed update" })).toBeVisible();
  const proposedTestCorrection = await semanticCase(page);
  expect(proposedTestCorrection.relevantTests).toHaveLength(3);
  expect(proposedTestCorrection.relevantTests[0].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "ALT: 132 U/L" });
  expect(proposedTestCorrection.relevantTests[0].facts.testResult.proposedValues[0]?.value).toEqual({ kind: "known", value: "ALT: 123 U/L" });
  await page.getByRole("article").filter({ hasText: "ALT: 123 U/L" }).getByRole("button", { name: "Accept this update" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(page.getByText("Earlier: ALT: 132 U/L", { exact: true })).toBeVisible();
  const testsAfterCorrection = await semanticCase(page);
  expect(testsAfterCorrection.relevantTests.map(({ id }) => id)).toEqual(testsBeforeCorrection.relevantTests.map(({ id }) => id));
  expect(testsAfterCorrection.relevantTests).toHaveLength(3);
  expect(testsAfterCorrection.relevantTests[0].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "ALT: 123 U/L" });
  expect(testsAfterCorrection.relevantTests[0].facts.testResult.supersededValues.map(({ value }) => value)).toEqual([{ kind: "known", value: "ALT: 132 U/L" }]);
  expect(testsAfterCorrection.relevantTests[1].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "AST: 118 U/L" });
  expect(testsAfterCorrection.relevantTests[2].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "Total bilirubin: 2.1 mg/dL" });
  expect(testsAfterCorrection.askedNeeds.map(({ key }) => key)).toEqual(["reporter-details"]);
  checkpoints.push({ journey: "layer1-tests", state: "corrected-output", assertion: "Three stable test entities remained distinct; the accepted ALT correction superseded only its prior value and did not reopen completion." });
  await downloadAndCheck(page, "layer1-tests", ["TEST-51", "atorvastatin", "ALT: 123 U/L", "AST: 118 U/L", "Total bilirubin: 2.1 mg/dL", "Riley", "Patel"], ["ALT: 132 U/L"]);
  await productCard(page, "Relevant test 3").getByRole("button", { name: "Withdraw Relevant test 3" }).click();
  await expect(productCard(page, "Relevant test 3")).toContainText("Withdrawn from the active report");
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).not.toContainText("Total bilirubin: 2.1 mg/dL");
  const testsAfterWithdrawal = await semanticCase(page);
  expect(testsAfterWithdrawal.relevantTests[2]).toMatchObject({ state: "withdrawn" });
  expect(testsAfterWithdrawal.relevantTests[2].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "Total bilirubin: 2.1 mg/dL" });
  checkpoints.push({ journey: "layer1-tests", state: "withdrawn-test-output", assertion: "A reviewed relevant test became inactive without deletion; its facts and source history remained visible while projection and PDF recomputed without it." });
  await downloadAndCheck(page, "layer1-tests-withdrawal", ["TEST-51", "atorvastatin", "ALT: 123 U/L", "AST: 118 U/L", "Riley", "Patel"], ["ALT: 132 U/L", "Total bilirubin: 2.1 mg/dL"]);

  await newCase(page);
  await submitOpening(page, layer1RoleOpening);
  await expect(productCard(page, "warfarin")).toContainText("Suspect product");
  await expect(productCard(page, "acetaminophen")).toContainText("Other product");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  questionTrace.push({ journey: "layer1-role", question: "reporter block", reason: "accepted opening knowledge suppresses all earlier completion groups", answer: "structured reporter details" });
  await fillReporter(page, { firstName: "Taylor", lastName: "Ng", email: "taylor.ng@example.test" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const roleBeforeCorrection = await semanticCase(page);
  expect(roleBeforeCorrection.products.map(({ id }) => id)).toEqual([
    "product-layer1-role-warfarin", "product-layer1-role-acetaminophen",
  ]);
  await page.getByLabel("Clinical update").fill(layer1RoleUpdate);
  await page.getByRole("button", { name: "Review this update" }).click();
  await page.getByRole("article").filter({ hasText: "Suspect product" }).getByRole("button", { name: "Accept this update" }).click();
  await expect(page.getByRole("heading", { name: "What was acetaminophen being used for?" })).toBeVisible();
  questionTrace.push({ journey: "layer1-role", question: "newly applicable suspect indication", reason: "accepted role correction made only acetaminophen indication newly applicable", answer: "headache" });
  const acetaminophenAnswer = page.getByRole("group", { name: "acetaminophen" });
  await acetaminophenAnswer.getByLabel("Known", { exact: true }).check();
  await page.getByLabel("acetaminophen indication").fill("headache");
  await page.getByRole("button", { name: "Add these answers" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const roleAfterCorrection = await semanticCase(page);
  expect(roleAfterCorrection.products.map(({ id }) => id)).toEqual(roleBeforeCorrection.products.map(({ id }) => id));
  expect(roleAfterCorrection.products.map(({ facts }) => facts.role.resolvedValue?.value)).toEqual([
    { kind: "known", value: "suspect" }, { kind: "known", value: "suspect" },
  ]);
  expect(roleAfterCorrection.products[1].facts.role.supersededValues.map(({ value }) => value)).toEqual([{ kind: "known", value: "concomitant" }]);
  expect(roleAfterCorrection.products[1].facts.indication.resolvedValue?.value).toEqual({ kind: "known", value: "headache" });
  expect(roleAfterCorrection.askedNeeds.map(({ key }) => key)).toEqual(["reporter-details", "suspect-product-indications"]);
  checkpoints.push({ journey: "layer1-role", state: "recomputed-output", assertion: "The stable acetaminophen entity moved from concomitant to suspect, reopened only its indication, and projected with warfarin in Section D." });
  await retainScreenshot(page, "layer1-role-output.png");
  await downloadAndCheck(page, "layer1-role", ["TEST-47", "warfarin", "atrial fibrillation", "acetaminophen", "headache", "every six hours", "Taylor", "Ng"], [], {
    "topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]": "warfarin",
    "topmostSubform[0].Page5[0].Prod2[0].Prod2Name[0]": "acetaminophen",
    "topmostSubform[0].Page5[0].Prod2[0].Prod2Diagnosis[0]": "headache",
    "topmostSubform[0].Page5[0].Prod2[0].Prod2Freq[0]": "Other",
    "topmostSubform[0].Page5[0].Prod2[0].Prod2FreqOther[0]": "every six hours",
  }, ["topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Prod1[0]"]);

  await newCase(page);
  await submitOpening(page, adaptiveRichOpening);
  await expect(productOrCaseCard(page, "Patient")).toContainText("64 kg");
  await expect(productOrCaseCard(page, "Relevant test 1")).toContainText("Serum tryptase: 18 ng/mL");
  await expect(productOrCaseCard(page, "Event")).toContainText("Penicillin allergy");
  const richPatient = productOrCaseCard(page, "Patient");
  const richAge = richPatient.locator("dl > div").filter({ has: page.getByText("Age", { exact: true }) });
  await richAge.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Age").fill("73");
  await richAge.getByRole("button", { name: "Keep draft" }).click();
  const richWeight = richPatient.locator("dl > div").filter({ has: page.getByText("Weight", { exact: true }) });
  await richWeight.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Weight").fill("65");
  await richWeight.getByRole("button", { name: "Keep draft" }).click();
  await richPatient.getByRole("button", { name: "Accept Patient with 2 changes" }).click();
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Hospitalization is already recorded. Did any other serious outcomes apply?" })).toBeVisible();
  await expect(page.getByLabel("Hospitalization (initial or prolonged) — already recorded")).toBeChecked();
  await expect(page.getByLabel("Life-threatening — already recorded")).toBeChecked();
  await expect(productOrCaseCard(page, "amoxicillin").getByRole("button", { name: "Withdraw amoxicillin" })).toHaveCount(0);
  await expect(productOrCaseCard(page, "Relevant test 1").getByRole("button", { name: "Withdraw Relevant test 1" })).toHaveCount(0);
  questionTrace.push({ journey: "adaptive-rich", question: "serious outcomes", reason: "confirm only outcomes not already accepted", answer: "no additional outcomes" });
  await page.getByRole("button", { name: "Confirm outcomes" }).click();
  await expect(page.getByRole("heading", { name: "Add the reporter details for this report" })).toBeVisible();
  await fillReporter(page, { firstName: "Avery", lastName: "Chen", email: "avery.chen@example.test", fullAddress: true });
  await page.getByLabel("Manufacturer or compounder").check();
  await page.getByLabel("Packer", { exact: true }).check();
  await page.getByLabel("Do not disclose my identity to the manufacturer").check();
  questionTrace.push({ journey: "adaptive-rich", question: "reporter block", reason: "reporter identity must be entered directly", answer: "structured reporter details" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  const richEvent = productOrCaseCard(page, "Event");
  const discharge = richEvent.locator("dl > div").filter({ has: page.getByText("Discharged", { exact: true }) });
  await discharge.getByRole("button", { name: "Add" }).click();
  await page.getByLabel("New Discharged").fill("2026-09-04");
  await discharge.getByRole("button", { name: "Add fact" }).click();
  const reportType = productOrCaseCard(page, "Event").locator("dl > div").filter({ has: page.getByText("Report type", { exact: true }) });
  await reportType.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Report type").selectOption("adverse-event-and-product-problem");
  await reportType.getByRole("button", { name: "Apply correction" }).click();
  const dose = productCard(page, "amoxicillin").locator("dl > div").filter({ has: page.getByText("Dose", { exact: true }) });
  await dose.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Dose").fill("250 mg");
  await dose.getByRole("button", { name: "Apply correction" }).click();
  const reporterEmail = productOrCaseCard(page, "Reporter").locator("dl > div").filter({ has: page.getByText("Email", { exact: true }) });
  await reporterEmail.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Email").fill("avery.chen.corrected@example.test");
  await reporterEmail.getByRole("button", { name: "Apply correction" }).click();
  await expect(page.getByText("Earlier: 500 mg", { exact: true })).toBeVisible();
  await expect(page.getByText("Earlier: avery.chen@example.test", { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("Serum tryptase: 18 ng/mL");
  const richCase = await semanticCase(page);
  expect(richCase.patient.facts.ageYears.resolvedValue?.value).toEqual({ kind: "known", value: 73 });
  expect(richCase.patient.facts.weight.resolvedValue?.value).toEqual({ kind: "known", value: { value: 65, unit: "kg" } });
  expect(richCase.event.facts.dischargeDate.resolvedValue?.value).toEqual({ kind: "known", value: "2026-09-04" });
  expect(richCase.event.facts.reportType.resolvedValue?.value).toEqual({ kind: "known", value: "adverse-event-and-product-problem" });
  expect(richCase.products[0].facts.dose.supersededValues.map(({ value }) => value)).toEqual([{ kind: "known", value: "500 mg" }]);
  checkpoints.push({ journey: "adaptive-rich", state: "directly-corrected-output", assertion: "Two typed patient corrections were accepted atomically; an omitted date, reviewed dose, report type, and reporter email were then directly updated with retained history and no additional model call." });
  await retainScreenshot(page, "adaptive-rich-output.png");
  await downloadAndCheck(page, "adaptive-rich", ["TEST-72", "73", "65", "amoxicillin", "250 mg", "Serum tryptase: 18 ng/mL", "Penicillin allergy", "Avery", "Chen", "avery.chen.corrected@example.test"], ["500 mg", "avery.chen@example.test"], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].AgeValue[0]": "73",
    "topmostSubform[0].Page1[0].SecA_Patient[0].WeightValue[0]": "65",
    "topmostSubform[0].Page1[0].SecA_Patient[0].WeightKG[0]": "/1",
    "topmostSubform[0].Page1[0].SecA_Patient[0].RepAdverse[0]": "/1",
    "topmostSubform[0].Page1[0].SecA_Patient[0].Defects[0]": "/1",
    "topmostSubform[0].Page1[0].SecA_Patient[0].LifeThreaten[0]": "/1",
    "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]": "Symptoms: generalized rash and wheezing. Treatment: epinephrine. Outcome: recovered. Discharged 4-Sep-2026. Products stopped: amoxicillin.",
    "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TLowRange1[0]": "0 ng/mL",
    "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].THighRange1[0]": "11.4 ng/mL",
    "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TDate1[0]": "03-SEP-2026",
    "topmostSubform[0].Page7[0].SecG_Reporter[0].IdentityNo[0]": "/1",
    "topmostSubform[0].Page7[0].SecG_Reporter[0].Packer[0]": "/1",
    "topmostSubform[0].Page7[0].SecG_Reporter[0].Email[0]": "avery.chen.corrected@example.test",
  });

  await newCase(page);
  await submitOpening(page, adaptiveSparseOpening);
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await page.getByRole("group", { name: "propranolol" }).getByLabel("Unknown", { exact: true }).check();
  questionTrace.push({ journey: "adaptive-sparse", question: "suspect indication", reason: "missing indication contributes directly to the report", answer: "unknown" });
  await page.getByRole("button", { name: "Add these answers" }).click();
  await page.getByRole("button", { name: "Confirm outcomes" }).click();
  questionTrace.push({ journey: "adaptive-sparse", question: "serious outcomes", reason: "no outcome was accepted from the narrative", answer: "none" });
  await page.getByLabel("Unknown", { exact: true }).first().check();
  await page.getByLabel("Prefer not to answer", { exact: true }).last().check();
  questionTrace.push({ journey: "adaptive-sparse", question: "tests and history", reason: "both relevant context categories were still unresolved", answer: "tests unknown; history declined" });
  await page.getByRole("button", { name: "Add this context" }).click();
  await fillReporter(page, { firstName: "Jordan", lastName: "Lee", phone: "202-555-0147" });
  questionTrace.push({ journey: "adaptive-sparse", question: "reporter block", reason: "reporter identity must be entered directly", answer: "minimal contact details" });
  await page.getByRole("button", { name: "Add reporter details" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Relevant tests: unknown" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Relevant history: prefer not to answer" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Address: not present" })).toBeVisible();
  checkpoints.push({ journey: "adaptive-sparse", state: "partial-output", assertion: "Four grouped prompts captured unknown and refusal once, exposed omissions, and allowed truthful partial output." });
  await retainScreenshot(page, "adaptive-sparse-output.png");
  await downloadAndCheck(page, "adaptive-sparse", ["TEST-26", "propranolol", "Jordan", "Lee", "202-555-0147"], ["Serum tryptase: 18 ng/mL"]);

  await newCase(page);

  await submitOpening(page, richOpening);
  await expect(productOrCaseCard(page, "Event")).toContainText("diffuse hives and facial swelling");
  await expect(page.getByText("What was cephalexin being used for?", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await completeQuestions(page);
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("cephalexin");
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("diffuse hives and facial swelling");
  checkpoints.push({ journey: "rich", state: "output", assertion: "No duplicate indication question was asked; new bounded completion groups were answered without changing accepted rich facts." });
  await retainScreenshot(page, "rich-output.png");
  await downloadAndCheck(page, "rich", ["TEST-68", "cephalexin", "500 mg", "01-AUG-2026", "04-AUG-2026"], []);

  await newCase(page);
  await submitOpening(page, sparseOpening);
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "What was metformin being used for?" })).toBeVisible();
  const metforminAnswer = page.getByRole("group", { name: "metformin" });
  await expect(metforminAnswer.getByLabel("Unknown", { exact: true })).toBeVisible();
  await expect(metforminAnswer.getByLabel("Prefer not to answer", { exact: true })).toBeVisible();
  await metforminAnswer.getByLabel("Unknown", { exact: true }).check();
  await page.getByRole("button", { name: "Add these answers" }).click();
  await completeQuestions(page);
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(productCard(page, "metformin")).toContainText("unknown");
  await expect(page.getByText("metformin — Used for: unknown", { exact: false })).toBeVisible();
  checkpoints.push({ journey: "sparse", state: "partial-output", assertion: "One attributed question recorded unknown once; optional empty and unknown values remain visible omissions." });
  await retainScreenshot(page, "sparse-output.png");
  await downloadAndCheck(page, "sparse", ["TEST-31", "metformin"], ["01-AUG-2026"]);

  await newCase(page);
  await submitOpening(page, repeatedOpening);
  await expect(productCard(page, "acetaminophen (Tylenol)")).toBeVisible();
  await expect(productCard(page, "ibuprofen")).toBeVisible();
  await expect(page.getByText("Suspect product", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await completeQuestions(page);
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await page.getByLabel("Clinical update").fill(repeatedUpdate);
  await page.getByRole("button", { name: "Review this update" }).click();
  await expect(page.getByRole("heading", { name: "Review the proposed update" })).toBeVisible();
  const doseUpdate = page.getByRole("article").filter({ hasText: "200 mg" });
  await doseUpdate.getByRole("button", { name: "Accept this update" }).click();
  await expect(page.getByText("Earlier: 400 mg", { exact: true })).toBeVisible();
  const dateUpdate = page.getByRole("article").filter({ hasText: "2-Jul-2026" });
  await dateUpdate.getByRole("button", { name: "Accept this update" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(page.getByText("acetaminophen (Tylenol) — Started has incompatible sources", { exact: false })).toBeVisible();
  await expect(page.getByRole("group", { name: "acetaminophen (Tylenol) — Started" })).toBeVisible();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("Omitted — unresolved conflict");
  await expect(page.getByRole("button", { name: "Download official PDF" })).toBeEnabled();
  checkpoints.push({ journey: "repeated", state: "unresolved-partial-output", assertion: "Alias identity stayed singular, dose correction superseded history, and both dates remain visible while neither projects." });
  await retainScreenshot(page, "repeated-unresolved-output.png");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open PDF preview" }).click();
  const popup = await popupPromise;
  await expect(popup.locator('embed[type="application/pdf"]')).toHaveAttribute("src", /^blob:/);
  await popup.close();
  await downloadAndCheck(page, "repeated", ["TEST-44", "acetaminophen (Tylenol)", "ibuprofen", "200 mg", "05-JUL-2026"], ["01-JUL-2026", "02-JUL-2026"]);

  await newCase(page);
  await submitOpening(page, regressionOpening);
  const patient = productOrCaseCard(page, "Patient");
  const ageRow = patient.locator("dl > div").filter({ has: page.getByText("Age", { exact: true }) });
  await ageRow.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("New Age").fill("58");
  await ageRow.getByRole("button", { name: "Keep draft" }).click();
  await patient.getByRole("button", { name: "Accept Patient with 1 change" }).click();
  await expect(patient).toContainText("58");
  await productCard(page, "lisinopril").getByRole("button", { name: "Remove lisinopril" }).click();
  await expect(productCard(page, "lisinopril")).toHaveCount(0);
  checkpoints.push({ journey: "shared-controls", state: "understanding", assertion: "Generic Change and Remove controls updated the server-returned case rather than browser state." });

  await newCase(page);
  await submitOpening(page, regressionOpening);
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  for (const [name, value] of [["apixaban", "postoperative VTE prophylaxis after knee replacement"], ["naproxen", "postoperative pain"]] as const) {
    const group = page.getByRole("group", { name });
    await group.getByLabel("Known", { exact: true }).check();
    await page.getByLabel(`${name} indication`).fill(value);
  }
  await page.getByRole("button", { name: "Add these answers" }).click();
  await completeQuestions(page);
  await page.getByLabel("Clinical update").fill(regressionUpdate);
  await page.getByRole("button", { name: "Review this update" }).click();
  await page.getByRole("article").filter({ hasText: "250 mg" }).getByRole("button", { name: "Accept this update" }).click();
  await page.getByRole("article").filter({ hasText: "13-Aug-2026" }).getByRole("button", { name: "Accept this update" }).click();
  await expect(page.getByText("Earlier: 500 mg", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use 13-Aug-2026" }).click();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("Started: 13-Aug-2026");
  checkpoints.push({ journey: "experiment-1-regression", state: "resolved-output", assertion: "Original identity, correction, conflict resolution, projection, and PDF path remain aligned." });
  await retainScreenshot(page, "experiment-1-regression-output.png");
  await downloadAndCheck(page, "experiment-1-regression", ["TEST-57", "apixaban", "naproxen", "lisinopril", "250 mg", "13-AUG-2026"], ["500 mg"]);

  if (retainEvidence) {
    await writeFile(`${evidenceDirectory}/journey-trace.json`, `${JSON.stringify({
      browser: `Chromium ${browser.version()}`,
      viewportOptions: { viewport: testInfo.project.use.viewport },
      predeterminedApplicationModelCalls: predeterminedModelResponses.length,
      liveApplicationModelCalls: 0,
      interactionSummary: [
        {
          journey: "issue78-identity-recovery", groupedPromptCount: 2, directRepairCount: 2, duplicateQuestionCount: 0,
          observedFriction: "Two exact-evidence identity failures stayed visibly quarantined while one retained product reached reporter entry, explicit output blocking, direct repair, one newly applicable indication, and aligned output without another model call.",
        },
        {
          journey: "layer3-combined", groupedPromptCount: 1, duplicateQuestionCount: 0,
          observedFriction: "The combined report used one selection and understanding review; accepted facts suppressed every clarification except direct reporter entry.",
        },
        {
          journey: "layer3-conditional", groupedPromptCount: 2, duplicateQuestionCount: 0,
          observedFriction: "One attributed device-detail turn grouped implant timing and reprocessor identity before the reporter block.",
        },
        {
          journey: "layer3-correction", groupedPromptCount: 1, correctionReviewCount: 2, duplicateQuestionCount: 0,
          observedFriction: "The later input required two explicit reviews because correction and unresolved alternative target different device facts; no completion question reopened.",
        },
        {
          journey: "layer2-device", groupedPromptCount: 1, duplicateQuestionCount: 0,
          observedFriction: "The rich device case rejected an erroneous test, corrected device operator in the atomic opening review, used one reporter block, and then directly corrected the stable model number without another model call.",
        },
        {
          journey: "layer2-product-quality", groupedPromptCount: 1, duplicateQuestionCount: 0,
          observedFriction: "The sparse product-quality report required one understanding review and the direct reporter block; no patient, outcome, indication, or clinical-context interrogation appeared.",
        },
        {
          journey: "layer1-death", groupedPromptCount: 3, duplicateQuestionCount: 0,
          observedFriction: "The accepted death outcome required one grouped pass over only the remaining outcome flags, then one conditional date turn and the reporter block.",
        },
        {
          journey: "layer1-tests", groupedPromptCount: 1, correctionReviewCount: 1, duplicateQuestionCount: 0,
          observedFriction: "Three accepted tests suppressed the context question; a later ALT correction required one explicit review, and withdrawing bilirubin preserved its history while recomputing the output without reopening completion groups.",
        },
        {
          journey: "layer1-role", groupedPromptCount: 2, correctionReviewCount: 1, duplicateQuestionCount: 0,
          observedFriction: "The role correction required one review and one newly applicable indication turn; outcomes, context, and reporter details did not repeat.",
        },
        {
          journey: "adaptive-rich", groupedPromptCount: 2, duplicateQuestionCount: 0,
          observedFriction: "Age and weight changed in one atomic opening review; discharge, report type, dose, and reporter email then changed directly while accepted facts suppressed duplicate prompts.",
        },
        {
          journey: "adaptive-sparse", groupedPromptCount: 4, duplicateQuestionCount: 0,
          observedFriction: "Tests and history required two explicit dispositions but remained one attributed clinical-context turn.",
        },
      ],
      questionTrace,
      checkpoints,
    }, null, 2)}\n`);
    const retainedReadbacks = retainIssue66Only || retainIssue78Only
      ? Object.fromEntries(Object.entries(readbacks).filter(([journey]) => shouldRetain(journey)))
      : readbacks;
    const retainedPdfs = retainIssue66Only || retainIssue78Only ? pdfs.filter(({ journey }) => shouldRetain(journey)) : pdfs;
    await writeFile(`${evidenceDirectory}/pdf-agreement.json`, `${JSON.stringify({ readbacks: retainedReadbacks, pdfs: retainedPdfs }, null, 2)}\n`);
  }
});

async function submitOpening(page: Page, text: string, reportType: ReportType = "adverse-event") {
  await page.getByLabel("Clinical account").fill(text);
  const adverse = page.getByLabel("Adverse event", { exact: true });
  const problem = page.getByLabel("Product problem", { exact: true });
  if (reportType === "adverse-event") {
    await adverse.check();
    await problem.uncheck();
  } else if (reportType === "product-problem") {
    await adverse.uncheck();
    await problem.check();
  } else {
    await adverse.check();
    await problem.check();
  }
  await page.getByRole("button", { name: "Review Wilson’s understanding" }).click();
  await expect(page.getByRole("heading", { name: "Check Wilson’s understanding" })).toBeVisible();
}

async function newCase(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New case" }).click();
  await expect(page.getByRole("heading", { name: "Describe what happened" })).toBeVisible();
}

function productCard(page: Page, name: string) {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

function productOrCaseCard(page: Page, name: string) {
  return productCard(page, name);
}

async function downloadAndCheck(
  page: Page,
  journey: string,
  included: string[],
  excluded: string[],
  named: Record<string, string> = {},
  absentNamed: string[] = [],
) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download official PDF" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Downloaded PDF had no local path");
  const bytes = await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  });
  expect(bytes.byteLength).toBeGreaterThan(100_000);
  const readback = await independentReadback(path);
  expect(readback.pageCount).toBe(8);
  for (const value of included) expect(readback.fieldValues).toContain(value);
  for (const value of excluded) expect(readback.fieldValues).not.toContain(value);
  expect(readback.namedFields).toMatchObject(named);
  for (const name of absentNamed) expect(readback.namedFields[name]).toBeUndefined();
  readbacks[journey] = readback;
  pdfs.push({ journey, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  if (retainEvidence && shouldRetain(journey)) await writeFile(`${evidenceDirectory}/${journey}.pdf`, bytes);
}

async function semanticCase(page: Page): Promise<BrowserJourneyState["case"]> {
  return page.evaluate(() => {
    const stored = window.sessionStorage.getItem("wilson-journey-state-v2");
    if (!stored) throw new Error("Wilson browser case state was unavailable");
    return (JSON.parse(stored) as BrowserJourneyState).case;
  });
}

async function completeQuestions(page: Page) {
  for (let turn = 0; turn < 6; turn += 1) {
    await page.getByText("Updating the reviewed case…", { exact: true }).waitFor({ state: "hidden" });
    if (await page.getByRole("heading", { name: "The supported form is ready" }).isVisible().catch(() => false)) return;
    if (await page.getByRole("button", { name: "Confirm outcomes" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Confirm outcomes" }).click();
      continue;
    }
    if (await page.getByRole("button", { name: "Add this context" }).isVisible().catch(() => false)) {
      const noTests = page.getByLabel("No relevant tests to add");
      if (await noTests.isVisible().catch(() => false)) await noTests.check();
      const noHistory = page.getByLabel("No relevant history to add");
      if (await noHistory.isVisible().catch(() => false)) await noHistory.check();
      await page.getByRole("button", { name: "Add this context" }).click();
      continue;
    }
    if (await page.getByRole("button", { name: "Prefer not to provide reporter details" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Prefer not to provide reporter details" }).click();
      continue;
    }
    if (await page.getByRole("button", { name: "Unknown" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Unknown" }).click();
      continue;
    }
    throw new Error("Unexpected adaptive completion state");
  }
  throw new Error("Adaptive completion exceeded its bounded prompt count");
}

async function fillReporter(page: Page, input: { firstName: string; lastName: string; phone?: string; email?: string; fullAddress?: boolean }) {
  await page.getByLabel("Reporter first name").fill(input.firstName);
  await page.getByLabel("Reporter last name").fill(input.lastName);
  if (input.phone) await page.getByLabel("Reporter phone").fill(input.phone);
  if (input.email) await page.getByLabel("Reporter email").fill(input.email);
  if (input.fullAddress) {
    await page.getByLabel("Reporter address").fill("100 Test Avenue");
    await page.getByLabel("Reporter city").fill("Seattle");
    await page.getByLabel("Reporter state").fill("WA");
    await page.getByLabel("Reporter postal code").fill("98101");
  }
}

interface IndependentReadback {
  pypdfVersion: string;
  encrypted: boolean;
  pageCount: number;
  fieldValues: string[];
  namedFields: Record<string, string>;
}

async function independentReadback(path: string): Promise<IndependentReadback> {
  const python = process.env.PYPDF_PYTHON ?? "python3";
  const { stdout } = await execFileAsync(python, ["tools/pdf/independent_readback.py", path, "--named"]);
  return JSON.parse(stdout) as IndependentReadback;
}

async function retainScreenshot(page: Page, name: string) {
  if (retainEvidence && shouldRetain(name.replace(/-output\.png$/, ""))) await page.screenshot({ path: `${evidenceDirectory}/${name}`, fullPage: true });
}

async function retainViewportScreenshot(page: Page, name: string) {
  if (retainEvidence && shouldRetain("issue78-identity-recovery")) {
    await page.screenshot({ path: `${evidenceDirectory}/${name}`, fullPage: false });
  }
}

async function assertTaskControlsOperable(page: Page, controls: Locator[]) {
  const task = page.locator("section").filter({ has: page.locator("#task-title") }).first();
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    const [taskBox, controlBox] = await Promise.all([task.boundingBox(), control.boundingBox()]);
    expect(taskBox).not.toBeNull();
    expect(controlBox).not.toBeNull();
    expect(controlBox!.x).toBeGreaterThanOrEqual(taskBox!.x - 1);
    expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(taskBox!.x + taskBox!.width + 1);
    await control.click({ trial: true });
  }
}

async function expectNoDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

function shouldRetain(journey: string): boolean {
  if (retainAdaptiveOnly) return journey.startsWith("adaptive-");
  if (retainLayer1RepresentativeOnly) return journey === "layer1-role";
  if (retainLayer2RepresentativeOnly) return journey === "layer2-device";
  if (retainLayer3RepresentativeOnly) return journey === "layer3-correction";
  if (retainIssue66Only) return ["adaptive-rich", "layer2-device", "layer1-tests-withdrawal"].includes(journey);
  if (retainIssue78Only) return journey === "issue78-identity-recovery";
  return true;
}
