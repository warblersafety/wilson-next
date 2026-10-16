import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as postPdf } from "../../app/api/case/pdf/route";
import { noPatientOutcomeConflictingTargets } from "../../src/domain/case/patient-involvement";
import { projectForm3500 } from "../../src/domain/case/projection";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { explicitNoPatientCase, disputedOutcome, seriousOutcomeFields } from "../fixtures/no-patient-outcomes";
import { setContextFact } from "../fixtures/reviewed-context";
const inspect=(c:ReturnType<typeof explicitNoPatientCase>)=>getJourneySnapshot(new InMemoryCaseRepository({initialCase:c,maxCases:1}),c.id);
it.each(seriousOutcomeFields)("blocks explicit no-patient versus known-true %s without deleting or reclassifying facts", async field => {
 const c=setContextFact(explicitNoPatientCase(),`event:event:${field}`,{kind:"known",value:true}),before=structuredClone(c);const s=await inspect(c);
 expect(noPatientOutcomeConflictingTargets(c)).toEqual([`event:event:${field}`]);expect(s.downloadReady).toBe(false);expect(s.projection.sections.A.patientIdentifier).toBeUndefined();expect(s.projection.sections.B[field]).toBe(true);expect(s.outputIssues).toContainEqual(expect.objectContaining({code:"no-patient-outcomes-conflict",targets:["patient:patient:involvement",`event:event:${field}`]}));expect(c).toEqual(before);expect(parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}).case).toEqual(c);
});
it.each(seriousOutcomeFields)("known-positive disputed %s cannot bypass the guard; unaccepted alternatives do not become outcomes",async field=>{
 const {pending,accepted}=disputedOutcome(field);expect(noPatientOutcomeConflictingTargets(pending)).toEqual([]);expect((await inspect(pending)).downloadReady).toBe(false);expect(accepted.event.facts[field].state).toBe("conflicted");expect(noPatientOutcomeConflictingTargets(accepted)).toEqual([`event:event:${field}`]);expect((await inspect(accepted)).downloadReady).toBe(false);expect(projectForm3500(accepted).sections.A.patientIdentifier).toBeUndefined();expect(accepted.event.facts[field].conflictingValues.map(v=>v.value)).toEqual([{kind:"known",value:true},{kind:"known",value:false}]);
});
it.each([{kind:"known",value:false},{kind:"unknown"},{kind:"declined"},{kind:"explicitly-absent"},{kind:"inapplicable"}] as const)("current $kind/$value outcome does not resurrect a historical positive or infer participation",async value=>{
 const original=explicitNoPatientCase(),positive=setContextFact(original,"event:event:hospitalized",{kind:"known",value:true}),c=setContextFact(positive,"event:event:hospitalized",value);expect(noPatientOutcomeConflictingTargets(c)).toEqual([]);expect((await inspect(c)).downloadReady).toBe(true);expect(projectForm3500(c).sections.A.patientIdentifier).toBe("none");expect(c.patient).toEqual(original.patient);expect(c.event.facts.hospitalized.supersededValues.some(v=>v.value.kind==="known"&&v.value.value===true)).toBe(true);
});
it("unmentioned and solely nonpositive disputed outcomes never establish a patient",async()=>{
 const c=explicitNoPatientCase();expect(noPatientOutcomeConflictingTargets(c)).toEqual([]);expect((await inspect(c)).downloadReady).toBe(true);
 const {accepted}=disputedOutcome("hospitalized",[{kind:"known",value:false},{kind:"unknown"}]);expect(accepted.event.facts.hospitalized.state).toBe("conflicted");expect(noPatientOutcomeConflictingTargets(accepted)).toEqual([]);expect(projectForm3500(accepted).sections.A.patientIdentifier).toBe("none");expect((await inspect(accepted)).downloadReady).toBe(true);
});
it.each([{kind:"known",value:"present"},{kind:"unknown"},{kind:"declined"},{kind:"explicitly-absent"},{kind:"inapplicable"}]as const)("only explicit current none triggers the consistency rule, not $kind/$value or history",async value=>{
 const c=setContextFact(setContextFact(explicitNoPatientCase(),"event:event:hospitalized",{kind:"known",value:true}),"patient:patient:involvement",value);expect(noPatientOutcomeConflictingTargets(c)).toEqual([]);expect((await inspect(c)).downloadReady).toBe(true);expect(projectForm3500(c).sections.A.patientIdentifier).toBeUndefined();expect(c.patient.facts.identifier.state).toBe("empty");expect(c.event.facts.hospitalized.resolvedValue?.value).toEqual({kind:"known",value:true});
});
it("reports every explicit positive B2 target once and blocks the actual PDF route",async()=>{
 let c=explicitNoPatientCase();for(const field of seriousOutcomeFields)c=setContextFact(c,`event:event:${field}`,{kind:"known",value:true});const before=structuredClone(c);expect(noPatientOutcomeConflictingTargets(c)).toEqual(seriousOutcomeFields.map(f=>`event:event:${f}`));const response=await postPdf(new NextRequest("http://localhost/api/case/pdf",{method:"POST",headers:{host:"localhost","content-type":"application/json",origin:"http://localhost"},body:JSON.stringify({mode:"download",state:{version:browserStateVersion,stage:"output",case:c,unrepresented:[]}})}));expect(response.status).toBe(409);expect((await response.json()).code).toBe("pdf-not-ready");expect(c).toEqual(before);
});
