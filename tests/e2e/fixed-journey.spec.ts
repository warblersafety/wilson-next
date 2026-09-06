import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const retainEvidence = process.env.WILSON_RETAIN_EVIDENCE === "1";
const evidenceDirectory = process.env.WILSON_EVIDENCE_DIRECTORY ?? "evidence/slice-2";

test("completes the seven-state fixed journey and downloads the checked form", async ({ page, browser }) => {
  const journeyTrace: Array<{ state: string; assertion: string }> = [];

  if (retainEvidence) {
    await mkdir(evidenceDirectory, { recursive: true });
  }

  const initialResponse = await page.goto("/");
    expect(initialResponse?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page.getByRole("heading", { name: "Describe what happened" })).toBeVisible();
    await expect(page.getByLabel("Experiment boundary")).toContainText("Do not use it for a real report");
    journeyTrace.push({ state: "describe", assertion: "Synthetic-use boundary and fixed account are visible." });
    const caseResponse = await page.request.get("/api/case");
    expect(caseResponse.headers()["cache-control"]).toContain("no-store");

    await page.getByRole("button", { name: "Review Wilson’s understanding" }).click();
    await expect(page.getByRole("heading", { name: "Check Wilson’s understanding" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "apixaban" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "naproxen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "lisinopril" })).toBeVisible();
    await expect(page.getByText("Suspect product", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Other product", { exact: true })).toHaveCount(1);
    journeyTrace.push({ state: "understanding", assertion: "Two suspect products and one other product are visible for review." });
    await retainScreenshot(page, "understanding.png");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Check Wilson’s understanding" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Restored this tab’s disposable synthetic preview state");
    journeyTrace.push({ state: "understanding-reload", assertion: "The same tab restored the complete extraction state." });

    await page.getByRole("button", { name: "Continue with this understanding" }).click();
    await expect(page.getByRole("heading", { name: "What was apixaban being used for, and what was naproxen being used for?" })).toBeVisible();
    await expect(page.getByText("one useful question", { exact: false })).toHaveCount(1);
    journeyTrace.push({ state: "clarify", assertion: "The single authored indication question is visible." });

    await page.getByRole("button", { name: "Add this answer" }).click();
    await expect(page.getByRole("heading", { name: "Add the later correction and contradiction" })).toBeVisible();
    journeyTrace.push({ state: "update", assertion: "The fixed later account is ready to submit." });

    await page.getByRole("button", { name: "Review this update" }).click();
    await expect(page.getByRole("heading", { name: "Review the correction and date conflict" })).toBeVisible();
    await expect(page.getByText("500 mg", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("250 mg", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("medication administration record lists apixaban starting 13-Aug-2026", { exact: false }).first()).toBeVisible();
    journeyTrace.push({ state: "correct", assertion: "The dose correction and both dated sources are visible separately." });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Review the correction and date conflict" })).toBeVisible();
    await expect(page.getByText("500 mg", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("250 mg", { exact: true }).first()).toBeVisible();
    journeyTrace.push({ state: "correct-reload", assertion: "The same tab restored the correction and conflict proposals." });

    await page.getByRole("button", { name: "Accept 250 mg correction" }).click();
    await expect(page.getByRole("heading", { name: "Naproxen is now 250 mg" })).toBeVisible();
    await expect(page.getByText("Earlier: 500 mg", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Keep both dates unresolved for now" }).click();
    await expect(page.getByRole("heading", { name: "Inspect what the form can include" })).toBeVisible();
    await expect(page.getByText("Apixaban start date is omitted until one source is selected.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Download official PDF" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Open PDF preview" })).toHaveCount(0);
    const unresolvedState = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v1")!));
    const unresolvedPdf = await page.request.post("/api/case/pdf", {
      headers: { origin: new URL(page.url()).origin },
      data: { mode: "preview", state: unresolvedState },
    });
    expect(unresolvedPdf.status()).toBe(409);
    expect(unresolvedPdf.headers()["cache-control"]).toContain("no-store");
    await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("Omitted — conflicting sources");
    journeyTrace.push({ state: "output-unresolved", assertion: "The conflicted date is omitted and PDF download is disabled." });
    await retainScreenshot(page, "unresolved-output.png");

    await page.getByRole("button", { name: "Use 13-Aug-2026" }).click();
    await expect(page.getByRole("heading", { name: "The reviewed form is ready" })).toBeVisible();
    await expect(page.getByText("Apixaban start date 13-Aug-2026")).toBeVisible();
    await expect(page.getByText("Nothing in the fixed journey.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open PDF preview" })).toBeVisible();
    await expect(page.locator('[aria-label="Form FDA 3500 preview"]')).toContainText("Started: 13-Aug-2026");
    journeyTrace.push({ state: "output-resolved", assertion: "The selected date is reflected in review and preview." });
    await retainScreenshot(page, "final-output.png");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download official PDF" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    const bytes = await download.createReadStream().then(async (stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    });
    expect(bytes.byteLength).toBeGreaterThan(100_000);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Reset synthetic preview" }).click();
    await expect(page.getByRole("heading", { name: "Describe what happened" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("disposable synthetic preview was reset");
    if (retainEvidence) {
      await writeFile(`${evidenceDirectory}/checked-form.pdf`, bytes);
      await writeFile(`${evidenceDirectory}/journey-result.json`, `${JSON.stringify({
        browser: `Chromium ${browser.version()}`,
        node: process.version,
        viewport: { width: 1440, height: 900 },
        states: 7,
        downloadedFilename: download.suggestedFilename(),
        pdfBytes: bytes.byteLength,
        pdfSha256: createHash("sha256").update(bytes).digest("hex"),
      }, null, 2)}\n`);
      await writeFile(`${evidenceDirectory}/journey-trace.json`, `${JSON.stringify({
        kind: "sanitized deterministic checkpoint trace",
        browserStorageCaptured: false,
        sameTabStorageExercised: true,
        checkpoints: journeyTrace,
      }, null, 2)}\n`);
    }
});

test("truthfully changes and removes supported understanding groups", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Describe what happened" })).toBeVisible();
  await page.getByRole("button", { name: "Review Wilson’s understanding" }).click();
  await expect(page.getByRole("heading", { name: "Check Wilson’s understanding" })).toBeVisible();

  await page.getByRole("button", { name: "Change age to 58" }).click();
  const patientCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Patient" }) });
  await expect(patientCard).toContainText("58");
  await expect(patientCard.getByRole("button", { name: "Change age to 58" })).toHaveCount(0);

  await page.getByRole("button", { name: "Remove lisinopril" }).click();
  await expect(page.getByRole("heading", { name: "lisinopril" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove lisinopril" })).toHaveCount(0);

  await page.getByRole("button", { name: "Continue with this understanding" }).click();
  await page.getByRole("button", { name: "Add this answer" }).click();
  await page.getByRole("button", { name: "Review this update" }).click();
  await page.getByRole("button", { name: "Accept 250 mg correction" }).click();
  await page.getByRole("button", { name: "Use 13-Aug-2026" }).click();
  await expect(page.getByRole("heading", { name: "The reviewed form is ready" })).toBeVisible();
  await expect(page.getByText("Patient TEST-57, age 58, female")).toBeVisible();
  await expect(page.getByText("Lisinopril as a concomitant product")).toHaveCount(0);
  const preview = page.locator('[aria-label="Form FDA 3500 preview"]');
  await expect(preview).toContainText("58 years");
  await expect(preview).not.toContainText("lisinopril");
});

async function retainScreenshot(page: import("@playwright/test").Page, name: string) {
  if (retainEvidence) await page.screenshot({ path: `${evidenceDirectory}/${name}`, fullPage: true });
}
