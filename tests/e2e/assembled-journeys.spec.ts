import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import {
  regressionOpening,
  regressionUpdate,
  adaptiveRichOpening,
  adaptiveSparseOpening,
  repeatedOpening,
  repeatedUpdate,
  richOpening,
  sparseOpening,
} from "./build-predetermined-responses";

const execFileAsync = promisify(execFile);
const retainEvidence = process.env.WILSON_RETAIN_STAGE3_EVIDENCE === "1";
const evidenceDirectory = process.env.WILSON_STAGE3_EVIDENCE_DIRECTORY ?? "evidence/experiment-2/stage-3";
const retainAdaptiveOnly = evidenceDirectory.includes("issue-57");
const readbacks: Record<string, IndependentReadback> = {};
const checkpoints: Array<{ journey: string; state: string; assertion: string }> = [];
const pdfs: Array<{ journey: string; bytes: number; sha256: string }> = [];
const questionTrace: Array<{ journey: string; question: string; reason: string; answer: string }> = [];

test("runs adaptive completion plus all Experiment 1 and 2 deterministic regressions through one assembled desktop path", async ({ page, browser }, testInfo) => {
  if (retainEvidence) await mkdir(evidenceDirectory, { recursive: true });

  const initial = await page.goto("/");
  expect(initial?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.getByRole("heading", { name: "Describe what happened" })).toBeVisible();
  await expect(page.getByLabel("Experiment boundary")).toContainText("Fictional information only");

  await submitOpening(page, adaptiveRichOpening);
  await expect(productOrCaseCard(page, "Patient")).toContainText("64 kg");
  await expect(productOrCaseCard(page, "Relevant test 1")).toContainText("Serum tryptase: 18 ng/mL");
  await expect(productOrCaseCard(page, "Event")).toContainText("Penicillin allergy");
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "Hospitalization is already recorded. Did any other serious outcomes apply?" })).toBeVisible();
  await expect(page.getByLabel("Hospitalization (initial or prolonged) — already recorded")).toBeChecked();
  await expect(page.getByLabel("Life-threatening — already recorded")).toBeChecked();
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
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("Serum tryptase: 18 ng/mL");
  checkpoints.push({ journey: "adaptive-rich", state: "output", assertion: "Accepted weight, outcomes, test, history, and product facts suppressed duplicate asks; only two grouped prompts remained." });
  await retainScreenshot(page, "adaptive-rich-output.png");
  await downloadAndCheck(page, "adaptive-rich", ["TEST-72", "64", "amoxicillin", "Serum tryptase: 18 ng/mL", "Penicillin allergy", "Avery", "Chen"], [], {
    "topmostSubform[0].Page1[0].SecA_Patient[0].WeightKG[0]": "/1",
    "topmostSubform[0].Page1[0].SecA_Patient[0].LifeThreaten[0]": "/1",
    "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TLowRange1[0]": "0 ng/mL",
    "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].THighRange1[0]": "11.4 ng/mL",
    "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TDate1[0]": "03-SEP-2026",
    "topmostSubform[0].Page7[0].SecG_Reporter[0].IdentityNo[0]": "/1",
    "topmostSubform[0].Page7[0].SecG_Reporter[0].Packer[0]": "/1",
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
  await expect(page.locator("li").filter({ hasText: "Relevant history: declined" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Address: explicitly absent" })).toBeVisible();
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
  await ageRow.getByRole("button", { name: "Apply change" }).click();
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
      predeterminedApplicationModelCalls: 9,
      liveApplicationModelCalls: 0,
      interactionSummary: [
        {
          journey: "adaptive-rich", groupedPromptCount: 2, duplicateQuestionCount: 0,
          observedFriction: "The reporter block was the longest turn; all accepted clinical facts suppressed duplicate prompts.",
        },
        {
          journey: "adaptive-sparse", groupedPromptCount: 4, duplicateQuestionCount: 0,
          observedFriction: "Tests and history required two explicit dispositions but remained one attributed clinical-context turn.",
        },
      ],
      questionTrace,
      checkpoints,
    }, null, 2)}\n`);
    await writeFile(`${evidenceDirectory}/pdf-agreement.json`, `${JSON.stringify({ readbacks, pdfs }, null, 2)}\n`);
  }
});

async function submitOpening(page: Page, text: string) {
  await page.getByLabel("Clinical account").fill(text);
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

async function downloadAndCheck(page: Page, journey: string, included: string[], excluded: string[], named: Record<string, string> = {}) {
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
  readbacks[journey] = readback;
  pdfs.push({ journey, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  if (retainEvidence && (!retainAdaptiveOnly || journey.startsWith("adaptive-"))) await writeFile(`${evidenceDirectory}/${journey}.pdf`, bytes);
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
  if (retainEvidence && (!retainAdaptiveOnly || name.startsWith("adaptive-"))) await page.screenshot({ path: `${evidenceDirectory}/${name}`, fullPage: true });
}
