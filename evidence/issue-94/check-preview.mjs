// Final protected deployment check. Reuses retained synthetic state, never calls
// interpretation; exercises real acceptance, correction and PDF endpoints.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const [shareFile, pendingFile, qualifiedFile] = process.argv.slice(2);
const share = JSON.parse(await readFile(shareFile));
const pending = JSON.parse(await readFile(pendingFile));
const qualified = JSON.parse(await readFile(qualifiedFile)).state;
const directory = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch(); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
const state = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('wilson-journey-state-v2')));
const go = name => page.getByRole('navigation', { name: 'Report steps' }).getByRole('button', { name: new RegExp(name + '$') }).click();
let interpretationRequests = 0;
await page.route('**/api/case', async route => {
  if (route.request().method() === 'POST' && ['submit-opening','submit-update'].includes(route.request().postDataJSON()?.action?.action)) { interpretationRequests++; await route.abort(); }
  else await route.continue();
});
try {
  const unsigned = await context.request.get('https://' + share.host, { maxRedirects: 0 }); expect([302,307,401]).toContain(unsigned.status());
  expect((await page.goto(share.url)).ok()).toBe(true);
  await expect(page.getByLabel('Case description', { exact: true })).toBeVisible();
  const origin = new URL(page.url()).origin;
  const post = (path, body) => context.request.post(origin + path, { headers: { Origin: origin }, data: body });
  async function pdf(name, s = undefined) {
    const response = await post('/api/case/pdf', { mode: 'download', state: s ?? await state() }); expect(response.status()).toBe(200);
    const file = directory + name + '.pdf'; await writeFile(file, await response.body());
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', file, '--named']);
    return JSON.parse(stdout).namedFields;
  }
  async function uiAction(click) {
    const next = page.waitForResponse(r => r.url().endsWith('/api/case') && r.request().method() === 'POST');
    await click(); expect((await next).ok()).toBe(true);
    await expect(page.getByRole('button', { name: 'New case', exact: true })).toBeEnabled();
  }
  await page.evaluate(s => sessionStorage.setItem('wilson-journey-state-v2', JSON.stringify(s)), pending);
  await page.reload(); await go('Review details');
  await expect(page.locator('dd').filter({ hasText: 'two tablets, a total dose of 500 mg' })).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: /^abdominal pain/ })).toBeVisible();
  await expect(page.locator('dt').filter({ hasText: /^Product problem$/ })).toHaveCount(0);
  const blockedPdf = await post('/api/case/pdf', { mode: 'download', state: await state() }); expect(blockedPdf.status()).toBe(409);
  await uiAction(() => page.getByRole('button', { name: 'Accept Event', exact: true }).click());
  expect((await state()).case.products[0].facts.dose.resolvedValue).toBeUndefined();
  for (const name of ['Patient','naproxen']) await uiAction(() => page.getByRole('button', { name: 'Accept ' + name, exact: true }).click());
  await page.screenshot({ path: directory + 'preview-symptom-dose.png', fullPage: true });
  let data = await (await post('/api/case', { operation: 'resume', state: await state() })).json();
  const reporter = { action: 'answer-reporter', reportDate: '2026-09-23', reporter: { kind: 'provided', firstName: 'Casey', lastName: 'Reed', email: 'casey.reed@example.test', healthProfessional: true, occupation: 'Physician', reportedTo: [], doNotDiscloseIdentity: true } };
  expect((await post('/api/case', { operation: 'act', state: data.state, expectedRevision: data.state.case.revision, action: reporter })).status()).toBe(400);
  for (let n=0; n<12 && !data.snapshot.downloadReady; n++) {
    const q = data.snapshot.clarification; let action;
    if (q?.kind === 'serious-outcomes') action = { action: 'answer-serious-outcomes', selected: [], disposition: 'unknown' };
    else if (q?.kind === 'clinical-context') action = { action: 'answer-clinical-context', ...(q.askTests ? { test: { kind: 'unknown' } } : {}), ...(q.askHistory ? { history: { kind: 'unknown' } } : {}) };
    else if (q?.kind === 'medication-history') action = { action: 'answer-medication-history', productId: q.productId, answers: Object.fromEntries(q.targetIds.map(t => [t.split(':')[2], { kind: 'unknown' }])) };
    else if (q?.kind === 'reporter') action = reporter;
    else throw Error('Unexpected completion need ' + q?.kind);
    const response = await post('/api/case', { operation: 'act', state: data.state, expectedRevision: data.state.case.revision, action }); expect(response.status()).toBe(200); data = await response.json();
  }
  expect(data.snapshot.downloadReady).toBe(true);
  const tablets = await pdf('preview-tablets', data.state);
  expect(tablets).toEqual(JSON.parse(await readFile(directory + 'retained-tablets-replay-readback.json')).namedFields);

  await page.evaluate(s => sessionStorage.setItem('wilson-journey-state-v2', JSON.stringify(s)), qualified);
  await page.reload(); await go('Review details');
  await expect(page.locator('dd').filter({ hasText: 'brief episode of muffled hearing (patient is not sure it occurred)' })).toBeVisible();
  const row = page.locator('dt').filter({ hasText: /^Symptoms$/ }).locator('..');
  await row.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByLabel('New Symptoms', { exact: true }).fill('brief episode of muffled hearing in left ear');
  await expect(page.getByLabel('Uncertainty or context for Symptoms', { exact: true })).toHaveValue('patient is not sure it occurred');
  await uiAction(() => page.getByRole('button', { name: 'Apply correction', exact: true }).click());
  await expect(row.locator('dd').first()).toContainText('left ear (patient is not sure it occurred)');
  const doseRow = page.locator('dt').filter({ hasText: /^Dose$/ }).locator('..');
  await doseRow.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByLabel('New Dose', { exact: true }).fill('one tablet, total 40 mg each time');
  await expect(page.getByLabel('Uncertainty or context for Dose', { exact: true })).toHaveValue('reported dose, but medication diary is uncertain');
  await uiAction(() => page.getByRole('button', { name: 'Apply correction', exact: true }).click());
  const withQualifiers = await pdf('preview-qualified');
  const desc = 'topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]';
  const dose = 'topmostSubform[0].Page4[0].Prod1[0].Prod1Dose[0]';
  expect(withQualifiers[desc]).toBe('Symptoms: brief episode of muffled hearing in left ear (patient is not sure it occurred).');
  expect(withQualifiers[dose]).toBe('one tablet, total 40 mg each time (reported dose, but medication diary is uncertain)');
  await page.screenshot({ path: directory + 'preview-qualified-review.png', fullPage: true });
  await row.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByLabel('Uncertainty or context for Symptoms', { exact: true }).fill('');
  await expect(page.getByLabel('Uncertainty or context for Symptoms', { exact: true })).toBeVisible();
  await page.getByLabel('Uncertainty or context for Symptoms', { exact: true }).pressSequentially('patient is not sure it occurred');
  await expect(page.getByLabel('Uncertainty or context for Symptoms', { exact: true })).toHaveValue('patient is not sure it occurred');
  await page.getByLabel('Uncertainty or context for Symptoms', { exact: true }).fill('');
  await uiAction(() => page.getByRole('button', { name: 'Apply correction', exact: true }).click());
  await expect(row.locator('dd').first()).not.toContainText('patient is not sure');
  const withoutQualifier = await pdf('preview-unqualified');
  expect(withoutQualifier[desc]).toBe('Symptoms: brief episode of muffled hearing in left ear.');
  expect(Object.keys({ ...withQualifiers, ...withoutQualifier }).filter(k => withQualifiers[k] !== withoutQualifier[k])).toEqual([desc]);
  expect((await state()).case.event.facts.symptoms.supersededValues.some(v => v.value.kind === 'known' && v.value.qualifier)).toBe(true);
  expect(interpretationRequests).toBe(0);
  const result = { verifiedAt: new Date().toISOString(), sha: share.sha, deployment: share.deployment, unsignedStatus: unsigned.status(), anonymousShareAccess: true, interpretationRequests,
    separateSymptomMedicationAcceptance: true, pendingPdfBlocked: true, reporterReadinessRetained: true, replayPdfMatchesAllIndependentLocalFields: true, matchedFieldCount: Object.keys(tablets).length,
    symptomAndDoseEditsPreserveQualifiers: true, qualifierRemovalExplicit: true, qualifierReplacementControlStable: true, removalChangesOnlyNarrativePdfField: true, supersededQualifierRetained: true,
    method: 'Resumed retained synthetic states; actual deployed UI actions and PDF. Exact raw provider-boundary replay covered by deterministic tests; no live model retry.' };
  await writeFile(directory + 'preview-results.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile(directory + 'preview-readbacks.json', JSON.stringify({ tablets, withQualifiers, withoutQualifier }, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
