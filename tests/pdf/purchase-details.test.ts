import {expect,it} from "vitest";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {applyCaseCommand} from "../../src/domain/case/commands";
import {productCapacityCase} from "../fixtures/product-capacity";
import {setContextFact,contextSource} from "../fixtures/reviewed-context";
import {projectForm3500} from "../../src/domain/case/projection";
import {fillForm3500Projection} from "../../src/server/pdf/form-3500";
import {parseBrowserJourneyState,browserStateVersion} from "../../src/server/case/browser-state";
import {removePurchaseDetailsFields} from "../fixtures/pre-dob";
async function inspect(c:ReturnType<typeof productCapacityCase>,name?:string){
 const before=structuredClone(c),projection=projectForm3500(c);
 const r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 expect(r.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const path=join(await mkdtemp(join(tmpdir(),"wilson188-")),"purchase.pdf");await writeFile(path,r.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);
 if(name&&process.env.WILSON_PURCHASE_DETAILS_EVIDENCE){await writeFile(join(process.env.WILSON_PURCHASE_DETAILS_EVIDENCE,name+".pdf"),r.output);await writeFile(join(process.env.WILSON_PURCHASE_DETAILS_EVIDENCE,name+"-readback.json"),stdout);}
 return {projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
import {PDFDocument} from "@cantoo/pdf-lib";
import {purchaseDetailFields,purchaseCountryOptions,purchaseCountryLabel,purchaseCountrySuggestions} from "../../src/domain/case/purchase-details";
import {purchaseNativeGeometry,purchaseDetailLimitation} from "../../src/server/pdf/purchase-details";
import {purchaseDetailsA,purchaseDetailsB} from "../fixtures/medication-model";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {getJourneySnapshot} from "../../src/server/journey/service";
function withDetails(){let c=productCapacityCase();for(const [i,p]of c.products.slice(0,2).entries())for(const field of purchaseDetailFields)c=setContextFact(c,`product:${p.id}:${field}`,{kind:"known",value:(i===0?purchaseDetailsA:purchaseDetailsB)[field]});return c;}
it("maps all fourteen native controls with exact country options/appearance and no unrelated field mutation",async()=>{
 const base=productCapacityCase(),baseline=await inspect(base),c=withDetails(),r=await inspect(c,"purchase-details-both");
 for(const [i,p]of c.products.slice(0,2).entries())for(const field of purchaseDetailFields){expect(r.fields[purchaseNativeGeometry[i][field].name]).toBe((field==="purchaseSellerCountry"?purchaseCountryLabel((i===0?purchaseDetailsA:purchaseDetailsB)[field]):(i===0?purchaseDetailsA:purchaseDetailsB)[field]));expect(r.projection.sourceTrace[`sections.D.suspectProducts.${i}.${field}`]).toEqual(p.facts[field].resolvedValue!.sourceIds);}
 const ours=new Set(purchaseNativeGeometry.flatMap(g=>purchaseDetailFields.map(f=>g[f].name)));expect(Object.fromEntries(Object.entries(r.fields).filter(([k])=>!ours.has(k as never)))).toEqual(baseline.fields);
 const pdf=await PDFDocument.load(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),{password:"",updateMetadata:false}),form=pdf.getForm();
 for(let i=0;i<2;i++)for(const field of purchaseDetailFields){const g=purchaseNativeGeometry[i][field],control=field==="purchaseSellerCountry"?form.getDropdown(g.name):form.getTextField(g.name);const rect=control.acroField.getWidgets()[0].getRectangle();expect(rect.width).toBeCloseTo(g.width,5);if(field==="purchaseSellerCountry")expect((control as ReturnType<typeof form.getDropdown>).getOptions().filter(v=>v.trim())).toEqual(purchaseCountryOptions);else expect((control as ReturnType<typeof form.getTextField>).getMaxLength()??null).toBe(g.maxLength);}
});
it("corrects only sellerB city/site and discloses exact qualifier while retaining independent manufacturer/reporter/source/history",async()=>{
 let c=withDetails();const before=structuredClone(c),initial=await inspect(c);c=setContextFact(c,`product:${c.products[1].id}:purchaseSellerCity`,{kind:"known",value:"Revised City",qualifier:"supplied spelling, no address inference"});c=setContextFact(c,`product:${c.products[1].id}:purchaseWebsite`,{kind:"known",value:"https://revised.example.invalid"});const r=await inspect(c,"purchase-details-corrected");
 const changes=new Set([purchaseNativeGeometry[1].purchaseSellerCity.name,purchaseNativeGeometry[1].purchaseWebsite.name]);const other=(f:Record<string,string>)=>Object.fromEntries(Object.entries(f).filter(([k])=>!changes.has(k as never)));expect(other(r.fields)).toEqual(other(initial.fields));expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${c.products[1].id}:purchaseSellerCity`,reason:"qualifier-not-included",baseValueIncluded:true}));expect(c.products[0]).toEqual(before.products[0]);expect(c.reporter).toEqual(before.reporter);expect(c.products[1].facts.manufacturer).toEqual(before.products[1].facts.manufacturer);
});
it.each(purchaseDetailFields)("preserves all nonknown states/history for %s with blank native field",async field=>{
 let c=withDetails();const id=c.products[0].id;for(const kind of["unknown","declined","explicitly-absent","inapplicable"]as const){c=setContextFact(c,`product:${id}:${field}`,{kind});const r=await inspect(c);expect(r.fields[purchaseNativeGeometry[0][field].name]??"").toBe("");expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${id}:${field}`,reason:kind}));}expect(c.products[0].facts[field].supersededValues.length).toBeGreaterThan(0);
});
it.each(purchaseDetailFields)("guards exact native limits on %s before output without deleting accepted wording",async field=>{
 const i=0,g=purchaseNativeGeometry[i][field];const values=field==="purchaseSellerCountry"?["UK","UNKNOWN","Unknown","", "Unknown fictional country"]:[""," ","a\nb","a\tb","β", "W".repeat(600),...(g.maxLength?[ "i".repeat(g.maxLength+1) ]:[])];
 for(const value of values){expect(purchaseDetailLimitation(field,value,i)).toBeTruthy();const c=setContextFact(productCapacityCase(),`product:${productCapacityCase().products[0].id}:${field}`,{kind:"known",value}),before=structuredClone(c);const repo=new InMemoryCaseRepository({initialCase:c});const snap=await getJourneySnapshot(repo,c.id);expect(snap.outputIssues).toContainEqual(expect.objectContaining({code:"unsupported-purchase-detail",targets:expect.arrayContaining([`product:${c.products[0].id}:${field}`])}));await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projectForm3500(c))).rejects.toThrow("Unsupported Section D purchase detail");expect(c).toEqual(before);}
});
it("keeps raw unmatched country text without geography inference and supports accents/leading zeros in fitting text",async()=>{
 let c=withDetails();c=setContextFact(c,`product:${c.products[0].id}:purchaseSellerCity`,{kind:"known",value:"Müller City"});const r=await inspect(c,"purchase-details-accented");expect(r.fields[purchaseNativeGeometry[0].purchaseSellerCity.name]).toBe("Müller City");expect(r.fields[purchaseNativeGeometry[0].purchaseSellerPostalCode.name]).toBe("00A 001");
});
it("upgrades genuine v20 by only empty metadata facts and rejects fake older states with new fields",()=>{
 const c=productCapacityCase(),expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]},old=structuredClone({...expected,version:"wilson-browser-state-v20"});removePurchaseDetailsFields(old.case);const before=structuredClone(old);expect(parseBrowserJourneyState(old)).toEqual(expected);expect(old).toEqual(before);expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v20"})).toThrow();
});
it("retains metadata on other routes and makes remaining metadata follow the product after withdrawal",async()=>{
 let c=withDetails();for(const [field,value]of[["role","concomitant"],["productType","device"]]as const){let x=structuredClone(c);x.products=x.products.slice(0,2);x=setContextFact(x,`product:${x.products[0].id}:${field}`,{kind:"known",value});const p=projectForm3500(x);expect(p.sections.D.suspectProducts.every(p=>p.purchaseSellerName!=="Fictional Seller Alpha")).toBe(true);expect(p.notIncluded.join(" ")).toContain("Purchase seller name");expect(x.products[0].facts.purchaseSellerCountry).toEqual(c.products[0].facts.purchaseSellerCountry);}
 const x=applyCaseCommand(c,{type:"withdraw-case-entity",commandId:"withdraw-seller",expectedRevision:c.revision,target:{entity:"product",entityId:c.products[0].id},source:contextSource("withdraw-seller")}).case;const r=await inspect(x);for(const f of purchaseDetailFields)expect(r.fields[purchaseNativeGeometry[0][f].name]).toBe(f==="purchaseSellerCountry"?purchaseCountryLabel(purchaseDetailsB[f]):purchaseDetailsB[f]);expect(x.products[0].facts.purchaseSellerName).toEqual(c.products[0].facts.purchaseSellerName);
});

it("retains pending/conflicting alternatives unprinted until explicit conflict resolution",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,source=contextSource("purchase-conflict","Fictional records disagree on purchase date.");
 let state=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"purchase-alts",expectedRevision:c.revision,products:[],sources:[source],proposals:["Fictional City A","Fictional City B"].map((value,i)=>({proposalId:"purchase-"+i,groupId:"purchase-conflict",intent:"alternative"as const,target:{entity:"product"as const,entityId:id,field:"purchaseSellerCity"as const},value:{kind:"known"as const,value},sourceIds:[source.id]}))}).case;
 expect((await inspect(state)).projection.sections.D.suspectProducts[0].purchaseSellerCity).toBeUndefined();
 state=applyCaseCommand(state,{type:"review-proposal-groups",commandId:"accept-purchase-conflict",expectedRevision:state.revision,decisions:[{groupId:"purchase-conflict",action:"accept"}]}).case;
 expect((await inspect(state)).fields[purchaseNativeGeometry[0].purchaseSellerCity.name]??"").toBe("");
 state=applyCaseCommand(state,{type:"resolve-conflict",commandId:"resolve-purchase",expectedRevision:state.revision,target:{entity:"product",entityId:id,field:"purchaseSellerCity"},chosenValueId:"purchase-1",source:contextSource("choose-purchase-date")}).case;expect((await inspect(state)).fields[purchaseNativeGeometry[0].purchaseSellerCity.name]).toBe("Fictional City B");
});


it.each(["Canada"," canada ","United Kingdom","united kingdom"])("formats only case/outer-space equivalent country %s for native print while preserving raw accepted knowledge",async value=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:purchaseSellerCountry`,{kind:"known",value});const before=structuredClone(c),r=await inspect(c);expect(r.fields[purchaseNativeGeometry[0].purchaseSellerCountry.name]).toBe(purchaseCountryLabel(value));expect(c).toEqual(before);expect(c.products[0].facts.purchaseSellerCountry.resolvedValue?.value).toEqual({kind:"known",value});
});
it("does not offer native UNKNOWN as a known country or conflate an unknown status with a literal value",async()=>{
 expect(purchaseCountryOptions).toContain("UNKNOWN");expect(purchaseCountrySuggestions).not.toContain("UNKNOWN");expect(purchaseCountryLabel("Unknown")).toBeUndefined();
 let c=productCapacityCase();c=setContextFact(c,`product:${c.products[0].id}:purchaseSellerCountry`,{kind:"unknown"});const r=await inspect(c);expect(r.fields[purchaseNativeGeometry[0].purchaseSellerCountry.name]??"").toBe("");expect(r.projection.omissions).toContainEqual(expect.objectContaining({reason:"unknown",target:`product:${c.products[0].id}:purchaseSellerCountry`}));
});
it("three retained suspects with all seller details remain recoverable with capacity notice across snapshot and resume",async()=>{
 let c=productCapacityCase();const id=c.products[2].id;c=setContextFact(c,`product:${id}:role`,{kind:"known",value:"suspect"});for(const f of purchaseDetailFields)c=setContextFact(c,`product:${id}:${f}`,{kind:"known",value:purchaseDetailsA[f]});const before=structuredClone(c);
 const state=parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}),snapshot=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:state.case}),c.id);
 expect(snapshot.downloadReady).toBe(false);expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({code:"too-many-suspect-products"}));expect(snapshot.outputIssues.some(i=>i.code==="unsupported-purchase-detail")).toBe(false);expect(c).toEqual(before);expect(state.case).toEqual(c);
});
