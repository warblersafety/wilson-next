import type { PatientFactKey } from "../../src/domain/case/types";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { describe, expect, it } from "vitest";
import oldState from "../fixtures/patient-involvement-v21.json" with { type: "json" };
import { parseBrowserJourneyState, browserStateVersion } from "../../src/server/case/browser-state";
import { completeResolvedCase } from "../domain/fixture";
import { setContextFact } from "../fixtures/reviewed-context";
import { noPatientConflictingTargets } from "../../src/domain/case/patient-involvement";
import { projectForm3500 } from "../../src/domain/case/projection";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { createAnthropicJourneyModel, createAnthropicRequest } from "../../src/server/model/anthropic-journey";
import { noPatientOpening, patientInvolvementScenario } from "../fixtures/patient-involvement";
const target = "patient:patient:involvement";
const migrated = () => parseBrowserJourneyState(structuredClone(oldState));
describe("explicit patient participation", () => {
 it("strictly migrates genuine v21 with empty participation and no inferred no-patient from source or missing demographics", () => {
  const input=structuredClone(oldState),before=structuredClone(input);const parsed=parseBrowserJourneyState(input);
  expect(parsed.version).toBe(browserStateVersion);const {involvement,...facts}=parsed.case.patient.facts;
  expect(involvement).toEqual({state:"empty",proposedValues:[],conflictingValues:[],sourceIds:[],supersededValues:[]});
  const {additionalComments,...eventFacts}=parsed.case.event.facts;expect(additionalComments.state).toBe("empty");expect({...parsed.case,patient:{...parsed.case.patient,facts},event:{...parsed.case.event,facts:eventFacts}}).toEqual(oldState.case);expect(input).toEqual(before);
  expect(projectForm3500(parsed.case).sections.A.patientIdentifier).toBeUndefined();
  expect(()=>parseBrowserJourneyState({...parsed,version:"wilson-browser-state-v21"})).toThrow();
  const missing=structuredClone(parsed) as any;delete missing.case.patient.facts.involvement;expect(()=>parseBrowserJourneyState(missing)).toThrow();
 });
 it.each(["unknown","declined","explicitly-absent","inapplicable"] as const)("does not conflate %s with no-patient", kind => {
  const c=setContextFact(migrated().case,target,{kind});expect(projectForm3500(c).sections.A.patientIdentifier).toBeUndefined();expect(parseBrowserJourneyState({...migrated(),case:c}).case).toEqual(c);
 });
 it("prints none only for explicit accepted none and attributes A1 to that source, without changing identifier", () => {
  const original=migrated().case,c=setContextFact(original,target,{kind:"known",value:"none"});const p=projectForm3500(c);
  expect(p.sections.A.patientIdentifier).toBe("none");expect(p.sourceTrace["sections.A.patientIdentifier"]).toEqual(c.patient.facts.involvement.resolvedValue!.sourceIds);expect(c.patient.facts.identifier).toEqual(original.patient.facts.identifier);
  const present=setContextFact(c,target,{kind:"known",value:"present"});expect(projectForm3500(present).sections.A.patientIdentifier).toBeUndefined();expect(present.patient.facts.involvement.supersededValues.some(v=>v.value.kind==="known"&&v.value.value==="none")).toBe(true);
 });
 it("never discards contradictory demographics and blocks output until an explicit correction", async () => {
  const old=completeResolvedCase(),c=setContextFact(old,target,{kind:"known",value:"none"});const before=structuredClone(c.patient.facts);
  expect(noPatientConflictingTargets(c)).toContain("patient:patient:identifier");expect(projectForm3500(c).sections.A.patientIdentifier).not.toBe("none");
  const snapshot=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c,maxCases:1}),c.id);expect(snapshot.downloadReady).toBe(false);expect(snapshot.outputIssues.some(i=>i.code==="no-patient-demographics-conflict")).toBe(true);expect(c.patient.facts).toEqual(before);
  const fixed=setContextFact(c,target,{kind:"known",value:"present"});expect(noPatientConflictingTargets(fixed)).toEqual([]);expect(fixed.patient.facts.identifier).toEqual(old.patient.facts.identifier);
 });
 it.each([
  ["identifier", "SYN-196"], ["ageYears", 42], ["dateOfBirth", "1984-09-03"],
  ["raceEthnicity", ["asian"]], ["sex", "female"], ["weight", {value:64,unit:"kg"}],
 ])("retains known %s and flags its explicit contradiction with none", (field,value) => {
  const c=setContextFact(setContextFact(migrated().case,`patient:patient:${field}`,{kind:"known",value}),target,{kind:"known",value:"none"});
  expect(noPatientConflictingTargets(c)).toEqual([`patient:patient:${field}`]);expect(projectForm3500(c).sections.A.patientIdentifier).not.toBe("none");expect(c.patient.facts[field as keyof typeof c.patient.facts].resolvedValue?.value).toEqual({kind:"known",value});
 });
 it.each([
  ["identifier", "SYN-A", "SYN-B"], ["ageYears", 42, 43], ["dateOfBirth", "1984-09-03", "1984-09-04"],
  ["raceEthnicity", ["asian"], ["white"]], ["sex", "female", "male"], ["weight", {value:64,unit:"kg"}, {value:65,unit:"kg"}],
 ])("known disputed %s cannot unblock a no-patient claim", async (field,first,second) => {
  const c=setContextFact(migrated().case,target,{kind:"known",value:"none"});const text="Fictional records disagree on the patient detail.",source={id:"disputed-source",inputId:"disputed-input",inputType:"correction" as const,actor:"clinician" as const,excerpt:text,start:0,end:text.length,recordedAt:"2026-10-16T04:00:00.000Z"};
  const pending=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"disputed-demographic",expectedRevision:c.revision,products:[],sources:[source],proposals:[first,second].map((value,i)=>({proposalId:`disputed-${i}`,groupId:"disputed-demographic",intent:"alternative" as const,target:{entity:"patient" as const,entityId:"patient" as const,field:field as PatientFactKey},value:{kind:"known" as const,value},sourceIds:[source.id]}))}).case;
  const accepted=applyCaseCommand(pending,{type:"review-proposal-groups",commandId:"accept-disputed-demographic",expectedRevision:pending.revision,decisions:[{groupId:"disputed-demographic",action:"accept"}]}).case;
  expect(accepted.patient.facts[field as keyof typeof accepted.patient.facts].state).toBe("conflicted");expect(noPatientConflictingTargets(accepted)).toEqual([`patient:patient:${field}`]);expect(projectForm3500(accepted).sections.A.patientIdentifier).not.toBe("none");const snapshot=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:accepted,maxCases:1}),accepted.id);expect(snapshot.downloadReady).toBe(false);expect(snapshot.outputIssues.some(i=>i.code==="no-patient-demographics-conflict")).toBe(true);expect(parseBrowserJourneyState({...migrated(),case:accepted}).case).toEqual(accepted);
 });
 it.each(["adverse-event","adverse-event-and-product-problem"] as const)("flags no-patient versus explicit %s without choosing a report type", async reportType => {
  const c=setContextFact(setContextFact(migrated().case,target,{kind:"known",value:"none"}),"event:event:reportType",{kind:"known",value:reportType});
  const snapshot=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c,maxCases:1}),c.id);expect(snapshot.downloadReady).toBe(false);expect(snapshot.outputIssues.some(i=>i.code==="no-patient-report-type-conflict")).toBe(true);expect(c.event.facts.reportType.resolvedValue?.value).toEqual({kind:"known",value:reportType});
 });
 it("does not turn legacy literal none into participation or downloadable output", async () => {
  const c=setContextFact(migrated().case,"patient:patient:identifier",{kind:"known",value:"none"});
  expect(c.patient.facts.involvement.state).toBe("empty");const snapshot=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c,maxCases:1}),c.id);
  expect(snapshot.downloadReady).toBe(false);expect(snapshot.outputIssues.some(i=>i.code==="reserved-no-patient-identifier")).toBe(true);
  expect(c.patient.facts.identifier.resolvedValue?.value).toEqual({kind:"known",value:"none"});
 });
 it("keeps rejected, pending and conflicting alternatives from establishing no-patient output", () => {
  const c=migrated().case,source={id:"involvement-source",inputId:"involvement-input",inputType:"correction" as const,actor:"clinician" as const,excerpt:"Fictional records disagree on patient involvement.",start:0,end:49,recordedAt:"2026-10-16T04:00:00.000Z"};source.end=source.excerpt.length;
  const pending=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"pending-participation",expectedRevision:c.revision,products:[],sources:[source],proposals:(["none","present"]as const).map((value,i)=>({proposalId:`participation-${i}`,groupId:"participation-alternatives",intent:"alternative" as const,target:{entity:"patient" as const,entityId:"patient" as const,field:"involvement" as const},value:{kind:"known" as const,value},sourceIds:[source.id]}))}).case;
  expect(projectForm3500(pending).sections.A.patientIdentifier).toBeUndefined();
  for(const action of ["reject","accept"]as const){const reviewed=applyCaseCommand(pending,{type:"review-proposal-groups",commandId:`${action}-alternatives`,expectedRevision:pending.revision,decisions:[{groupId:"participation-alternatives",action}]}).case;expect(projectForm3500(reviewed).sections.A.patientIdentifier).toBeUndefined();expect(reviewed.patient.facts.involvement.state).toBe(action==="accept"?"conflicted":"empty");}
 });
 it("exposes the explicit enum and non-inference contract; mocked provider proposals remain pending", async () => {
  const request=createAnthropicRequest("opening",noPatientOpening);expect(request.system).toContain('known "none"');expect(request.system).toContain("Never infer this status from missing demographics");expect(JSON.stringify(request.output_config)).toContain("involvement");
  const model=createAnthropicJourneyModel(async()=>({id:"mock",model:"mock",stop_reason:"end_turn",content:[{type:"text",text:JSON.stringify(patientInvolvementScenario[0].output)}],usage:{input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0}}));const result=await model.propose("opening",noPatientOpening);expect(result.envelope.proposals.find(p=>p.target.entity==="patient"&&p.target.field==="involvement")?.value).toEqual({kind:"known",value:"none"});
 });
});
