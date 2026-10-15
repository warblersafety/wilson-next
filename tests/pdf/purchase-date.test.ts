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
import {removePurchaseDateFields} from "../fixtures/pre-dob";
const key=(i:number)=>`topmostSubform[0].Page${i+4}[0].Prod${i+1}[0].${i===0?"Prod1":"Pdt2"}PurchaseDate[0]`;
async function inspect(c:ReturnType<typeof productCapacityCase>,name?:string){
 const before=structuredClone(c),projection=projectForm3500(c);
 const r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 expect(r.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const path=join(await mkdtemp(join(tmpdir(),"wilson183-")),"purchase.pdf");await writeFile(path,r.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);
 if(name&&process.env.WILSON_PURCHASE_EVIDENCE){await writeFile(join(process.env.WILSON_PURCHASE_EVIDENCE,name+".pdf"),r.output);await writeFile(join(process.env.WILSON_PURCHASE_EVIDENCE,name+"-readback.json"),stdout);}
 return {projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
it.each(["0001-01-01","2000-02-29","2028-02-29","9999-12-31"])("preserves explicit purchase calendar date %s in both native slots",async date=>{
 let c=productCapacityCase();for(const p of c.products.slice(0,2))c=setContextFact(c,`product:${p.id}:purchaseDate`,{kind:"known",value:date});const r=await inspect(c);expect(r.projection.sections.D.suspectProducts.map(p=>p.purchaseDate)).toEqual([date,date]);
});
it("writes distinct purchase dates without changing any unrelated native field and discloses an exact estimate qualifier",async()=>{
 const base=productCapacityCase(),original=await inspect(base);let c=setContextFact(base,`product:${base.products[0].id}:purchaseDate`,{kind:"known",value:"2024-02-29",qualifier:"exact supplied estimated date"});
 c=setContextFact(c,`product:${c.products[1].id}:purchaseDate`,{kind:"known",value:"2026-08-12"});const r=await inspect(c,"purchase-both");expect(r.fields[key(0)]).toBe("29-FEB-2024");expect(r.fields[key(1)]).toBe("12-AUG-2026");
 expect(Object.fromEntries(Object.entries(r.fields).filter(([k])=>!k.includes("PurchaseDate")))).toEqual(original.fields);
 expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${c.products[0].id}:purchaseDate`,reason:"qualifier-not-included",qualifier:"exact supplied estimated date",baseValueIncluded:true}));
 expect(r.projection.sourceTrace["sections.D.suspectProducts.0.purchaseDate"]).toEqual(c.products[0].facts.purchaseDate.resolvedValue!.sourceIds);
 c=setContextFact(c,`product:${c.products[1].id}:purchaseDate`,{kind:"known",value:"2026-08-13"});expect((await inspect(c,"purchase-corrected")).fields[key(1)]).toBe("13-AUG-2026");
});
it.each(["2026","2026-08","2026-02-29","1900-02-29","2026-04-31","0000-01-01","2026-13-01","2026-01-00","2026-8-01",null,20260812])("rejects partial/impossible/coerced purchase date %j without mutation or repair",async value=>{
 const c=productCapacityCase(),before=structuredClone(c),id=c.products[0].id;expect(()=>setContextFact(c,`product:${id}:purchaseDate`,{kind:"known",value})).toThrow("complete valid");
 const p=projectForm3500(c);(p.sections.D.suspectProducts[0]as unknown as{purchaseDate:unknown}).purchaseDate=value;await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p)).rejects.toThrow("purchase date");expect(c).toEqual(before);
});
it.each(["unknown","declined","explicitly-absent","inapplicable"]as const)("retains %s and superseded purchase history but leaves the native control blank",async kind=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:purchaseDate`,{kind:"known",value:"2026-08-12"});c=setContextFact(c,`product:${id}:purchaseDate`,{kind});const r=await inspect(c);
 expect(r.fields[key(0)]??"").toBe("");expect(c.products[0].facts.purchaseDate.supersededValues.length).toBeGreaterThan(0);expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${id}:purchaseDate`,reason:kind}));
});
it("never infers purchase dates from any existing date and discloses retained knowledge on non-D routes",async()=>{
 const base=productCapacityCase();expect((await inspect(base)).projection.sections.D.suspectProducts.every(p=>p.purchaseDate===undefined)).toBe(true);
 for(const field of["role","productType"]as const){const routed=structuredClone(base);routed.products=routed.products.slice(0,2);let c=setContextFact(routed,`product:${base.products[0].id}:purchaseDate`,{kind:"known",value:"2026-08-12"});c=setContextFact(c,`product:${c.products[0].id}:${field}`,{kind:"known",value:field==="role"?"concomitant":"device"});const r=await inspect(c);expect(r.projection.notIncluded.join(" ")).toContain("Purchase date");expect(c.products[0].facts.purchaseDate.resolvedValue?.value).toEqual({kind:"known",value:"2026-08-12"});expect(r.fields[key(0)]??"").toBe("");}
});
it("strictly upgrades genuine v18 by adding only empty purchase facts, preserving all sources/history/revision",()=>{
 const c=productCapacityCase(),expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]},legacy=structuredClone({...expected,version:"wilson-browser-state-v18"});removePurchaseDateFields(legacy.case);const before=structuredClone(legacy);expect(parseBrowserJourneyState(legacy)).toEqual(expected);expect(legacy).toEqual(before);expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v18"})).toThrow();
});

it("retains pending/conflicting alternatives unprinted until explicit conflict resolution",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,source=contextSource("purchase-conflict","Fictional records disagree on purchase date.");
 let state=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"purchase-alts",expectedRevision:c.revision,products:[],sources:[source],proposals:["2026-09-18","2026-09-19"].map((value,i)=>({proposalId:"purchase-"+i,groupId:"purchase-conflict",intent:"alternative"as const,target:{entity:"product"as const,entityId:id,field:"purchaseDate"as const},value:{kind:"known"as const,value},sourceIds:[source.id]}))}).case;
 expect((await inspect(state)).projection.sections.D.suspectProducts[0].purchaseDate).toBeUndefined();
 state=applyCaseCommand(state,{type:"review-proposal-groups",commandId:"accept-purchase-conflict",expectedRevision:state.revision,decisions:[{groupId:"purchase-conflict",action:"accept"}]}).case;
 expect((await inspect(state)).fields[key(0)]??"").toBe("");
 state=applyCaseCommand(state,{type:"resolve-conflict",commandId:"resolve-purchase",expectedRevision:state.revision,target:{entity:"product",entityId:id,field:"purchaseDate"},chosenValueId:"purchase-1",source:contextSource("choose-purchase-date")}).case;expect((await inspect(state)).fields[key(0)]).toBe("19-SEP-2026");
});
it("withdraws a product without losing its purchase history and keeps the remaining product's date with its identity",async()=>{
 let original=productCapacityCase();for(const [i,p]of original.products.slice(0,2).entries())original=setContextFact(original,`product:${p.id}:purchaseDate`,{kind:"known",value:i===0?"2024-02-29":"2026-08-12"});
 const c=applyCaseCommand(original,{type:"withdraw-case-entity",commandId:"withdraw-purchase-first",expectedRevision:original.revision,target:{entity:"product",entityId:original.products[0].id},source:contextSource("withdraw-purchase-first")}).case;
 const r=await inspect(c);expect(r.fields[key(0)]).toBe("12-AUG-2026");expect(r.fields[key(1)]??"").toBe("");expect(c.products[0].facts.purchaseDate).toEqual(original.products[0].facts.purchaseDate);expect(r.projection.sections.D.suspectProducts[0].productId).toBe(original.products[1].id);
});
