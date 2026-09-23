// Reuse retained accepted states to verify review-remediation output disclosure.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const [shareFile, stateDirectory] = process.argv.slice(2);
const share = JSON.parse(await readFile(shareFile));
const directory = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
let interpretationRequests = 0;
await page.route('**/api/case', async route => {
  if (route.request().method() === 'POST' && ['submit-opening', 'submit-update'].includes(route.request().postDataJSON()?.action?.action)) {
    interpretationRequests++; await route.abort();
  } else await route.continue();
});
const results = [];
try {
  expect((await page.goto(share.url)).ok()).toBe(true);
  const origin = new URL(page.url()).origin;
  for (const [id, label, reason] of [
    ['final-denied-defect', 'Product problem: explicitly reported as absent', 'explicitly-absent'],
    ['final-unknown-defect', 'Product problem: unknown', 'unknown'],
    ['final-unmentioned-defect', undefined, 'empty'],
    ['ambiguous-dose', 'Symptoms: unresolved conflict', 'conflicted'],
  ]) {
    const state = JSON.parse(await readFile(`${stateDirectory}/${id}-accepted.json`)).state;
    await page.evaluate(s => sessionStorage.setItem('wilson-journey-state-v2', JSON.stringify(s)), state);
    await page.reload();
    await page.getByRole('navigation', { name: 'Report steps' }).getByRole('button', { name: /Review & save$/ }).click();
    await page.getByText('Report coverage and omitted information', { exact: true }).click();
    if (label) await expect(page.getByText(label, { exact: true })).toBeVisible();
    else await expect(page.locator('li').filter({ hasText: /^Product problem:/ })).toHaveCount(0);
    const resume = await context.request.post(origin + '/api/case', { headers: { Origin: origin }, data: { operation: 'resume', state } });
    expect(resume.ok()).toBe(true);
    const snapshot = (await resume.json()).snapshot;
    expect(snapshot.projection.omissions).toContainEqual(expect.objectContaining({ target: id === 'ambiguous-dose' ? 'event:event:symptoms' : 'event:event:problemDescription', reason }));
    const pdf = await context.request.post(origin + '/api/case/pdf', { headers: { Origin: origin }, data: { mode: 'download', state } });
    expect(pdf.status()).toBe(200);
    const path = directory + `preview-${id}.pdf`; await writeFile(path, await pdf.body());
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', path, '--named']);
    const fields = JSON.parse(stdout).namedFields;
    const narrative = fields['topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]'];
    expect(narrative).toBe(snapshot.projection.sections.B.eventDescription);
    if (id === 'ambiguous-dose') expect(narrative).toBe('Problem detail: packaging problem (possible, undescribed).');
    else expect(narrative).not.toContain('Problem detail:');
    await page.screenshot({ path: directory + `preview-${id}-omissions.png`, fullPage: true });
    results.push({ id, omissionReason: reason, displayedOmission: label ?? null, narrative, namedFields: fields });
  }
  expect(interpretationRequests).toBe(0);
  const result = { verifiedAt: new Date().toISOString(), sha: share.sha, deployment: share.deployment, interpretationRequests, results };
  await writeFile(directory + 'preview-omissions-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ sha: share.sha, cases: results.length, interpretationRequests, passed: true }));
} finally { await browser.close(); }
