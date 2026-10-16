import {writeFile} from "node:fs/promises";
import {expect,test} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {productCapacityCase} from '../fixtures/product-capacity';
import {setContextFact} from '../fixtures/reviewed-context';
import {browserStateVersion} from '../../src/server/case/browser-state';
import {goTo,savePdf,seedStoredState,serverAction,storedState} from './draft4-helpers';
const saved=async(page:import('@playwright/test').Page)=>expect(page.getByRole('region',{name:'Browser saving'}).getByRole('status')).toHaveText('Saved in this browser');
test('legacy impossible date stays visible and unchanged on resume; partial draft survives reload; explicit leap-day correction exports and retains history',async({page},info)=>{
 let c=structuredClone(setContextFact(productCapacityCase(),'event:event:onsetDate',{kind:'known',value:'2028-02-29'}));c.event.facts.onsetDate.resolvedValue!.value={kind:'known',value:'2026-02-30'};
 let unexpected=0;await page.route('**/api/case',async route=>{const b=route.request().method()==='POST'?route.request().postDataJSON():undefined;if(route.request().method()!=='POST'||b?.operation==='resume'||b?.action?.action==='set-fact')await route.continue();else{unexpected++;await route.abort();}});
 await writeFile(info.outputPath('legacy-state.json'),JSON.stringify({version:browserStateVersion,stage:'output',case:c,unrepresented:[]}));
 await page.goto('/');await seedStoredState(page,{version:browserStateVersion,stage:'output',case:c,unrepresented:[]});await page.reload();await saved(page);expect((await storedState(page)).case).toEqual(c);
 await goTo(page,'Review & save');await expect(page.getByText('The retained date 2026-02-30',{exact:false})).toBeVisible();await expect(page.getByRole('link',{name:'Save PDF',exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('invalid-calendar-review.png'),fullPage:true});
 await goTo(page,'Review details');const row=page.locator('#case-card-event [data-field="onsetDate"]');await expect(row).toContainText('2026-02-30');await row.getByRole('button',{name:'Change',exact:true}).click();
 for(const value of ['2026-02-29','2026-02']){
  await row.getByLabel('New Onset',{exact:true}).fill(value);await saved(page);await page.reload();await saved(page);await goTo(page,'Review details');await expect(row.getByLabel('New Onset',{exact:true})).toHaveValue(value);await expect(row.getByRole('button',{name:'Apply correction',exact:true})).toBeDisabled();await expect(row).toContainText('unfinished edit is retained');expect((await storedState(page)).case).toEqual(c);
 }
 await row.getByLabel('New Onset',{exact:true}).fill('2028-02-29');await serverAction(page,()=>row.getByRole('button',{name:'Apply correction',exact:true}).click());await saved(page);const corrected=(await storedState(page)).case;
 expect(corrected.event.facts.onsetDate.supersededValues.some(v=>v.value.kind==='known'&&v.value.value==='2026-02-30')).toBe(true);expect(corrected.products).toEqual(c.products);expect(corrected.patient).toEqual(c.patient);expect(corrected.reporter).toEqual(c.reporter);for(const key of Object.keys(c.event.facts)as Array<keyof typeof c.event.facts>)if(key!=='onsetDate')expect(corrected.event.facts[key]).toEqual(c.event.facts[key]);
 await page.reload();await saved(page);expect((await storedState(page)).case).toEqual(corrected);const file=info.outputPath('calendar-corrected.pdf');await(await savePdf(page)).saveAs(file);const pdf=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??'python3',['tools/pdf/independent_readback.py',file,'--named','--page-text'])).stdout);expect(pdf.pageCount).toBe(8);expect(Object.values(pdf.namedFields)).toContain('29-FEB-2028');expect(pdf.pageTexts.join('\n')).not.toContain('30-FEB-2026');
 await goTo(page,'Review details');await row.getByRole('button',{name:'Change',exact:true}).click();await row.getByLabel('Onset status',{exact:true}).selectOption('unknown');await serverAction(page,()=>row.getByRole('button',{name:'Apply correction',exact:true}).click());await saved(page);await page.reload();await saved(page);expect((await storedState(page)).case.event.facts.onsetDate.resolvedValue?.value).toEqual({kind:'unknown'});await(await savePdf(page)).saveAs(info.outputPath('calendar-unknown.pdf'));expect(unexpected).toBe(0);
});
