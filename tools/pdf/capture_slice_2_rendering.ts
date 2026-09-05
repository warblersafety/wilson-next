import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? chromium.executablePath();
const pdfUrl = pathToFileURL(resolve("evidence/slice-2/checked-form.pdf")).href;
const capturedPages = [1, 2, 3, 4, 5, 6];
const results = [];
let version = "";

for (const pageNumber of capturedPages) {
  const browser = await chromium.launch({ headless: true, executablePath });
  version ||= browser.version();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${pdfUrl}#page=${pageNumber}&zoom=80`, { waitUntil: "load" });
    await page.waitForTimeout(1_000);
    if (!(await page.content()).includes("pdf_embedder.css")) {
      throw new Error(`Chromium PDF viewer did not load page ${pageNumber}`);
    }
    const screenshot = `evidence/slice-2/pdf-page-${pageNumber}.png`;
    await page.screenshot({ path: screenshot });
    results.push({ page: pageNumber, screenshot, viewerLoaded: true });
  } finally {
    await browser.close();
  }
}

await writeFile("evidence/slice-2/pdf-rendering-result.json", `${JSON.stringify({
  chromiumVersion: version,
  viewport: { width: 1440, height: 900 },
  zoomPercent: 80,
  source: "evidence/slice-2/checked-form.pdf",
  capturedPages: results,
  manualInspectionRequired: [
    "No password prompt or corruption is visible",
    "FDA, MedWatch, Form 3500, OMB expiry, and page identity are preserved",
    "Sections A, B, D, and F agree with the final reviewed synthetic case",
    "The superseded 500 mg dose and 12-Aug-2026 date do not appear as active values",
  ],
}, null, 2)}\n`);
