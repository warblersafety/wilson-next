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
import {removeCosmeticUseFields} from "../fixtures/pre-dob";
async function inspect(c:ReturnType<typeof productCapacityCase>,name?:string){
 const before=structuredClone(c),projection=projectForm3500(c);
 const r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 expect(r.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const path=join(await mkdtemp(join(tmpdir(),"wilson185-")),"cosmetic.pdf");await writeFile(path,r.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);
 if(name&&process.env.WILSON_COSMETIC_EVIDENCE){await writeFile(join(process.env.WILSON_COSMETIC_EVIDENCE,name+".pdf"),r.output);await writeFile(join(process.env.WILSON_COSMETIC_EVIDENCE,name+"-readback.json"),stdout);}
 return {projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
const native=(i:number,choice:string)=>`topmostSubform[0].Page${i+4}[0].Prod${i+1}[0].${i===0?(choice==="retail"?"Prod1CosRetail":"Prod1CosmProf"):(choice==="retail"?"Pdt2CosRetail":"pdt2CosmProf")}[0]`;
it.each(["professional-use-only","retail"]as const)("prints only explicit cosmetic choice %s in both slots without inference",async value=>{
 let c=productCapacityCase();for(const p of c.products.slice(0,2))c=setContextFact(c,`product:${p.id}:cosmeticUse`,{kind:"known",value});const before=structuredClone(c),r=await inspect(c);
 for(let i=0;i<2;i++){expect(r.fields[native(i,value)]).toBe("/1");expect(r.fields[native(i,value==="retail"?"professional-use-only":"retail")]).not.toBe("/1");}
 expect(c).toEqual(before);for(let i=0;i<2;i++)expect(c.products[i].facts.productType).toEqual(productCapacityCase().products[i].facts.productType);
});
it("preserves independent drug labels, qualifier/source and corrects one choice without changing any unrelated native controls",async()=>{
 const base=productCapacityCase(),original=await inspect(base);let c=base;for(const [i,p]of c.products.slice(0,2).entries())c=setContextFact(c,`product:${p.id}:cosmeticUse`,{kind:"known",value:i===0?"professional-use-only":"retail",...(i===0?{qualifier:"label wording supplied, no category inference"}:{})});
 c=setContextFact(c,`product:${c.products[0].id}:medicationType`,{kind:"known",value:["brand","otc"]});
 const r=await inspect(c,"cosmetics-both");expect(r.fields[native(0,"professional-use-only")]).toBe("/1");expect(r.fields[native(1,"retail")]).toBe("/1");
 expect(r.projection.sections.D.suspectProducts[0].medicationType).toEqual(["brand","otc"]);expect(r.projection.sourceTrace["sections.D.suspectProducts.0.cosmeticUse"]).toEqual(c.products[0].facts.cosmeticUse.resolvedValue!.sourceIds);
 expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${c.products[0].id}:cosmeticUse`,reason:"qualifier-not-included",baseValueIncluded:true}));
 c=setContextFact(c,`product:${c.products[1].id}:cosmeticUse`,{kind:"known",value:"professional-use-only"});const corrected=await inspect(c,"cosmetics-corrected");
 expect(corrected.fields[native(1,"retail")]).not.toBe("/1");expect(corrected.fields[native(1,"professional-use-only")]).toBe("/1");
 const unrelated=(f:Record<string,string>)=>Object.fromEntries(Object.entries(f).filter(([k])=>!k.includes("CosRetail")&&!k.includes("CosmProf")));expect(unrelated(corrected.fields)).toEqual(unrelated(r.fields));
 expect(Object.keys(original.fields).some(k=>k.includes("CosRetail")||k.includes("CosmProf"))).toBe(false);
 expect(c.products[1].facts.cosmeticUse.supersededValues.length).toBeGreaterThan(0);
});
it.each(["both",["professional-use-only","retail"],true,null,{},["retail"]])("rejects unsupported or multiple cosmetic selections %j without mutation or arbitrary choice",async value=>{
 const c=productCapacityCase(),before=structuredClone(c);expect(()=>setContextFact(c,`product:${c.products[0].id}:cosmeticUse`,{kind:"known",value})).toThrow("exactly one");
 const p=projectForm3500(c);(p.sections.D.suspectProducts[0]as unknown as {cosmeticUse:unknown}).cosmeticUse=value;await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p)).rejects.toThrow("one supported choice");expect(c).toEqual(before);
});
it.each(["unknown","declined","explicitly-absent","inapplicable"]as const)("keeps %s distinct and retains history with both boxes blank",async kind=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:cosmeticUse`,{kind:"known",value:"retail"});c=setContextFact(c,`product:${id}:cosmeticUse`,{kind});const r=await inspect(c);for(const choice of["retail","professional-use-only"])expect(r.fields[native(0,choice)]).not.toBe("/1");expect(c.products[0].facts.cosmeticUse.supersededValues.length).toBeGreaterThan(0);expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${id}:cosmeticUse`,reason:kind}));
});
it("strictly upgrades genuine v19 with only empty cosmetic facts and never fills from product name/category",async()=>{
 const c=productCapacityCase(),expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]},legacy=structuredClone({...expected,version:"wilson-browser-state-v19"});removeCosmeticUseFields(legacy.case);const before=structuredClone(legacy);expect(parseBrowserJourneyState(legacy)).toEqual(expected);expect(legacy).toEqual(before);expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v19"})).toThrow();const r=await inspect(c);expect(r.projection.sections.D.suspectProducts.every(p=>p.cosmeticUse===undefined)).toBe(true);
});

it("retains pending/conflicting alternatives unprinted until explicit conflict resolution",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,source=contextSource("cosmetic-conflict","Fictional records disagree on cosmetic product type.");
 let state=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"cosmetic-alts",expectedRevision:c.revision,products:[],sources:[source],proposals:["professional-use-only","retail"].map((value,i)=>({proposalId:"cosmetic-"+i,groupId:"cosmetic-conflict",intent:"alternative"as const,target:{entity:"product"as const,entityId:id,field:"cosmeticUse"as const},value:{kind:"known"as const,value},sourceIds:[source.id]}))}).case;
 expect((await inspect(state)).projection.sections.D.suspectProducts[0].cosmeticUse).toBeUndefined();
 state=applyCaseCommand(state,{type:"review-proposal-groups",commandId:"accept-cosmetic-conflict",expectedRevision:state.revision,decisions:[{groupId:"cosmetic-conflict",action:"accept"}]}).case;
 for(const choice of["retail","professional-use-only"])expect((await inspect(state)).fields[native(0,choice)]).not.toBe("/1");
 state=applyCaseCommand(state,{type:"resolve-conflict",commandId:"resolve-cosmetic",expectedRevision:state.revision,target:{entity:"product",entityId:id,field:"cosmeticUse"},chosenValueId:"cosmetic-1",source:contextSource("choose-cosmetic-choice")}).case;expect((await inspect(state)).fields[native(0,"retail")]).toBe("/1");
});
it("retains cosmetic knowledge on device/concomitant/unknown routes with truthful disclosure, without changing category",async()=>{
 const base=productCapacityCase();for(const value of["device","unknown","concomitant"]){let c=structuredClone(base);c.products=c.products.slice(0,2);const id=c.products[0].id;c=setContextFact(c,`product:${id}:cosmeticUse`,{kind:"known",value:"retail"});c=setContextFact(c,`product:${id}:${value==="concomitant"?"role":"productType"}`,value==="unknown"?{kind:"unknown"}:{kind:"known",value});const p=projectForm3500(c);expect(p.sections.D.suspectProducts.every(p=>p.cosmeticUse===undefined)).toBe(true);if(value==="unknown")expect(p.omissions).toContainEqual(expect.objectContaining({target:`product:${id}:productType`,reason:"unknown"}));else expect(p.notIncluded.join(" ")).toContain("Cosmetic");expect(c.products[0].facts.cosmeticUse.resolvedValue?.value).toEqual({kind:"known",value:"retail"});}
});
it("keeps cosmetic choice attached to identity after earlier product withdrawal",async()=>{
 let original=productCapacityCase();for(const [i,p]of original.products.slice(0,2).entries())original=setContextFact(original,`product:${p.id}:cosmeticUse`,{kind:"known",value:i===0?"professional-use-only":"retail"});
 const c=applyCaseCommand(original,{type:"withdraw-case-entity",commandId:"withdraw-cosmetic",expectedRevision:original.revision,target:{entity:"product",entityId:original.products[0].id},source:contextSource("withdraw-cosmetic")}).case,r=await inspect(c);
 expect(r.fields[native(0,"retail")]).toBe("/1");expect(r.fields[native(0,"professional-use-only")]).not.toBe("/1");expect(r.fields[native(1,"retail")]).not.toBe("/1");expect(c.products[0].facts.cosmeticUse).toEqual(original.products[0].facts.cosmeticUse);
});
