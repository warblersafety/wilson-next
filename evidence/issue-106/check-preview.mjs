// Model-free deployed verification. Supply private share metadata and a previously
// accepted synthetic browser state as local inputs; neither is committed here.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const [sharePath, statePath] = process.argv.slice(2);
if (!sharePath || !statePath) throw new Error('Provide share metadata and synthetic state file paths');
const handoff = JSON.parse(await readFile(sharePath));
const state = JSON.parse(await readFile(statePath));
const directory = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const readState = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('wilson-journey-state-v2')));
const go = (name) => page.getByRole('navigation', { name: 'Report steps' }).getByRole('button', { name: new RegExp(name + '$') }).click();
let modelRequests = 0;
await page.route('**/api/case', async (route) => {
  if (route.request().method() === 'POST' && ['submit-opening', 'submit-update'].includes(route.request().postDataJSON()?.action?.action)) {
    modelRequests++;
    await route.abort();
  } else await route.continue();
});
async function download(name) {
  await go('Review & save');
  await expect(page.getByRole('link', { name: 'Save PDF', exact: true })).toBeVisible({ timeout: 60_000 });
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Save PDF', exact: true }).click();
  const path = directory + name + '.pdf';
  await (await pending).saveAs(path);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', path, '--named']);
  return JSON.parse(stdout).namedFields;
}
try {
  const unsigned = await context.request.get('https://' + handoff.host, { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(unsigned.status());
  const response = await page.goto(handoff.url);
  expect(response.ok()).toBe(true);
  await expect(page.getByLabel('Case description', { exact: true })).toBeVisible();
  await page.evaluate((s) => sessionStorage.setItem('wilson-journey-state-v2', JSON.stringify(s)), state);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Review the case details', exact: true })).toBeVisible();
  const before = await download('preview-before');
  await go('Reporter details');
  const accepted = await readState();
  const privacy = await page.getByLabel('Do not disclose my identity to the manufacturer', { exact: true }).isChecked();
  await page.getByRole('button', { name: 'Use demo reporter details', exact: true }).click();
  expect(await readState()).toEqual(accepted);
  expect(await page.getByLabel('Do not disclose my identity to the manufacturer', { exact: true }).isChecked()).toBe(privacy);
  await expect(page.getByLabel('Reporter email', { exact: true })).toHaveValue('casey.reed@example.test');
  await page.getByRole('button', { name: 'Save reporter details', exact: true }).click();
  const demo = await download('preview-demo-reporter');
  const email = 'topmostSubform[0].Page7[0].SecG_Reporter[0].Email[0]';
  expect([...new Set([...Object.keys(before), ...Object.keys(demo)])].filter((key) => before[key] !== demo[key])).toEqual([email]);
  expect(demo[email]).toBe('casey.reed@example.test');
  await go('Review details');
  const result = page.locator('#case-card-test-2 dl > div').filter({ has: page.getByText('Result and stated units', { exact: true }) });
  await result.getByRole('button', { name: 'Change', exact: true }).click();
  await result.getByLabel('New Result and stated units', { exact: true }).fill('9.7 g/dL');
  await result.getByRole('button', { name: 'Apply correction', exact: true }).click();
  await expect(result).toContainText('9.7 g/dL');
  const corrected = await download('preview-clinical-corrected');
  const delta = [...new Set([...Object.keys(demo), ...Object.keys(corrected)])].filter((key) => demo[key] !== corrected[key]);
  expect(delta).toHaveLength(1);
  expect(corrected[delta[0]]).toMatch(/Hemoglobin.*9\.7 g\/dL/);
  await expect(page.getByRole('status').filter({ hasText: 'PDF ready' })).toBeVisible();
  // Full Chromium renders the native PDF viewer; headless shell does not.
  await expect.poll(() => page.frames().some((frame) => frame.url().startsWith('chrome-extension:'))).toBe(true);
  await page.screenshot({ path: directory + 'preview-pdf-desktop.png', fullPage: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ['Review details', 'Reporter details', 'Review & save']) {
      await go(screen);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      if (screen === 'Reporter details') await page.screenshot({ path: directory + `preview-reporter-${width}.png`, fullPage: true });
    }
  }
  expect(modelRequests).toBe(0);
  const resultRecord = {
    verifiedAt: new Date().toISOString(), sha: handoff.sha, deployment: handoff.deployment,
    unsignedStatus: unsigned.status(), shareAccess: 'passed', modelRequests,
    method: 'Resumed previously accepted synthetic issue-103 case. Real deployed actions and PDFs; no interpretation call.',
    demoDraftOnly: true, privacyRetained: true, reporterOnlyChanged: [email], clinicalOnlyChanged: delta,
    unchangedFieldCount: Object.keys(corrected).length - 1,
    desktopAndMobileOverflow: false, nativePdfViewer: true,
  };
  await writeFile(directory + 'preview-results.json', JSON.stringify(resultRecord, null, 2) + '\n');
  console.log(JSON.stringify(resultRecord));
} finally { await browser.close(); }
