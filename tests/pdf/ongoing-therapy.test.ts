import {createUnderstandingView} from "../../src/domain/case/views";
import {expect,it} from "vitest";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {productCapacityCase} from "../fixtures/product-capacity";
import {applyCaseCommand} from "../../src/domain/case/commands";
import {setContextFact,contextSource} from "../fixtures/reviewed-context";
import {projectForm3500} from "../../src/domain/case/projection";
import {fillForm3500Projection} from "../../src/server/pdf/form-3500";
import {parseBrowserJourneyState,browserStateVersion} from "../../src/server/case/browser-state";
import {removeOngoingFields} from "../fixtures/pre-dob";
const prefix=(i:number)=>`topmostSubform[0].Page${i+4}[0].Prod${i+1}[0].Prod${i+1}TherapyOngoing`;
async function inspect(c:ReturnType<typeof productCapacityCase>,name?:string){
 const before=structuredClone(c),projection=projectForm3500(c);
 const r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 expect(r.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const path=join(await mkdtemp(join(tmpdir(),"wilson176-")),"ongoing.pdf");await writeFile(path,r.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);
 if(name&&process.env.WILSON_ONGOING_EVIDENCE){await writeFile(join(process.env.WILSON_ONGOING_EVIDENCE,name+".pdf"),r.output);await writeFile(join(process.env.WILSON_ONGOING_EVIDENCE,name+"-readback.json"),stdout);}
 return {projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
const checked=(v:string)=>Boolean(v&&v!=="/Off");
it.each([true,false])("maps explicit ongoing %s independently for both suspect slots and preserves all dates",async value=>{
 let c=productCapacityCase();for(const p of c.products.filter(p=>p.facts.role.resolvedValue?.value.kind==="known"&&p.facts.role.resolvedValue.value.value==="suspect")){
 c=setContextFact(c,`product:${p.id}:therapyOngoing`,{kind:"known",value,qualifier:"explicit current status; historical stop retained"});}
 const before=structuredClone(c),r=await inspect(c,value?"ongoing-yes":"ongoing-no");
 for(let i=0;i<2;i++){expect(checked(r.fields[prefix(i)+"Yes[0]"])).toBe(value);expect(checked(r.fields[prefix(i)+"No[0]"])).toBe(!value);expect(r.projection.sections.D.suspectProducts[i].therapyOngoing).toBe(value);}
 expect(c).toEqual(before);expect(r.projection.omissions.some(o=>o.reason==="qualifier-not-included"&&o.target.endsWith(":therapyOngoing"))).toBe(true);
});
it("does not infer current status from absent stop dates or historical stopping/restart facts",async()=>{
 let c=productCapacityCase();for(const p of c.products){c=setContextFact(c,`product:${p.id}:stopped`,{kind:"known",value:true});c=setContextFact(c,`product:${p.id}:restarted`,{kind:"known",value:true});}
 const r=await inspect(c);for(let i=0;i<2;i++){expect(r.projection.sections.D.suspectProducts[i].therapyOngoing).toBeUndefined();expect(checked(r.fields[prefix(i)+"Yes[0]"])).toBe(false);expect(checked(r.fields[prefix(i)+"No[0]"])).toBe(false);}
});
it.each(["unknown","declined","explicitly-absent","inapplicable"] as const)("keeps %s distinct, blank and disclosed after correcting an explicit yes",async kind=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:therapyOngoing`,{kind:"known",value:true});c=setContextFact(c,`product:${id}:therapyOngoing`,{kind});const r=await inspect(c);
 expect(r.projection.sections.D.suspectProducts[0].therapyOngoing).toBeUndefined();expect(c.products[0].facts.therapyOngoing.supersededValues.length).toBeGreaterThan(0);
 for(const suffix of ["Yes","No"])expect(checked(r.fields[prefix(0)+suffix+"[0]"])).toBe(false);
 expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${id}:therapyOngoing`,reason:kind}));
});
it("preserves explicit contradictory dates and status without silently choosing an interpretation",async()=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:stopDate`,{kind:"known",value:"2026-08-20"});c=setContextFact(c,`product:${id}:therapyOngoing`,{kind:"known",value:true,qualifier:"current ongoing report; stop date also supplied, not reconciled"});
 const r=await inspect(c);expect(r.projection.sections.D.suspectProducts[0]).toMatchObject({therapyOngoing:true,stopDate:"2026-08-20"});expect(c.products[0].facts.stopDate.resolvedValue?.value).toEqual({kind:"known",value:"2026-08-20"});
});
it("preserves knowledge but discloses no D3 checkbox destination for concomitant products or devices",async()=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:therapyOngoing`,{kind:"known",value:false});c=setContextFact(c,`product:${id}:role`,{kind:"known",value:"concomitant"});
 let p=projectForm3500(c);expect(p.notIncluded.join(" ")).toContain("Therapy ongoing remains in reviewed knowledge");
 c=setContextFact(c,`product:${id}:role`,{kind:"known",value:"suspect"});c=setContextFact(c,`product:${id}:productType`,{kind:"known",value:"device"});p=projectForm3500(c);expect(p.notIncluded.join(" ")).toContain("Therapy ongoing remains in reviewed knowledge");
});
it("strictly upgrades a genuine v15 with only empty new facts while retaining A5, DOB, dates and history",()=>{
 let c=productCapacityCase();c=setContextFact(c,"patient:patient:raceEthnicity",{kind:"known",value:["asian"]});const expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]};const legacy=structuredClone({...expected,version:"wilson-browser-state-v15"});removeOngoingFields(legacy.case);const before=structuredClone(legacy);expect(parseBrowserJourneyState(legacy)).toEqual(expected);expect(legacy).toEqual(before);
 expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v15"})).toThrow();expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v99"})).toThrow();
});
it.each(["yes",1,null,[]])("rejects unsupported ongoing value %j without coercion",value=>{
 const c=productCapacityCase();expect(()=>setContextFact(c,`product:${c.products[0].id}:therapyOngoing`,{kind:"known",value})).toThrow();
});

it("keeps pending alternatives unpromoted and conflicting accepted status blank until explicit resolution",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,source=contextSource("ongoing-conflict","Fictional records disagree whether current therapy is still ongoing.");
 let state=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"ongoing-alternatives",expectedRevision:c.revision,products:[],sources:[source],proposals:[true,false].map((value,i)=>({proposalId:"ongoing-"+i,groupId:"ongoing-conflict",intent:"alternative" as const,target:{entity:"product" as const,entityId:id,field:"therapyOngoing" as const},value:{kind:"known" as const,value},sourceIds:[source.id]}))}).case;
 expect((await inspect(state)).projection.sections.D.suspectProducts[0].therapyOngoing).toBeUndefined();
 state=applyCaseCommand(state,{type:"review-proposal-groups",commandId:"accept-ongoing-conflict",expectedRevision:state.revision,decisions:[{groupId:"ongoing-conflict",action:"accept"}]}).case;
 expect(state.products[0].facts.therapyOngoing.state).toBe("conflicted");const r=await inspect(state);
 expect(r.projection.sections.D.suspectProducts[0].therapyOngoing).toBeUndefined();for(const suffix of ["Yes","No"])expect(checked(r.fields[prefix(0)+suffix+"[0]"])).toBe(false);
 state=applyCaseCommand(state,{type:"resolve-conflict",commandId:"resolve-ongoing",expectedRevision:state.revision,target:{entity:"product",entityId:id,field:"therapyOngoing"},chosenValueId:"ongoing-1",source:contextSource("explicit-ongoing-choice")}).case;expect((await inspect(state)).projection.sections.D.suspectProducts[0].therapyOngoing).toBe(false);
});
it("rejects malformed direct PDF ongoing projections instead of silently printing a blank response",async()=>{
 const p=projectForm3500(productCapacityCase());(p.sections.D.suspectProducts[0] as unknown as {therapyOngoing:unknown}).therapyOngoing="yes";
 await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p)).rejects.toThrow("D3 ongoing therapy");
});

it("visibly flags only explicit stopped/never-restarted/ongoing answers without changing or resolving them",()=>{
 let c=productCapacityCase();const id=c.products[0].id;
 c=setContextFact(c,`product:${id}:therapyOngoing`,{kind:"known",value:true});
 expect(createUnderstandingView(c).products[0].medicationNotice??"").not.toContain("never restarted");
 c=setContextFact(c,`product:${id}:stopped`,{kind:"known",value:true});
 c=setContextFact(c,`product:${id}:restarted`,{kind:"known",value:false});const before=structuredClone(c);
 expect(createUnderstandingView(c).products[0].medicationNotice).toContain("reported stopped and never restarted");
 expect(projectForm3500(c).notIncluded.join(" ")).toContain("Wilson has not reconciled");
 expect(projectForm3500(c).sections.D.suspectProducts[0].therapyOngoing).toBe(true);expect(c).toEqual(before);
 c=setContextFact(c,`product:${id}:restarted`,{kind:"known",value:true});expect(createUnderstandingView(c).products[0].medicationNotice??"").not.toContain("never restarted");
});
it("changes only the four native ongoing widgets when current status changes",async()=>{
 const before=await inspect(productCapacityCase());let c=productCapacityCase();for(const p of c.products.slice(0,2))c=setContextFact(c,`product:${p.id}:therapyOngoing`,{kind:"known",value:true});const after=await inspect(c);
 const unrelated=(f:Record<string,string>)=>Object.fromEntries(Object.entries(f).filter(([key])=>!key.includes("TherapyOngoing")));
 expect(unrelated(after.fields)).toEqual(unrelated(before.fields));
});
