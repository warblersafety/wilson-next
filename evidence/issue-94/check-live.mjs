// Bounded synthetic evaluation on the protected Git preview. No automatic retries.
// Run one predeclared case at a time; recover provider metrics between calls.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('.', import.meta.url));
const [sharePath, id, batch = "live"] = process.argv.slice(2);
const share = JSON.parse(await readFile(sharePath));
if (!['live', 'remediation', 'final'].includes(batch)) throw Error('Unknown batch');
const protocol = JSON.parse(await readFile(directory + batch + '-protocol.json')); 
const spec = protocol.cases.find(c => c.id === id);
if (!spec) throw Error('Unknown predeclared case');
const resultsPath = directory + batch + '-results.json';
let results;
try { results = JSON.parse(await readFile(resultsPath)); }
catch { results = { sha: share.sha, deployment: share.deployment, startedAt: new Date().toISOString(), cases: [] }; }
if (results.cases.some(c => c.id === id)) throw Error('Already exposed; no retry');
const spent = results.cases.reduce((n, c) => n + (c.metrics?.estimatedCostUsd ?? protocol.reservationPerCallUsd), 0);
if (spent + protocol.reservationPerCallUsd > protocol.maxCostUsd || results.cases.length >= protocol.maxCalls) throw Error('Call/spend cap; recover metrics first');
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const save = () => writeFile(resultsPath, JSON.stringify(results, null, 2) + '\n');
let row;
try {
  const unsigned = await context.request.get('https://' + share.host, { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(unsigned.status());
  expect((await page.goto(share.url)).ok()).toBe(true);
  await expect(page.getByLabel('Case description', { exact: true })).toBeVisible();
  const origin = new URL(page.url()).origin;
  async function post(path, body) {
    return context.request.post(origin + path, { headers: { Origin: origin }, data: body, timeout: 300000 });
  }
  let data = spec.parent
    ? JSON.parse(await readFile(directory + spec.parent + '-accepted.json'))
    : await (await context.request.get(origin + '/api/case')).json();
  async function act(action) {
    const response = await post('/api/case', { operation: 'act', state: data.state, expectedRevision: data.state.case.revision, action });
    const body = await response.json();
    if (['submit-opening', 'submit-update'].includes(action.action)) row.operationId = response.headers()['x-wilson-operation-id'];
    if (!response.ok()) throw Error(`Case API ${response.status()} ${body.code}; operation ${response.headers()['x-wilson-operation-id']}`);
    data = body;
    return response;
  }
  const before = structuredClone(data);
  row = { id, sha: share.sha, deployment: share.deployment, exposedAt: new Date().toISOString(), expected: spec.expected, unsignedStatus: unsigned.status(), anonymousShareAccess: true };
  results.cases.push(row); await save();
  const response = await act({ action: spec.parent ? 'submit-update' : 'submit-opening', text: spec.text, ...(!spec.parent ? { reportType: spec.reportType } : {}) });
  row.operationId = response.headers()['x-wilson-operation-id'];
  row.stage = data.snapshot.stage; row.unrepresented = data.snapshot.unrepresented;
  await writeFile(directory + id + '-proposed.json', JSON.stringify(data, null, 2) + '\n');
  row.pendingDownloadReady = data.snapshot.downloadReady;
  expect(data.snapshot.downloadReady).toBe(false);
  const gated = await post('/api/case/pdf', { mode: 'download', state: data.state });
  expect(gated.status()).toBe(409); row.pendingPdfBlocked = true;
  if (spec.parent) {
    function acceptedFacts(c) { return [c.patient, c.event, ...c.products, ...c.relevantTests].map(e => ({ id: e.id, facts: Object.fromEntries(Object.entries(e.facts).map(([k,f]) => [k, f.resolvedValue])) })); }
    expect(acceptedFacts(data.state.case)).toEqual(acceptedFacts(before.state.case));
    row.acceptedFactsRetainedWhilePending = true;
  }
  row.acceptanceActions = [];
  for (let n = 0; n < 20 && ['understanding', 'review-update'].includes(data.snapshot.stage); n++) {
    const groupId = data.snapshot.stage === 'understanding' ? data.snapshot.openingGroups[0] : data.snapshot.review.attention.find(a => a.groupId)?.groupId;
    if (!groupId) throw Error('No reviewable group');
    const action = data.snapshot.stage === 'understanding' ? { action: 'review-opening-group', groupId, corrections: [] } : { action: 'review-update-group', groupId, decision: 'accept' };
    row.acceptanceActions.push(action); await act(action);
  }
  await writeFile(directory + id + '-reviewed.json', JSON.stringify(data, null, 2) + '\n');
  row.completionActions = [];
  for (let n = 0; n < 20 && data.snapshot.stage !== 'output'; n++) {
    const q = data.snapshot.clarification;
    let action;
    if (q?.kind === 'indications') action = { action: 'answer-indications', answers: q.productIds.map(productId => ({ productId, value: { kind: 'unknown' } })) };
    else if (q?.kind === 'serious-outcomes') action = { action: 'answer-serious-outcomes', selected: [], disposition: 'unknown' };
    else if (q?.kind === 'clinical-context') action = { action: 'answer-clinical-context', ...(q.askTests ? { test: { kind: 'unknown' } } : {}), ...(q.askHistory ? { history: { kind: 'unknown' } } : {}) };
    else if (q?.kind === 'medication-history') action = { action: 'answer-medication-history', productId: q.productId, answers: Object.fromEntries(q.targetIds.map(t => [t.split(':')[2], { kind: 'unknown' }])) };
    else if (q?.kind === 'reporter') action = { action: 'answer-reporter', reportDate: '2026-09-23', reporter: { kind: 'provided', firstName: 'Casey', lastName: 'Reed', healthProfessional: true, occupation: 'Physician', reportedTo: [], doNotDiscloseIdentity: true, email: 'casey.reed@example.test' } };
    else throw Error('Unhandled completion ' + q?.kind);
    row.completionActions.push(action); await act(action);
  }
  expect(data.snapshot.downloadReady).toBe(true);
  await writeFile(directory + id + '-accepted.json', JSON.stringify(data, null, 2) + '\n');
  const pdf = await post('/api/case/pdf', { mode: 'download', state: data.state });
  expect(pdf.status()).toBe(200);
  await writeFile(directory + id + '.pdf', await pdf.body());
  row.downloaded = true; row.finishedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({ id, operationId: row.operationId, unrepresented: row.unrepresented, downloaded: row.downloaded }));
} catch (error) {
  if (row) { row.failure = error.message; await save(); }
  console.error(error.message); process.exitCode = 1;
} finally { await browser.close(); }
