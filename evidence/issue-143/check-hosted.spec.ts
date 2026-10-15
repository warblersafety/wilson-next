import { test,expect,chromium,type BrowserContext,type Page } from '@playwright/test';
import { readFile,writeFile,mkdtemp,rm,stat,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
const evidenceDirectory=process.env.WILSON_HOSTED_EVIDENCE_DIR ?? '/tmp/wilson-hosted-evidence';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { productCapacityCase } from '../../tests/fixtures/product-capacity.ts';
import { InMemoryCaseRepository } from '../../src/server/case/repository.ts';
import { getJourneySnapshot } from '../../src/server/journey/service.ts';
import { journeyResponse } from '../../src/server/case/browser-state.ts';
import { initialUiDrafts,draftRecordKey } from '../../src/browser/ui-drafts.ts';
import { workspaceInput } from '../../src/browser/workspace-state.ts';

const handoffPath=process.env.WILSON_PREVIEW_HANDOFF_PATH;
const saved=(page:Page)=>expect(page.getByRole('region',{name:'Browser saving'}).getByRole('status')).toHaveText('Saved in this browser');
const profileBox=(page:Page)=>page.getByRole('region',{name:'Remembered fictional reporter details'});
const go=(page:Page,name:string)=>page.getByRole('navigation',{name:'Report steps'}).getByRole('button',{name:new RegExp(name+'$')}).click();
const state=(page:Page)=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('wilson-current-case-debug-v1')!));
async function native(page:Page,name:string,store:string,key:string,value?:unknown){
 return page.evaluate(async({name,store,key,value})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Native open failed'));});
  try{return await new Promise<any>((resolve,reject)=>{const tx=db.transaction(store,value===undefined?'readonly':'readwrite'),s=tx.objectStore(store),r=value===undefined?s.get(key):s.put(value,key);let result:unknown;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(new Error('Native transaction aborted'));});}finally{db.close();}
 },{name,store,key,value});
}

test('protected hosted provenance, real restart, reporter lifecycle, tab handoff and PDF are model-free',async()=>{
 expect(handoffPath,'Provide an owner-only approved preview handoff path').toBeTruthy();const handoffStat=await stat(handoffPath!);expect(handoffStat.mode&0o077).toBe(0);let h:any;try{h=JSON.parse(await readFile(handoffPath!,'utf8'));}catch{throw new Error('Private handoff unreadable or malformed; contents omitted');}expect(h.host).toBe('wilson-next-git-codex-141-reusable-reporter-warblersafety.vercel.app');expect(h.sha).toBe('5943e609f9515e4684e66d71df9cd18fd20e2f75');expect(h.deployment).toBe('dpl_BjSQCQga75zhEcSXyP4YWynjjemk');expect(h.ttl).toBe(604800);let privateOrigin:string;try{const u=new URL(h.url);if(u.username||u.password)throw new Error();privateOrigin=u.origin;}catch{throw new Error('Private handoff URL invalid; value omitted');}expect(privateOrigin).toBe('https://'+h.host);await mkdir(evidenceDirectory,{recursive:true,mode:0o700});expect(h.expiresEpoch).toBeGreaterThan(Date.now()/1000);
 const origin='https://'+h.host,profile=await mkdtemp(join(tmpdir(),'wilson143-hosted-profile-'));
 let context:BrowserContext|undefined,blocked=0,pdfBytes=0;
 const actions:string[]=[],proof:any={origin,expectedRelease:h.sha,checks:[]};
 async function guard(c:BrowserContext){await c.route('**/api/case',async route=>{
  const r=route.request();if(r.method()==='POST'){
   let b:any;try{b=r.postDataJSON();}catch{blocked++;return route.abort();}
   if(b.operation==='resume')actions.push('resume');
   else if(b.operation==='act'&&['answer-reporter','set-fact'].includes(b.action?.action))actions.push(b.action.action);
   else{blocked++;return route.abort();}
  }return route.continue();
 });}
 try{
  context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'block',viewport:{width:1440,height:900}});await guard(context);
  let page=context.pages()[0];
  let bootstrapStatus:number;try{bootstrapStatus=(await context.request.get(h.url,{timeout:30000})).status();}catch{throw new Error('Approved-link bootstrap failed; private URL omitted');}
  expect(bootstrapStatus).toBe(200);await page.goto(origin);await expect(page.getByLabel('Case description',{exact:true})).toBeVisible();await saved(page);
  const version=await context.request.get(origin+'/api/case');expect(version.status()).toBe(200);const fresh=await version.json();expect(fresh.provenance.release).toBe(h.sha);proof.release=fresh.provenance.release;proof.stateVersion=fresh.provenance.stateVersion;proof.checks.push('authenticated runtime provenance');
  await page.getByLabel('Case description',{exact:true}).fill('  Fictional unfinished opening retained on hosted restart. ');
  await page.getByLabel('Adverse event',{exact:true}).check();await saved(page);
  const firstId=(await state(page)).case.id,firstBrowser=context.browser();await context.close();expect(firstBrowser?.isConnected()).toBe(false);
  context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'block',viewport:{width:1440,height:900}});await guard(context);page=context.pages()[0];await page.goto(origin);await saved(page);
  await expect(page.getByLabel('Case description',{exact:true})).toHaveValue('  Fictional unfinished opening retained on hosted restart. ');await expect(page.getByLabel('Adverse event',{exact:true})).toBeChecked();expect((await state(page)).case.id).toBe(firstId);proof.checks.push('real browser restart preserves opening/report choice');

  const clinical=productCapacityCase(),repo=new InMemoryCaseRepository({initialCase:clinical});
  const fixture=await journeyResponse(repo,await getJourneySnapshot(repo,clinical.id));
  const resume=await page.evaluate(async state=>{const response=await fetch('/api/case',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'resume',state})});return {status:response.status,body:await response.json()};},fixture.state);expect(resume.status).toBe(200);const restored=resume.body;expect(restored.provenance.release).toBe(h.sha);
  const input=workspaceInput(restored.state,{version:1,provenance:restored.provenance,ui:{...initialUiDrafts(restored.state.case.id),screen:'reporter',conversation:[{id:'hosted-synthetic-opening',kind:'opening',text:'Fictional acceptance fixture. Full submitted words are kept separately from facts.',revision:1}]},retained:[]});
  await native(page,'wilson-browser-persistence','active-case','active',{version:1,generation:randomUUID(),savedAt:new Date().toISOString(),payload:input});await page.reload();await saved(page);
  for(const[label,value]of[['Reporter first name','Casey'],['Reporter last name','Reed'],['Reporter email','casey.reed@example.test']])await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByLabel('Reporter occupation',{exact:true}).selectOption('Nurse');await page.getByLabel('Health professional',{exact:true}).selectOption('false');await page.getByLabel('Reporter country',{exact:true}).selectOption('CANADA');
  await page.getByLabel('Date of this report',{exact:true}).fill('2026-09-01');await page.getByLabel('Manufacturer or compounder',{exact:true}).check();await page.getByLabel('Do not disclose my identity to the manufacturer',{exact:true}).check();
  const before=await state(page);await profileBox(page).getByRole('button',{name:'Remember these fictional details',exact:true}).click();await expect(profileBox(page)).toContainText('Fictional reporter details remembered in this browser.');expect(await state(page)).toEqual(before);
  const remembered=await native(page,'wilson-reporter-profile','reporter','remembered');expect(Object.keys(remembered.profile).sort()).toEqual(['healthProfessional','values']);expect(remembered.profile.healthProfessional).toBe(false);proof.checks.push('remembered defaults exclude case choices and accept no facts');
  const ack=page.waitForResponse(r=>r.url().endsWith('/api/case')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.action==='answer-reporter');
  const pdf=page.waitForResponse(r=>r.url().endsWith('/api/case/pdf')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save reporter details',exact:true}).click();expect((await ack).status()).toBe(200);const pr=await pdf;expect(pr.status()).toBe(200);expect(pr.headers()['content-type']).toContain('application/pdf');const wire=await pr.body();console.log(JSON.stringify({pdfNetworkBodyBytes:wire.length,pdfHeaders:Object.fromEntries(Object.entries(pr.headers()).filter(([key])=>['content-type','content-length','content-encoding','cache-control','transfer-encoding'].includes(key)))}));
  const link=page.getByRole('link',{name:'Save PDF',exact:true});await expect(link).toBeVisible();const downloadEvent=page.waitForEvent('download');await link.click();const download=await downloadEvent;const actualPath=join(evidenceDirectory,'actual-ui-download.pdf');await download.saveAs(actualPath);const actual=await readFile(actualPath);console.log(JSON.stringify({actualUiPdfBytes:actual.length,actualUiPdfMagic:actual.subarray(0,5).toString()}));
  const bytes=actual;expect(bytes.subarray(0,5).toString()).toBe('%PDF-');pdfBytes=bytes.length;proof.pdfObservation={networkBodyBytes:wire.length,actualUiBytes:actual.length};
  const pdfPath=join(evidenceDirectory,'accepted.pdf');await writeFile(pdfPath,bytes,{mode:0o600});
  const readback=await promisify(execFile)(process.env.PYPDF_PYTHON ?? join(repositoryRoot,'.venv-pdf-evidence/bin/python'),['tools/pdf/independent_readback.py',pdfPath,'--named'],{cwd:repositoryRoot});const named=JSON.parse(readback.stdout).namedFields;const strings=Object.values(named).filter(v=>typeof v==='string').join(' ').toLowerCase();expect(strings).toContain('casey');expect(strings).toContain('casey.reed@example.test');proof.checks.push('explicit reporter acceptance and independently read actual PDF');
  await expect(page.getByRole('button',{name:'New case',exact:true})).toBeEnabled();await go(page,'Reporter details');await saved(page);const accepted=await state(page);expect(accepted.case.reporter.facts.firstName.resolvedValue.value).toEqual({kind:'known',value:'Casey'});
  await page.getByLabel('Reporter email',{exact:true}).fill('unfinished@');await go(page,'Review details');await page.getByLabel('Clinical update',{exact:true}).fill('  Fictional unsent hosted update. ');await go(page,'Reporter details');await saved(page);
  const secondBrowser=context.browser();await context.close();expect(secondBrowser?.isConnected()).toBe(false);
  context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'block',viewport:{width:1440,height:900}});await guard(context);page=context.pages()[0];await page.goto(origin);await saved(page);
  await expect(page.getByLabel('Reporter email',{exact:true})).toBeVisible();await expect(page.getByLabel('Reporter email',{exact:true})).toHaveValue('unfinished@');expect(await state(page)).toEqual(accepted);await go(page,'Review details');await expect(page.getByLabel('Clinical update',{exact:true})).toHaveValue('  Fictional unsent hosted update. ');proof.checks.push('real restart preserves accepted state, screen and independent raw drafts');
  const follower=await context.newPage();await follower.goto(origin);await expect(follower.getByRole('heading',{name:'This case is open in another tab',exact:true})).toBeVisible();await page.close();await follower.getByRole('button',{name:'Try this tab again',exact:true}).click();await saved(follower);page=follower;expect(await state(page)).toEqual(accepted);proof.checks.push('single editor and safe tab handoff');
  await go(page,'Reporter details');page.once('dialog',d=>d.dismiss());await profileBox(page).getByRole('button',{name:'Forget remembered details',exact:true}).click();expect((await native(page,'wilson-reporter-profile','reporter','remembered')).profile).not.toBeNull();
  page.once('dialog',d=>d.accept());await profileBox(page).getByRole('button',{name:'Forget remembered details',exact:true}).click();await expect(profileBox(page)).toContainText('Remembered details forgotten.');await expect(page.getByLabel('Reporter email',{exact:true})).toHaveValue('unfinished@');expect(await state(page)).toEqual(accepted);expect((await native(page,'wilson-reporter-profile','reporter','remembered')).profile).toBeNull();proof.checks.push('confirmed Forget leaves current draft and accepted facts intact');
  await page.getByLabel('Reporter email',{exact:true}).fill('casey.reed@example.test');await profileBox(page).getByRole('button',{name:'Remember these fictional details',exact:true}).click();await expect(profileBox(page)).toContainText('Fictional reporter details remembered in this browser.');await saved(page);
  const reset=page.waitForResponse(r=>r.url().endsWith('/api/case')&&r.request().method()==='GET');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'New case',exact:true}).click();expect((await reset).status()).toBe(200);await expect(page.getByRole('button',{name:'New case',exact:true})).toBeEnabled();await saved(page);
  await expect.poll(async()=>{const rec=await native(page,'wilson-browser-persistence','active-case','active');return rec.payload.drafts.data.ui.records[draftRecordKey('reporter','case')]?.data.values.firstName;}).toBe('Casey');
  const current=await native(page,'wilson-browser-persistence','active-case','active'),draft=current.payload.drafts.data.ui.records[draftRecordKey('reporter','case')].data;
  expect(current.payload.state.case.id).not.toBe(accepted.case.id);expect(draft.values.email).toBe('casey.reed@example.test');expect(draft.healthProfessional).toBe(false);expect(draft.values.country).toBe('CANADA');expect(draft.reportDate).not.toBe('2026-09-01');expect(draft.reportedTo).toEqual([]);expect(draft.doNotDiscloseIdentity).toBe(false);expect(current.payload.state.case.reporter.facts.firstName.resolvedValue).toBeUndefined();proof.checks.push('fresh case reuses editable profile only; case-specific choices reset; no implicit acceptance');
  expect(blocked).toBe(0);proof.blockedModelRequests=blocked;proof.allowedCaseActions=actions;proof.pdfBytes=pdfBytes;proof.status='PASS';proof.completedAt=new Date().toISOString();await writeFile(join(evidenceDirectory,'smoke-result.json'),JSON.stringify(proof,null,2),{mode:0o600});console.log(JSON.stringify(proof));
 }finally{await context?.close();await rm(profile,{recursive:true,force:true});}
});
