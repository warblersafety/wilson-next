// Resumes the deterministic regression's pending synthetic case on the protected
// deployment. No model call; private share URL and state are local inputs only.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const [sharePath, statePath] = process.argv.slice(2);
if (!sharePath || !statePath) throw new Error('Provide private share metadata and pending synthetic state');
const share = JSON.parse(await readFile(sharePath));
const pending = JSON.parse(await readFile(statePath));
const directory = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const state = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('wilson-journey-state-v2')));
const go = name => page.getByRole('navigation', { name: 'Report steps' }).getByRole('button', { name: new RegExp(name + '$') }).click();
let interpretationRequests = 0;
await page.route('**/api/case', async route => {
  if (route.request().method() === 'POST' && ['submit-opening', 'submit-update'].includes(route.request().postDataJSON()?.action?.action)) {
    interpretationRequests++;
    await route.abort();
  } else await route.continue();
});
try {
  const unsigned = await context.request.get('https://' + share.host, { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(unsigned.status());
  expect((await page.goto(share.url)).ok()).toBe(true);
  await expect(page.getByLabel('Case description', { exact: true })).toBeVisible();
  await page.evaluate(s => sessionStorage.setItem('wilson-journey-state-v2', JSON.stringify(s)), pending);
  await page.reload();
  await go('Review details');
  const accepts = page.getByRole('button', { name: 'Accept this update', exact: true });
  await expect(accepts).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Accept Relevant test 1', exact: true })).toHaveCount(0);
  await page.screenshot({ path: directory + 'preview-separate-groups.png', fullPage: true });
  await page.locator('article').filter({ has: page.getByRole('heading', { name: /Stopped/ }) }).getByRole('button', { name: 'Accept this update', exact: true }).click();
  await expect(accepts).toHaveCount(1);
  expect((await state()).case.event.facts.relevantHistory.resolvedValue).toBeUndefined();
  expect((await state()).case.products[0].facts.stopped.resolvedValue.value).toEqual({ kind: 'known', value: true });
  await accepts.click();
  for (const n of [1, 2]) {
    const button = page.getByRole('button', { name: `Accept Relevant test ${n}`, exact: true });
    await button.click();
    await expect(button).toHaveCount(0);
  }
  await go('Review & save');
  await expect(page.getByRole('button', { name: 'Generate PDF', exact: true })).toBeDisabled();
  await go('Reporter details');
  await page.getByRole('button', { name: 'Use demo reporter details', exact: true }).click();
  await page.getByLabel('Date of this report', { exact: true }).fill('2026-09-23');
  await page.getByLabel('Do not disclose my identity to the manufacturer', { exact: true }).check();
  await page.getByRole('button', { name: 'Add reporter details', exact: true }).click();
  await go('Review & save');
  await expect(page.getByRole('link', { name: 'Save PDF', exact: true })).toBeVisible({ timeout: 60_000 });
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Save PDF', exact: true }).click();
  const pdf = directory + 'preview-accepted.pdf';
  await (await download).saveAs(pdf);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', pdf, '--named']);
  const fields = JSON.parse(stdout).namedFields;
  expect(fields).toEqual(JSON.parse(await readFile(directory + 'pdf-readback.json')).namedFields);
  expect(interpretationRequests).toBe(0);
  const result = { verifiedAt: new Date().toISOString(), sha: share.sha, deployment: share.deployment,
    unsignedStatus: unsigned.status(), anonymousShareAccess: true, interpretationRequests,
    separateMedicationHistoryAcceptance: true, separateTestAcceptance: true, reporterGateRetained: true,
    pdfMatchesLocalIndependentReadback: true, namedFieldCount: Object.keys(fields).length,
    method: 'Resumed deterministic pending case; actual deployed acceptance actions and PDF. Boundary replay covered locally and in CI, not by a live provider call.' };
  await writeFile(directory + 'preview-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
