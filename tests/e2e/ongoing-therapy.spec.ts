import {expect,test,type Page} from "@playwright/test";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {ongoingOpening,ongoingCorrection} from "../fixtures/medication-model";
import {productCapacityCase} from "../fixtures/product-capacity";
import {browserStateVersion} from "../../src/server/case/browser-state";
import {acceptOpeningGroups,goTo,savePdf,seedStoredState,serverAction,storedState} from "./draft4-helpers";
const row=(page:Page,n=1)=>page.locator(`#case-card-product-${n} [data-field="therapyOngoing"]`);
const saved=(page:Page)=>expect(page.getByRole("region",{name:"Browser saving"}).getByRole("status")).toHaveText("Saved in this browser");
async function reload(page:Page){await saved(page);await page.reload();await expect(page.getByRole("button",{name:"New case",exact:true})).toBeEnabled();await saved(page);}
async function pdf(page:Page,path:string){const d=await savePdf(page);await d.saveAs(path);const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);return JSON.parse(stdout).namedFields as Record<string,string>;}
function marks(fields:Record<string,string>,i:number,value:boolean|undefined){const prefix=`topmostSubform[0].Page${i+4}[0].Prod${i+1}[0].Prod${i+1}TherapyOngoing`;for(const [answer,suffix]of[[true,"Yes"],[false,"No"]]as const){const v=fields[prefix+suffix+"[0]"];expect(Boolean(v&&v!=="/Off")).toBe(value===answer);}}
async function edit(page:Page,n=1){await goTo(page,"Review details");const card=page.locator(`#case-card-product-${n}`);if(await row(page,n).count()===0)await card.getByRole("button",{name:/^Show more fields/}).click();const b=row(page,n).getByRole("button",{name:/^(Add|Change)$/});if(await b.count())await b.click();}
test("explicit ongoing and not ongoing remain pending until human review, correct independently and export both native slots",async({page},info)=>{
 await page.goto("/");await page.getByLabel("Case description",{exact:true}).fill(ongoingOpening);await page.getByRole("button",{name:"Review Wilson’s understanding",exact:true}).click();
 expect((await storedState(page)).case.products.every(p=>p.facts.therapyOngoing.resolvedValue===undefined)).toBe(true);
 await acceptOpeningGroups(page);await goTo(page,"Reporter details");await page.getByLabel("Date of this report",{exact:true}).fill("2026-10-15");await serverAction(page,()=>page.getByRole("button",{name:"Prefer not to provide reporter details"}).click());await reload(page);
 const before=(await storedState(page)).case;const first=await pdf(page,info.outputPath("ongoing.pdf"));marks(first,0,true);marks(first,1,false);
 await goTo(page,"Review details");await page.getByLabel("Clinical update",{exact:true}).fill(ongoingCorrection);await serverAction(page,()=>page.getByRole("button",{name:"Prepare changes for review",exact:true}).click());
 const pending=(await storedState(page)).case.products[0].facts.therapyOngoing;expect(pending.resolvedValue).toEqual(before.products[0].facts.therapyOngoing.resolvedValue);expect(pending.proposedValues).toHaveLength(1);expect(pending.proposedValues[0].value).toEqual({kind:"known",value:false});
 await serverAction(page,()=>page.getByRole("button",{name:"Accept these changes",exact:true}).click());await reload(page);
 const corrected=await pdf(page,info.outputPath("corrected.pdf"));marks(corrected,0,false);marks(corrected,1,false);
 const after=(await storedState(page)).case;expect(after.products[0].facts.stopDate).toEqual(before.products[0].facts.stopDate);expect(after.products[0].facts.restarted).toEqual(before.products[0].facts.restarted);expect(after.products[0].facts.therapyOngoing.supersededValues.length).toBeGreaterThan(0);
 for(const s of after.sources.filter(s=>after.products[0].facts.therapyOngoing.resolvedValue!.sourceIds.includes(s.id)))expect(ongoingCorrection.slice(s.start,s.end)).toBe(s.excerpt);
});
test("v15 saved case and unfinished dates resume with no inferred ongoing status; unfinished and explicit unknown/declined edits persist separately",async({page},info)=>{
 let unexpected=0;await page.route("**/api/case",async r=>{const b=r.request().method()==="POST"?r.request().postDataJSON():undefined;if(r.request().method()!=="POST"||b?.operation==="resume"||b?.action?.action==="set-fact")await r.continue();else{unexpected++;await r.abort();}});
 await page.goto("/");await seedStoredState(page,{version:browserStateVersion,stage:"output",case:productCapacityCase(),unrepresented:[]});await page.reload();await saved(page);await goTo(page,"Review details");
 const date=page.locator('#case-card-product-1 [data-field="stopDate"]');await date.getByRole("button",{name:/^(Change|Add)$/}).click();await date.getByLabel("Stopped date status",{exact:true}).selectOption("known");await date.getByLabel("New Stopped date",{exact:true}).fill("2026-09-22");await saved(page);const before=await storedState(page);
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("wilson-browser-persistence",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("active-case","readwrite"),s=tx.objectStore("active-case"),g=s.get("active");g.onsuccess=()=>{const r=g.result;r.payload.state.version="wilson-browser-state-v15";r.payload.drafts.data.provenance.stateVersion="wilson-browser-state-v15";for(const p of r.payload.state.case.products)delete p.facts.therapyOngoing;for(const record of Object.values(r.payload.drafts.data.ui.records)as Array<{kind:string;data:{factVersions?:Record<string,string>}}>){if(record.kind==="card"&&record.data.factVersions)delete record.data.factVersions.therapyOngoing;}s.put(r,"active");};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}});
 await reload(page);expect((await storedState(page)).case).toEqual(before.case);await goTo(page,"Review details");await expect(date.getByLabel("New Stopped date",{exact:true})).toHaveValue("2026-09-22");
 marks(await pdf(page,info.outputPath("blank.pdf")),0,undefined);
 for(const kind of ["unknown","declined"]){await edit(page);await row(page).getByLabel("Therapy/usage still ongoing status",{exact:true}).selectOption(kind);await reload(page);await goTo(page,"Review details");await expect(row(page).getByLabel("Therapy/usage still ongoing status",{exact:true})).toHaveValue(kind);await serverAction(page,()=>row(page).getByRole("button",{name:/^(Add fact|Apply correction)$/}).click());await reload(page);expect((await storedState(page)).case.products[0].facts.therapyOngoing.resolvedValue?.value).toEqual({kind});marks(await pdf(page,info.outputPath(kind+".pdf")),0,undefined);}
 expect(unexpected).toBe(0);
});
