import {expect,it} from "vitest";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {applyCaseCommand} from "../../src/domain/case/commands";
import {durationUnits,durationNativeUnits,isTreatmentDuration,d3ChoiceIssue} from "../../src/domain/case/duration";
import {createUnderstandingView} from "../../src/domain/case/views";
import {productCapacityCase} from "../fixtures/product-capacity";
import {setContextFact,contextSource} from "../fixtures/reviewed-context";
import {projectForm3500} from "../../src/domain/case/projection";
import {fillForm3500Projection} from "../../src/server/pdf/form-3500";
import {parseBrowserJourneyState,browserStateVersion} from "../../src/server/case/browser-state";
import {removeDurationFields} from "../fixtures/pre-dob";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {getJourneySnapshot} from "../../src/server/journey/service";
const prefix=(i:number)=>`topmostSubform[0].Page${i+4}[0].Prod${i+1}[0].Prod${i+1}`;
async function inspect(c:ReturnType<typeof productCapacityCase>,name?:string){
 const before=structuredClone(c),projection=projectForm3500(c),r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 expect(r.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const path=join(await mkdtemp(join(tmpdir(),"wilson181-")),"duration.pdf");await writeFile(path,r.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);
 if(name&&process.env.WILSON_DURATION_EVIDENCE){await writeFile(join(process.env.WILSON_DURATION_EVIDENCE,name+".pdf"),r.output);await writeFile(join(process.env.WILSON_DURATION_EVIDENCE,name+"-readback.json"),stdout);}
 return{projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
function durationCase(unit:typeof durationUnits[number]="hours",value="1.50"){
 let c=productCapacityCase();for(const p of c.products.slice(0,2)){c=setContextFact(c,`product:${p.id}:treatmentDuration`,{kind:"known",value:{value,unit},qualifier:"explicitly supplied estimate"});c=setContextFact(c,`product:${p.id}:d3Value`,{kind:"known",value:"duration"});}return c;
}
it.each(durationUnits)("maps explicit %s in both native slots, preserving amount spelling, sources and independent date facts",async unit=>{
 const c=durationCase(unit),r=await inspect(c,unit==="hours"?"duration-hours":unit==="months"?"duration-months":undefined);
 for(let i=0;i<2;i++){expect(r.fields[prefix(i)+"TherapyDuration[0]"]).toBe("1.50");expect(r.fields[prefix(i)+"TherapyDurUnit[0]"]).toBe(durationNativeUnits[unit]);expect(r.fields[prefix(i)+"TherapyStartDate[0]"]??"").toBe("");expect(c.products[i].facts.startDate.resolvedValue).toBeDefined();expect(r.projection.sections.D.suspectProducts[i].treatmentDuration).toEqual({value:"1.50",unit});expect(r.projection.sourceTrace[`sections.D.suspectProducts.${i}.treatmentDuration`]).toEqual(c.products[i].facts.treatmentDuration.resolvedValue!.sourceIds);}
 expect(r.projection.omissions).toContainEqual(expect.objectContaining({reason:"d3-alternative-not-selected"}));expect(r.projection.omissions).toContainEqual(expect.objectContaining({reason:"qualifier-not-included",baseValueIncluded:true}));
});
const invalid:unknown[]=[{value:"",unit:"days"},{value:"2",unit:""},{value:2,unit:"days"},{value:"0",unit:"days"},{value:"-1",unit:"days"},{value:"1e3",unit:"days"},{value:"1.5",unit:"doses"},{value:"2-3",unit:"days"},{value:"1",unit:"fortnights"},{value:"1",unit:"hours",extra:true},null];
it.each(invalid.map(value=>({value})))("rejects invalid/incomplete/unsupported duration pair $value without coercion or invented units",async({value})=>{
 const c=productCapacityCase();expect(isTreatmentDuration(value)).toBe(false);expect(()=>setContextFact(c,`product:${c.products[0].id}:treatmentDuration`,{kind:"known",value})).toThrow("explicit positive");
 const p=projectForm3500(c);(p.sections.D.suspectProducts[0]as unknown as{treatmentDuration:unknown}).treatmentDuration=value;await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p)).rejects.toThrow("Unsupported D3");
});
it("requires an explicit print alternative when both are known and clears unavailable choices without changing either fact",async()=>{
 let c=durationCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:d3Value`,{kind:"unknown"});expect(d3ChoiceIssue(c.products[0].facts)).toContain("both retained");
 let s=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id);expect(s.outputIssues).toContainEqual(expect.objectContaining({code:"product-d3-choice-required"}));await expect(inspect(c)).rejects.toThrow("explicit dates or duration");
 const before=structuredClone(c);c=setContextFact(c,`product:${id}:d3Value`,{kind:"known",value:"dates"});let r=await inspect(c,"duration-choice-dates");expect(r.projection.sections.D.suspectProducts[0].treatmentDuration).toBeUndefined();expect(r.projection.sections.D.suspectProducts[0].startDate).toBeDefined();expect(c.products[0].facts.treatmentDuration).toEqual(before.products[0].facts.treatmentDuration);
 c=setContextFact(c,`product:${id}:treatmentDuration`,{kind:"unknown"});c=setContextFact(c,`product:${id}:d3Value`,{kind:"known",value:"duration"});expect(d3ChoiceIssue(c.products[0].facts)).toContain("no known duration");
 c=setContextFact(c,`product:${id}:d3Value`,{kind:"unknown"});expect(d3ChoiceIssue(c.products[0].facts)).toBeUndefined();
});
it("never calculates duration from dates or derives dates/reduction/ongoing status from duration",async()=>{
 const c=productCapacityCase();expect(projectForm3500(c).sections.D.suspectProducts[0].treatmentDuration).toBeUndefined();const changed=durationCase("days","0.50");for(let i=0;i<2;i++)for(const f of["startDate","stopDate","doseReduced","doseReductionDate","therapyOngoing"]as const)expect(changed.products[i].facts[f]).toEqual(c.products[i].facts[f]);
 expect(createUnderstandingView(changed).products[0].medicationNotice).toContain("not calculated or reconciled");
});
it.each(["unknown","declined","explicitly-absent","inapplicable"]as const)("keeps %s distinct, preserving history while native duration is blank",async kind=>{
 let c=durationCase();const id=c.products[0].id;c=setContextFact(c,`product:${id}:treatmentDuration`,{kind});c=setContextFact(c,`product:${id}:d3Value`,{kind:"unknown"});const r=await inspect(c);expect(r.fields[prefix(0)+"TherapyDuration[0]"]??"").toBe("");expect(r.projection.sections.D.suspectProducts[0].treatmentDuration).toBeUndefined();expect(c.products[0].facts.treatmentDuration.supersededValues.length).toBeGreaterThan(0);
});
it("retains an oversized supplied amount but blocks native output rather than shrinking or truncating it",async()=>{
 const c=durationCase("days","123456789012345678901234567890");const s=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id);expect(s.outputIssues).toContainEqual(expect.objectContaining({code:"unsupported-treatment-duration"}));await expect(inspect(c)).rejects.toThrow("Unsupported D3");
});
it("strictly upgrades genuine v17 with only empty duration and print-choice facts, preserving all earlier data",()=>{
 const c=productCapacityCase(),expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]},old=structuredClone({...expected,version:"wilson-browser-state-v17"});removeDurationFields(old.case);const before=structuredClone(old);expect(parseBrowserJourneyState(old)).toEqual(expected);expect(old).toEqual(before);expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v17"})).toThrow();expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v19"})).toThrow();
});
it("keeps pending duration alternatives unpromoted and conflicting values unprinted until explicit resolution",()=>{
 const c=productCapacityCase(),id=c.products[0].id,source=contextSource("duration-conflict","Fictional records disagree on supplied duration.");let state=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"duration-alts",expectedRevision:c.revision,products:[],sources:[source],proposals:["1.50","2"].map((value,i)=>({proposalId:"duration-"+i,groupId:"duration-conflict",intent:"alternative"as const,target:{entity:"product"as const,entityId:id,field:"treatmentDuration"as const},value:{kind:"known"as const,value:{value,unit:"hours"as const}},sourceIds:[source.id]}))}).case;expect(projectForm3500(state).sections.D.suspectProducts[0].treatmentDuration).toBeUndefined();
 state=applyCaseCommand(state,{type:"review-proposal-groups",commandId:"accept-duration-alts",expectedRevision:state.revision,decisions:[{groupId:"duration-conflict",action:"accept"}]}).case;expect(projectForm3500(state).sections.D.suspectProducts[0].treatmentDuration).toBeUndefined();
 state=applyCaseCommand(state,{type:"resolve-conflict",commandId:"resolve-duration",expectedRevision:state.revision,target:{entity:"product",entityId:id,field:"treatmentDuration"},chosenValueId:"duration-1",source:contextSource("choose-duration")}).case;expect(state.products[0].facts.treatmentDuration.resolvedValue!.value).toEqual({kind:"known",value:{value:"2",unit:"hours"}});
});
it("retains duration knowledge without a native destination after device/concomitant routing",()=>{
 let c=durationCase(),id=c.products[0].id;c=setContextFact(c,`product:${id}:role`,{kind:"known",value:"concomitant"});expect(projectForm3500(c).notIncluded.join(" ")).toContain("Treatment duration remains in reviewed knowledge");c=setContextFact(c,`product:${id}:role`,{kind:"known",value:"suspect"});c=setContextFact(c,`product:${id}:productType`,{kind:"known",value:"device"});expect(projectForm3500(c).notIncluded.join(" ")).toContain("Treatment duration remains in reviewed knowledge");
});

it("prints a sole known duration without inventing dates or requiring a default preference",async()=>{
 let c=durationCase("minutes","45");const id=c.products[0].id;for(const field of["startDate","stopDate","doseReductionDate"]as const)c=setContextFact(c,`product:${id}:${field}`,{kind:"unknown"});c=setContextFact(c,`product:${id}:d3Value`,{kind:"unknown"});
 expect(d3ChoiceIssue(c.products[0].facts)).toBeUndefined();const r=await inspect(c);expect(r.projection.sections.D.suspectProducts[0].treatmentDuration).toEqual({value:"45",unit:"minutes"});expect(r.projection.sections.D.suspectProducts[0].startDate).toBeUndefined();
});
