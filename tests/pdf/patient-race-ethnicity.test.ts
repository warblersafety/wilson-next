import {expect,it} from "vitest";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {NextRequest} from "next/server";
import {postCase} from "../../app/api/case/route";
import {applyCaseCommand} from "../../src/domain/case/commands";
import {raceEthnicityOptions,raceEthnicityValues,isRaceEthnicitySelections,type RaceEthnicity} from "../../src/domain/case/race-ethnicity";
import {projectForm3500} from "../../src/domain/case/projection";
import {browserStateVersion,parseBrowserJourneyState} from "../../src/server/case/browser-state";
import {fillForm3500Projection} from "../../src/server/pdf/form-3500";
import {productCapacityCase} from "../fixtures/product-capacity";
import {setContextFact,contextSource} from "../fixtures/reviewed-context";
import {removeRaceEthnicityField} from "../fixtures/pre-dob";
const prefix="topmostSubform[0].Page1[0].SecA_Patient[0].";
const keys=raceEthnicityOptions.map(o=>prefix+o.widget+"[0]");
const checked=(fields:Record<string,string>,key:string)=>Boolean(fields[key]&&fields[key]!=="/Off");
function fixture(values:RaceEthnicity[]){return setContextFact(productCapacityCase(),"patient:patient:raceEthnicity",{kind:"known",value:values});}
async function inspect(c:ReturnType<typeof productCapacityCase>,name?:string){
 const before=structuredClone(c),projection=projectForm3500(c),result=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);expect(result.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const file=join(await mkdtemp(join(tmpdir(),"wilson174-")),"a5.pdf");await writeFile(file,result.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",file,"--named"]);
 if(name&&process.env.WILSON_A5_EVIDENCE){await writeFile(join(process.env.WILSON_A5_EVIDENCE,name+".pdf"),result.output);await writeFile(join(process.env.WILSON_A5_EVIDENCE,name+"-readback.json"),stdout);}
 return {projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
it.each(raceEthnicityOptions)("maps exactly explicit $label to its native checkbox without inferring any other response",async option=>{
 const c=fixture([option.value]),r=await inspect(c),baseline=(await inspect(productCapacityCase())).fields;
 for(const o of raceEthnicityOptions)expect(checked(r.fields,prefix+o.widget+"[0]")).toBe(o.value===option.value);
 const withoutA5=(f:Record<string,string>)=>Object.fromEntries(Object.entries(f).filter(([k])=>!keys.includes(k)));expect(withoutA5(r.fields)).toEqual(withoutA5(baseline));expect(r.projection.sourceTrace["sections.A.raceEthnicity"]).toEqual(c.patient.facts.raceEthnicity.resolvedValue!.sourceIds);
});
it("supports all seven selections and canonical PDF order while preserving the supplied fact order and sources",async()=>{
 const values=[...raceEthnicityValues].reverse(),c=fixture(values),r=await inspect(c,"a5-all");expect(c.patient.facts.raceEthnicity.resolvedValue!.value).toEqual({kind:"known",value:values});expect(r.projection.sections.A.raceEthnicity).toEqual(raceEthnicityValues);for(const key of keys)expect(checked(r.fields,key)).toBe(true);
});
it.each(["unknown","declined","explicitly-absent","inapplicable"] as const)("keeps explicit %s distinct from not supplied and leaves all native boxes blank without resurrecting history",async kind=>{
 const empty=productCapacityCase(),c=setContextFact(fixture(["asian","hispanic-latino"]),"patient:patient:raceEthnicity",{kind}),r=await inspect(c);
 expect(empty.patient.facts.raceEthnicity.state).toBe("empty");expect(c.patient.facts.raceEthnicity.resolvedValue!.value).toEqual({kind});expect(r.projection.sections.A.raceEthnicity).toBeUndefined();expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:"patient:patient:raceEthnicity",reason:kind}));for(const key of keys)expect(checked(r.fields,key)).toBe(false);expect(c.patient.facts.raceEthnicity.supersededValues.length).toBeGreaterThan(0);
});
const invalidValues:unknown[]=[[],["asian","asian"],["canadian"],["mixed"],["asian","unsupported"],"asian",[null]];
it.each(invalidValues.map(value=>({value})))("rejects malformed/empty/duplicate/unsupported A5 value $value without mapping identities or proxies",async ({value})=>{
 const c=productCapacityCase(),before=structuredClone(c);expect(isRaceEthnicitySelections(value)).toBe(false);expect(()=>setContextFact(c,"patient:patient:raceEthnicity",{kind:"known",value})).toThrow("nonempty unique");
 const malformed=structuredClone(fixture(["asian"]));malformed.patient.facts.raceEthnicity.resolvedValue!.value={kind:"known",value:value as RaceEthnicity[]};expect(()=>parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:malformed,unrepresented:[]})).toThrow();
 const projection=projectForm3500(c);projection.sections.A.raceEthnicity=value as RaceEthnicity[];await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection)).rejects.toThrow("A5");expect(c).toEqual(before);
});
it("retains supplied partial unknown/negative context and qualifier history without adding any guessed category",async()=>{
 let c=setContextFact(fixture(["hispanic-latino"]),"patient:patient:raceEthnicity",{kind:"known",value:["hispanic-latino"],qualifier:"race not known; patient supplied no other category"});const r=await inspect(c,"a5-partial");expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:"patient:patient:raceEthnicity",reason:"qualifier-not-included",qualifier:"race not known; patient supplied no other category",baseValueIncluded:true}));for(const o of raceEthnicityOptions)expect(checked(r.fields,prefix+o.widget+"[0]")).toBe(o.value==="hispanic-latino");
 c=setContextFact(c,"patient:patient:raceEthnicity",{kind:"known",value:["white","middle-eastern-north-african"]});const restored=parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}).case;expect(restored).toEqual(c);expect(restored.patient.facts.raceEthnicity.supersededValues.some(v=>v.value.kind==="known"&&v.value.qualifier?.includes("race not known"))).toBe(true);
});
it("keeps pending A5 alternatives unpromoted and accepted conflicts unprinted until explicit resolution",async()=>{
 const c=fixture(["asian"]),source=contextSource("a5-alternatives");const pending=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"a5-alts",expectedRevision:c.revision,products:[],sources:[source],proposals:[["white"],["hispanic-latino"]].map((value,i)=>({proposalId:`a5-${i}`,groupId:"a5-group",intent:"alternative" as const,target:{entity:"patient" as const,entityId:"patient",field:"raceEthnicity" as const},value:{kind:"known" as const,value},sourceIds:[source.id]}))}).case;expect(projectForm3500(pending).sections.A.raceEthnicity).toEqual(["asian"]);
 const conflict=applyCaseCommand(pending,{type:"review-proposal-groups",commandId:"accept-a5",expectedRevision:pending.revision,decisions:[{groupId:"a5-group",action:"accept"}]}).case;const r=await inspect(conflict);for(const key of keys)expect(checked(r.fields,key)).toBe(false);
 const resolved=applyCaseCommand(conflict,{type:"resolve-conflict",commandId:"resolve-a5",expectedRevision:conflict.revision,target:{entity:"patient",entityId:"patient",field:"raceEthnicity"},chosenValueId:"a5-1",source:contextSource("choose-explicit-category")}).case;expect((await inspect(resolved)).projection.sections.A.raceEthnicity).toEqual(["hispanic-latino"]);
});
it("upgrades a genuine v14 DOB/age/choice case by adding only an empty A5 fact and rejects A5 mislabelled as v14",()=>{
 let c=setContextFact(productCapacityCase(),"patient:patient:dateOfBirth",{kind:"known",value:"2024-02-29"});c=setContextFact(c,"patient:patient:a2Value",{kind:"known",value:"date-of-birth"});const expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]};const legacy=structuredClone({...expected,version:"wilson-browser-state-v14"});removeRaceEthnicityField(legacy.case);const before=structuredClone(legacy);expect(parseBrowserJourneyState(legacy)).toEqual(expected);expect(legacy).toEqual(before);
 expect(()=>parseBrowserJourneyState({...expected,case:fixture(["asian"]),version:"wilson-browser-state-v14"})).toThrow();expect(()=>parseBrowserJourneyState({...expected,version:"wilson-browser-state-v20"})).toThrow();
});
it("rejects invalid direct A5 acceptance without changing submitted state or calling a model",async()=>{
 const state={version:browserStateVersion,stage:"output",case:productCapacityCase(),unrepresented:[]},before=structuredClone(state);const req=new NextRequest("http://wilson.test/api/case",{method:"POST",headers:{host:"wilson.test",origin:"http://wilson.test","content-type":"application/json"},body:JSON.stringify({operation:"act",state,expectedRevision:state.case.revision,action:{action:"set-fact",target:"patient:patient:raceEthnicity",value:{kind:"known",value:[]}}})});const r=await postCase(req,{propose:async()=>{throw new Error("No model calls");}});expect(r.status).toBe(400);expect(state).toEqual(before);
});
