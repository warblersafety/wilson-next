import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import {
  regressionOpening,
  regressionUpdate,
  repeatedOpening,
  repeatedUpdate,
  richOpening,
  sparseOpening,
} from "./build-predetermined-responses";

const execFileAsync = promisify(execFile);
const retainEvidence = process.env.WILSON_RETAIN_STAGE3_EVIDENCE === "1";
const evidenceDirectory = process.env.WILSON_STAGE3_EVIDENCE_DIRECTORY ?? "evidence/experiment-2/stage-3";
const readbacks: Record<string, IndependentReadback> = {};
const checkpoints: Array<{ journey: string; state: string; assertion: string }> = [];
const pdfs: Array<{ journey: string; bytes: number; sha256: string }> = [];

test("runs the three Experiment 2 journeys and retained Experiment 1 regression through one assembled desktop path", async ({ page, browser }, testInfo) => {
  if (retainEvidence) await mkdir(evidenceDirectory, { recursive: true });

  const initial = await page.goto("/");
  expect(initial?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.getByRole("heading", { name: "Describe what happened" })).toBeVisible();
  await expect(page.getByLabel("Experiment boundary")).toContainText("Fictional information only");

  await submitOpening(page, richOpening);
  await expect(productOrCaseCard(page, "Event")).toContainText("diffuse hives and facial swelling");
  await expect(page.getByText("What was cephalexin being used for?", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Accept the remaining understanding" }).click();
  await expect(page.getByRole("heading", { name: "The supported form is ready" })).toBeVisible();
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("cephalexin");
  await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("diffuse hives and facial swelling");
  checkpoints.push({ journey: "rich", state: "output", assertion: "No follow-up was asked; case and screen include all supported rich facts." });
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
      predeterminedApplicationModelCalls: 7,
      liveApplicationModelCalls: 0,
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

async function downloadAndCheck(page: Page, journey: string, included: string[], excluded: string[]) {
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
  readbacks[journey] = readback;
  pdfs.push({ journey, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  if (retainEvidence) await writeFile(`${evidenceDirectory}/${journey}.pdf`, bytes);
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
  if (retainEvidence) await page.screenshot({ path: `${evidenceDirectory}/${name}`, fullPage: true });
}
