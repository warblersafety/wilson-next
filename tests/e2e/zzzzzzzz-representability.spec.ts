import {writeFile} from "node:fs/promises";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {journeyResponse} from "../../src/server/case/browser-state";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { correctCapacityProduct, productCapacityCase } from "../fixtures/product-capacity";
import { goTo, savePdf, seedStoredState, storedState } from "./draft4-helpers";

const prefix = ["topmostSubform[0].Page4[0].Prod1[0].Prod1", "topmostSubform[0].Page5[0].Prod2[0].Prod2"];
async function guardAndSeed(page: Page, current: ReturnType<typeof productCapacityCase>) {
  let interpretations = 0;
  await page.route("**/api/case", async route => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    if (route.request().method() !== "POST" || body?.operation === "resume" || ["set-fact","review-update-group"].includes(body?.action?.action)) await route.continue();
    else { interpretations++; await route.abort(); }
  });
  await page.goto("/");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await seedStoredState(page, { version: browserStateVersion, stage: "output", case: current, unrepresented: [] });
  await page.reload();
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  return () => expect(interpretations).toBe(0);
}
async function correct(page: Page, selector: string, label: string, value: string, choice = false) {
  await goTo(page, "Review details");
  const row = page.locator(selector);
  await row.getByRole("button", { name: "Change", exact: true }).click();
  if (choice) await row.getByLabel(label, { exact: true }).selectOption(value);
  else await row.getByLabel(label, { exact: true }).fill(value);
  const response = page.waitForResponse(r => r.url().endsWith("/api/case") && r.request().method() === "POST" && r.request().postDataJSON()?.action?.action === "set-fact");
  await row.getByRole("button", { name: "Apply correction", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(row.getByRole("button", { name: "Change", exact: true })).toBeVisible();
}
async function readPdf(page: Page, file: string, pages=9) {
  const download = await savePdf(page); await download.saveAs(file);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
  const result = JSON.parse(stdout); expect(result.pageCount).toBe(pages);
  return result.namedFields as Record<string, string>;
}

test("representability: both route slots preserve native and custom corrections through reload and actual PDF", async ({ page }, info) => {
  let current = correctCapacityProduct(productCapacityCase(), 0, { route: { kind: "known", value: "Intramuscular" } });
  current = correctCapacityProduct(current, 1, { route: { kind: "known", value: "custom supplied route" } });
  const noInterpretations = await guardAndSeed(page, current);
  const before = await storedState(page);
  let named = await readPdf(page, info.outputPath("native-and-other.pdf"));
  expect(named[`${prefix[0]}Route[0]`]).toBe("Intramuscular");
  expect(named[`${prefix[1]}Route[0]`]).toBe("Other");
  expect(named[`${prefix[1]}RouteOther[0]`]).toBe("custom supplied route");
  await correct(page, '#case-card-product-1 [data-field="route"]', "New Route", "IV");
  await correct(page, '#case-card-product-2 [data-field="route"]', "New Route", "oral");
  const corrected = await storedState(page);
  expect(corrected.case.products.map(p => p.id)).toEqual(before.case.products.map(p => p.id));
  expect(corrected.case.patient).toEqual(before.case.patient); expect(corrected.case.event).toEqual(before.case.event);
  expect(corrected.case.products[2]).toEqual(before.case.products[2]);
  for (let i = 0; i < 2; i++) {
    const { route: _oldRoute, ...oldFacts } = before.case.products[i].facts;
    const { route: _newRoute, ...newFacts } = corrected.case.products[i].facts;
    expect(newFacts).toEqual(oldFacts);
    expect(corrected.case.products[i].facts.route.supersededValues.map(v => v.value)).toContainEqual(before.case.products[i].facts.route.resolvedValue!.value);
  }
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
  await page.reload();
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  expect((await storedState(page)).case).toEqual(corrected.case);
  named = await readPdf(page, info.outputPath("corrected-after-reload.pdf"));
  expect(named[`${prefix[0]}Route[0]`]).toBe("Other"); expect(named[`${prefix[0]}RouteOther[0]`]).toBe("IV");
  expect(named[`${prefix[1]}Route[0]`]).toBe("Oral"); expect(named[`${prefix[1]}RouteOther[0]`]).toBeUndefined();
  noInterpretations();
});

test("reviewed intersex exports without false boxes, survives resume and explicit correction removes its supplement",async({page},info)=>{
 const noInterpretations=await guardAndSeed(page,productCapacityCase());
 await readPdf(page,info.outputPath('earlier.pdf'));const baseline=await storedState(page);
 await correct(page,'#case-card-patient [data-field="sex"]','New Sex','intersex',true);
 const changed=await storedState(page);expect(changed.case.patient.facts.sex.resolvedValue?.value).toEqual({kind:'known',value:'intersex'});
 for(const key of ['products','event','reporter','relevantTests']as const)expect(changed.case[key]).toEqual(baseline.case[key]);
 const file=info.outputPath('intersex.pdf'),native=await readPdf(page,file,10);
 expect(native['topmostSubform[0].Page1[0].SecA_Patient[0].SexF[0]']).toBe('/Off');expect(native['topmostSubform[0].Page1[0].SecA_Patient[0].SexM[0]']).toBe('/Off');
 const x=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??'python3',['tools/pdf/independent_readback.py',file,'--page-text'])).stdout);expect(x.pageTexts[8]).toContain('A3 Sex (reviewed value): intersex');
 await expect(page.getByText('The reviewed sex value is included in an A3-linked supplement.',{exact:false})).toBeVisible();
 await expect(page.getByRole('region',{name:'Browser saving'}).getByRole('status')).toHaveText('Saved in this browser');await writeFile(info.outputPath('sex-state.json'),JSON.stringify(await storedState(page)));await page.reload();await expect(page.getByRole('button',{name:'New case',exact:true})).toBeEnabled();expect((await storedState(page)).case).toEqual(changed.case);await readPdf(page,info.outputPath('resumed-intersex.pdf'),10);
 await correct(page,'#case-card-patient [data-field="sex"]','New Sex','female',true);const restored=await storedState(page);expect(restored.case.patient.facts.sex.supersededValues.some(v=>v.value.kind==='known'&&v.value.value==='intersex')).toBe(true);
 const corrected=await readPdf(page,info.outputPath('explicit-correction.pdf'));expect(corrected['topmostSubform[0].Page1[0].SecA_Patient[0].SexF[0]']).toBe('/1');expect(corrected['topmostSubform[0].Page1[0].SecA_Patient[0].SexM[0]']).toBe('/Off');
 for(const field of Object.keys(baseline.case.patient.facts)as Array<keyof typeof baseline.case.patient.facts>)if(field!=='sex')expect(restored.case.patient.facts[field]).toEqual(baseline.case.patient.facts[field]);
 await page.setViewportSize({width:390,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);noInterpretations();
});

test("explicit conversational sex proposal stays pending until review; qualified A3 context clears on unknown without changing other facts",async({page},info)=>{
 const noInterpretations=await guardAndSeed(page,productCapacityCase());const baseline=await storedState(page);
 await page.route('**/api/case',async route=>{
  const body=route.request().postDataJSON();if(body?.action?.action!=='submit-update')return route.fallback();
  const repository=new InMemoryCaseRepository({initialCase:body.state.case});
  const snapshot=await performJourneyAction(repository,body.state.case.id,body.action,{propose:async(_turn,text)=>({envelope:{products:[],relevantTests:[],unrepresented:[],sources:[{id:'sex-source-151',inputId:'sex-input-151',inputType:'correction',actor:'clinician',recordedAt:'2026-10-16T00:00:00.000Z',excerpt:text,start:0,end:text.length}],proposals:[{proposalId:'sex-proposal-151',groupId:'sex-group-151',intent:'correction',target:{entity:'patient',entityId:'patient',field:'sex'},value:{kind:'known',value:'intersex',qualifier:'Supplied account; not independently confirmed'},sourceIds:['sex-source-151']}]}})});
  await route.fulfill({json:await journeyResponse(repository,snapshot)});
 });
 await goTo(page,'Review details');await page.getByLabel('Clinical update',{exact:true}).fill('The clinician explicitly reports patient sex as intersex; supplied account, not independently confirmed.');await page.getByRole('button',{name:'Prepare changes for review',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review the proposed update',exact:true})).toBeVisible();expect((await storedState(page)).case.patient.facts.sex.resolvedValue).toEqual(baseline.case.patient.facts.sex.resolvedValue);
 await expect(page.getByText('Supplied account; not independently confirmed',{exact:false}).first()).toBeVisible();await page.getByRole('button',{name:'Accept these changes',exact:true}).click();await expect(page.getByRole('button',{name:'New case',exact:true})).toBeEnabled();
 const accepted=await storedState(page);expect(accepted.case.patient.facts.sex.resolvedValue?.sourceIds).toContain('sex-source-151');for(const key of ['products','event','reporter','relevantTests']as const)expect(accepted.case[key]).toEqual(baseline.case[key]);
 const file=info.outputPath('qualified-intersex.pdf');await readPdf(page,file,10);const x=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??'python3',['tools/pdf/independent_readback.py',file,'--page-text'])).stdout);expect(x.pageTexts[8]).toContain('A3 Sex context: Supplied account; not independently confirmed');
 await goTo(page,'Review details');const row=page.locator('#case-card-patient [data-field="sex"]');await row.getByRole('button',{name:'Change',exact:true}).click();await row.getByLabel('Uncertainty or context for Sex',{exact:true}).fill('Supplied β context');await row.getByRole('button',{name:'Apply correction',exact:true}).click();await expect(row.getByRole('button',{name:'Change',exact:true})).toBeVisible();await goTo(page,'Review & save');await expect(page.getByRole('heading',{name:'This PDF cannot represent every reviewed value',exact:true})).toBeVisible();await expect(page.getByText('The reviewed sex value is included in an A3-linked supplement.',{exact:false})).toHaveCount(0);await expect(page.getByRole('link',{name:'Save PDF',exact:true})).toHaveCount(0);expect((await storedState(page)).case.patient.facts.sex.resolvedValue?.value).toEqual({kind:'known',value:'intersex',qualifier:'Supplied β context'});
 await goTo(page,'Review details');await row.getByRole('button',{name:'Change',exact:true}).click();await row.getByLabel('Sex status',{exact:true}).selectOption('unknown');await row.getByRole('button',{name:'Apply correction',exact:true}).click();await expect(row.getByRole('button',{name:'Change',exact:true})).toBeVisible();
 expect((await storedState(page)).case.patient.facts.sex.resolvedValue?.value).toEqual({kind:'unknown'});const blank=await readPdf(page,info.outputPath('sex-unknown.pdf'));expect(blank['topmostSubform[0].Page1[0].SecA_Patient[0].SexF[0]']).toBe('/Off');expect(blank['topmostSubform[0].Page1[0].SecA_Patient[0].SexM[0]']).toBe('/Off');noInterpretations();
});

test("representability: oversized route/frequency survive reload and print exact supplements, then explicitly correct", async ({ page }, info) => {
  let requests = 0; page.on("request", r => { if (r.url().endsWith("/api/case/pdf") && r.method() === "POST") requests++; });
  const noInterpretations = await guardAndSeed(page, productCapacityCase());
  const baseline = await storedState(page);
  await readPdf(page, info.outputPath("before-capacity.pdf"));
  for (const [field, label, replacement] of [["route", "New Route", "IV"], ["frequency", "New Frequency", "every second morning"]] as const) {
    const long = `Fictional supplied ${field}: ` + "wide wording ".repeat(15);
    await correct(page, `#case-card-product-1 [data-field="${field}"]`, label, long);
    const retained = await storedState(page);
    expect(retained.case.products[0].facts[field].resolvedValue?.value).toEqual({ kind: "known", value: long });
    expect(retained.case.products[1]).toEqual(baseline.case.products[1]); expect(retained.case.products[2]).toEqual(baseline.case.products[2]);
    await page.reload(); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
    expect((await storedState(page)).case).toEqual(retained.case);
    const supplemented = await readPdf(page, info.outputPath(`long-${field}.pdf`),10);
    expect(supplemented[`${prefix[0]}${field === "route" ? "RouteOther" : "FreqOther"}[0]`]).toBe("D2 supplement");
    await correct(page, `#case-card-product-1 [data-field="${field}"]`, label, replacement);
    expect((await storedState(page)).case.products[0].facts[field].supersededValues.map(v => v.value)).toContainEqual({ kind: "known", value: long });
    const named = await readPdf(page, info.outputPath(`explicit-${field}.pdf`));
    expect(named[`${prefix[0]}${field === "route" ? "RouteOther" : "FreqOther"}[0]`]).toBe(replacement);
  }
  noInterpretations();
});
