import {createHash} from "node:crypto";
import {expect,it} from "vitest";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {NextRequest} from "next/server";
import {postCase} from "../../app/api/case/route";
import {applyCaseCommand} from "../../src/domain/case/commands";
import {isCompleteCalendarDate} from "../../src/domain/case/calendar-date";
import {createUnderstandingView} from "../../src/domain/case/views";
import {productCapacityCase} from "../fixtures/product-capacity";
import {setContextFact,contextSource} from "../fixtures/reviewed-context";
import {projectForm3500} from "../../src/domain/case/projection";
import {fillForm3500Projection} from "../../src/server/pdf/form-3500";
import {parseBrowserJourneyState,browserStateVersion} from "../../src/server/case/browser-state";
import {removeReductionDateFields} from "../fixtures/pre-dob";
const key=(i:number)=>`topmostSubform[0].Page${i+4}[0].Prod${i+1}[0].Prod${i+1}TherapyReduceDate[0]`;
async function inspect(c:ReturnType<typeof productCapacityCase>,name?:string){
 const before=structuredClone(c),projection=projectForm3500(c);
 const r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 expect(r.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const path=join(await mkdtemp(join(tmpdir(),"wilson178-")),"reduction.pdf");await writeFile(path,r.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);
 if(name&&process.env.WILSON_REDUCTION_EVIDENCE){await writeFile(join(process.env.WILSON_REDUCTION_EVIDENCE,name+".pdf"),r.output);await writeFile(join(process.env.WILSON_REDUCTION_EVIDENCE,name+"-readback.json"),stdout);await writeFile(join(process.env.WILSON_REDUCTION_EVIDENCE,name+"-case-proof.json"),JSON.stringify({caseId:c.id,revision:c.revision,pdfSha256:createHash("sha256").update(r.output).digest("hex"),products:c.products.slice(0,2).map(p=>({id:p.id,facts:Object.fromEntries(["stopped","doseReduced","doseReductionDate"].map(field=>[field,p.facts[field as keyof typeof p.facts]]))})),projection:projection.sections.D},null,2)+"\n");}
 return {projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
it.each(["0001-01-01","2000-02-29","2028-02-29","9999-12-31"])("retains complete Gregorian date %s without calendar arithmetic or correction",async date=>{
 let c=productCapacityCase();c=setContextFact(c,`product:${c.products[0].id}:doseReductionDate`,{kind:"known",value:date});expect(isCompleteCalendarDate(date)).toBe(true);expect((await inspect(c)).projection.sections.D.suspectProducts[0].doseReductionDate).toBe(date);
});
it("maps separate dates to both native slots, preserves all other native fields, and discloses omitted exact qualifier",async()=>{
 const base=productCapacityCase(),baseline=await inspect(base);let c=base;
 c=setContextFact(c,`product:${c.products[0].id}:doseReductionDate`,{kind:"known",value:"2028-02-29",qualifier:"clinician's best estimate, exact supplied date"});
 c=setContextFact(c,`product:${c.products[1].id}:doseReductionDate`,{kind:"known",value:"2026-09-18"});const r=await inspect(c,"reduction-both");
 expect(r.fields[key(0)]).toBe("29-FEB-2028");expect(r.fields[key(1)]).toBe("18-SEP-2026");
 const unrelated=(f:Record<string,string>)=>Object.fromEntries(Object.entries(f).filter(([k])=>!k.includes("TherapyReduceDate")));expect(unrelated(r.fields)).toEqual(unrelated(baseline.fields));
 expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${c.products[0].id}:doseReductionDate`,reason:"qualifier-not-included",baseValueIncluded:true}));
 expect(c.products[0].facts.doseReduced).toEqual(base.products[0].facts.doseReduced);
});
it.each(["2026","2026-09","2026-02-29","1900-02-29","2026-04-31","0000-01-01","2026-13-01","2026-01-00","2026-9-01",null,20260918])("rejects partial/impossible/coerced accepted date %j with no state mutation or PDF repair",async value=>{
 const c=productCapacityCase(),before=structuredClone(c),id=c.products[0].id;expect(isCompleteCalendarDate(value)).toBe(false);expect(()=>setContextFact(c,`product:${id}:doseReductionDate`,{kind:"known",value})).toThrow("complete valid");
 const p=projectForm3500(c);(p.sections.D.suspectProducts[0]as unknown as{doseReductionDate:unknown}).doseReductionDate=value;await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p)).rejects.toThrow("D3 dose-reduction date");expect(c).toEqual(before);
});
it.each(["unknown","declined","explicitly-absent","inapplicable"]as const)("preserves %s distinctly, with history but blank native date after correction",async kind=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:doseReductionDate`,{kind:"known",value:"2026-09-18"});c=setContextFact(c,`product:${id}:doseReductionDate`,{kind});const r=await inspect(c);expect(r.fields[key(0)]??"").toBe("");expect(c.products[0].facts.doseReductionDate.supersededValues.length).toBeGreaterThan(0);expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`product:${id}:doseReductionDate`,reason:kind}));
});
it("does not infer reduction or date, and visibly retains explicitly contradictory supplied facts",async()=>{
 const base=productCapacityCase();let c=setContextFact(base,`product:${base.products[0].id}:doseReduced`,{kind:"known",value:true});expect((await inspect(c)).projection.sections.D.suspectProducts[0].doseReductionDate).toBeUndefined();
 c=setContextFact(c,`product:${c.products[0].id}:doseReduced`,{kind:"known",value:false});c=setContextFact(c,`product:${c.products[0].id}:stopped`,{kind:"known",value:false});c=setContextFact(c,`product:${c.products[0].id}:doseReductionDate`,{kind:"known",value:"2026-09-18"});const before=structuredClone(c),r=await inspect(c,"reduction-contradiction");
 expect(r.fields[key(0)]).toBe("18-SEP-2026");expect(r.projection.sections.D.suspectProducts[0].improvedAfterChange).toBeUndefined();expect(r.projection.omissions).toContainEqual(expect.objectContaining({reason:"reduction-date-conflict"}));for(const answer of["Yes","No","NA"])expect(r.fields["topmostSubform[0].Page4[0].Prod1[0].Prod1Abated"+answer+"[0]"]).not.toBe("/1");expect(c.products[0].facts.doseReduced.resolvedValue?.value).toEqual({kind:"known",value:false});expect(createUnderstandingView(c).products[0].medicationNotice).toContain("dose reduction is explicitly reported");
 expect(r.projection.notIncluded.join(" ")).toContain("Wilson has not reconciled");expect(c).toEqual(before);
 c=setContextFact(c,`product:${c.products[0].id}:doseReduced`,{kind:"unknown"});expect(createUnderstandingView(c).products[0].medicationNotice??"").not.toContain("dose reduction is explicitly reported");
});
it("retains pending/conflicting alternatives unprinted until explicit conflict resolution",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,source=contextSource("reduction-conflict","Fictional records disagree on reduction date.");
 let state=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"reduction-alts",expectedRevision:c.revision,products:[],sources:[source],proposals:["2026-09-18","2026-09-19"].map((value,i)=>({proposalId:"reduction-"+i,groupId:"reduction-conflict",intent:"alternative"as const,target:{entity:"product"as const,entityId:id,field:"doseReductionDate"as const},value:{kind:"known"as const,value},sourceIds:[source.id]}))}).case;
 expect((await inspect(state)).projection.sections.D.suspectProducts[0].doseReductionDate).toBeUndefined();
 state=applyCaseCommand(state,{type:"review-proposal-groups",commandId:"accept-reduction-conflict",expectedRevision:state.revision,decisions:[{groupId:"reduction-conflict",action:"accept"}]}).case;
 expect((await inspect(state)).fields[key(0)]??"").toBe("");
 state=applyCaseCommand(state,{type:"resolve-conflict",commandId:"resolve-reduction",expectedRevision:state.revision,target:{entity:"product",entityId:id,field:"doseReductionDate"},chosenValueId:"reduction-1",source:contextSource("choose-reduction-date")}).case;expect((await inspect(state)).fields[key(0)]).toBe("19-SEP-2026");
});
it("strictly upgrades genuine v16 with only empty reduction-date facts and does not revalidate unrelated legacy accepted dates",()=>{
 let c=productCapacityCase();c=setContextFact(c,`product:${c.products[0].id}:therapyOngoing`,{kind:"known",value:true});c=setContextFact(c,`product:${c.products[0].id}:startDate`,{kind:"known",value:"2026-02-31"});
 const expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]},legacy=structuredClone({...expected,version:"wilson-browser-state-v16"});removeReductionDateFields(legacy.case);const before=structuredClone(legacy);
 expect(parseBrowserJourneyState(legacy)).toEqual(expected);expect(legacy).toEqual(before);expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v16"})).toThrow();expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v18"})).toThrow();
 const malformed=structuredClone(expected);malformed.case=structuredClone(setContextFact(c,`product:${c.products[0].id}:doseReductionDate`,{kind:"known",value:"2026-09-18"}));malformed.case.products[0].facts.doseReductionDate.resolvedValue!.value={kind:"known",value:"2026-02-31"};expect(()=>parseBrowserJourneyState(malformed)).toThrow();
});
it("discloses accepted date knowledge with no native destination after device/concomitant routing",()=>{
 let c=productCapacityCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:doseReductionDate`,{kind:"known",value:"2026-09-18"});c=setContextFact(c,`product:${id}:role`,{kind:"known",value:"concomitant"});expect(projectForm3500(c).notIncluded.join(" ")).toContain("Dose reduction date remains in reviewed knowledge");
 c=setContextFact(c,`product:${id}:role`,{kind:"known",value:"suspect"});c=setContextFact(c,`product:${id}:productType`,{kind:"known",value:"device"});expect(projectForm3500(c).notIncluded.join(" ")).toContain("Dose reduction date remains in reviewed knowledge");
});
it("rejects partial direct API acceptance without mutation or model calls",async()=>{
 const c=productCapacityCase(),state={version:browserStateVersion,stage:"output",case:c,unrepresented:[]},before=structuredClone(state);let calls=0;
 const response=await postCase(new NextRequest("http://wilson.test/api/case",{method:"POST",headers:{host:"wilson.test",origin:"http://wilson.test","content-type":"application/json"},body:JSON.stringify({operation:"act",state,expectedRevision:state.case.revision,action:{action:"set-fact",target:`product:${c.products[0].id}:doseReductionDate`,value:{kind:"known",value:"2026-09"}}})}),{propose:async()=>{calls++;throw new Error("No model calls");}});expect(response.status).toBe(400);expect(calls).toBe(0);expect(state).toEqual(before);
});

it.each([false,"inapplicable"]as const)("does not derive D7 Doesn't apply from %j withdrawal answers when a reviewed reduction date contradicts them in either slot",async negative=>{
 let c=productCapacityCase();for(const p of c.products.slice(0,2)){for(const field of["stopped","doseReduced"]as const)c=setContextFact(c,`product:${p.id}:${field}`,negative===false?{kind:"known",value:false}:{kind:"inapplicable"});c=setContextFact(c,`product:${p.id}:doseReductionDate`,{kind:"known",value:"2026-09-18"});}
 let r=await inspect(c);for(let i=0;i<2;i++){expect(r.projection.sections.D.suspectProducts[i].improvedAfterChange).toBeUndefined();for(const answer of["Yes","No","NA"])expect(r.fields[`topmostSubform[0].Page${i+4}[0].Prod${i+1}[0].Prod${i+1}Abated${answer}[0]`]).not.toBe("/1");}
 const id=c.products[0].id;c=setContextFact(c,`product:${id}:doseReductionDate`,{kind:"unknown"});r=await inspect(c);expect(r.projection.sections.D.suspectProducts[0].improvedAfterChange).toBe("inapplicable");expect(r.fields["topmostSubform[0].Page4[0].Prod1[0].Prod1AbatedNA[0]"]).toBe("/1");
});

it("uses the case-level product identity in the D7 conflict note when an earlier product routes elsewhere",()=>{
 let c=productCapacityCase();c=setContextFact(c,`product:${c.products[0].id}:productType`,{kind:"known",value:"device"});const id=c.products[1].id;
 c=setContextFact(c,`product:${id}:name`,{kind:"unknown"});c=setContextFact(c,`product:${id}:stopped`,{kind:"known",value:false});c=setContextFact(c,`product:${id}:doseReduced`,{kind:"known",value:false});c=setContextFact(c,`product:${id}:doseReductionDate`,{kind:"known",value:"2026-09-18"});
 const p=projectForm3500(c);expect(p.notIncluded).toContainEqual(expect.stringContaining("Product 2 — D7 is left blank"));expect(p.notIncluded).not.toContainEqual(expect.stringContaining("Product 1 — D7 is left blank"));expect(p.omissions).toContainEqual(expect.objectContaining({target:`product:${id}:improvedAfterChange`,reason:"reduction-date-conflict"}));
});
