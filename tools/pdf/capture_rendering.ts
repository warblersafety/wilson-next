import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
if (!executablePath) {
  throw new Error("CHROMIUM_EXECUTABLE_PATH is required");
}

const pdfUrl = pathToFileURL(resolve("evidence/slice-0/filled-form.pdf")).href;
const capturedPages = [1, 2, 4, 5];
const results = [];
let version = "";

for (const pageNumber of capturedPages) {
  const browser = await chromium.launch({ headless: true, executablePath });
  version ||= browser.version();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(`${pdfUrl}#page=${pageNumber}&zoom=80`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(2_000);

    const html = await page.content();
    if (!html.includes("pdf_embedder.css")) {
      throw new Error(`Chromium PDF viewer did not load page ${pageNumber}`);
    }

    const screenshot = `evidence/slice-0/chromium-page-${pageNumber}.png`;
    await page.screenshot({ path: screenshot });
    results.push({ page: pageNumber, screenshot, viewerLoaded: true });
  } finally {
    await browser.close();
  }
}

const result = {
  chromiumVersion: version,
  viewport: { width: 1440, height: 900 },
  zoomPercent: 80,
  source: "evidence/slice-0/filled-form.pdf",
  capturedPages: results,
  manualInspectionRequired: [
    "No password prompt is visible",
    "FDA/Form 3500 identity is preserved",
    "Representative text, multiline, choice, checkbox, and both product rows render",
  ],
};

await writeFile(
  "evidence/slice-0/chromium-result.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
