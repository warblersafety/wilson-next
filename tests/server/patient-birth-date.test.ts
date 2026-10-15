import { expect,it } from "vitest";
import { NextRequest } from "next/server";
import { postCase } from "../../app/api/case/route";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { projectForm3500 } from "../../src/domain/case/projection";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { productCapacityCase } from "../fixtures/product-capacity";
import { contextSource,setContextFact } from "../fixtures/reviewed-context";
import { parseQuotedFixture } from "../fixtures/source-references";
import { removeBirthDateFields } from "../fixtures/pre-dob";
it.each(["2024-02-29","2023-02","2023-02-29"])("grounds only a complete valid supplied DOB %s without deriving age",value=>{
 const text=`Fictional patient DOB-172 date of birth supplied as ${value}.`;
 const result=parseQuotedFixture({turn:"opening",input:{id:"dob-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[],proposals:[{proposalReference:"identifier",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"identifier"},value:{kind:"known",value:"DOB-172"},evidenceQuote:text},{proposalReference:"dob",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"dateOfBirth"},value:{kind:"known",value},evidenceQuote:text}]}},(kind,ref)=>`${kind}-${ref}`);
 if(value==="2024-02-29"){expect(result.proposals).toHaveLength(2);expect(result.proposals.find(p=>p.target.field==="dateOfBirth")!.value).toEqual({kind:"known",value});expect(result.sources[0].excerpt).toBe(text);expect(result.unrepresented).toEqual([]);}else{expect(result.proposals).toHaveLength(1);expect(result.proposals[0].target.field).toBe("identifier");expect(result.unrepresented).toContainEqual(expect.objectContaining({field:"dateOfBirth",reason:"incompatible-value",evidenceQuote:text}));}
 expect(result.proposals.some(p=>p.target.field==="ageYears")).toBe(false);
});
it("does not permit the model to select which A2 value to print",()=>{
 const text="Fictional patient DOB-172. Use date of birth for A2.";const result=parseQuotedFixture({turn:"opening",input:{id:"choice-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[],proposals:[{proposalReference:"identifier",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"identifier"},value:{kind:"known",value:"DOB-172"},evidenceQuote:text},{proposalReference:"choice",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"a2Value"},value:{kind:"known",value:"date-of-birth"},evidenceQuote:text}]}},(kind,ref)=>`${kind}-${ref}`);
 expect(result.proposals).toHaveLength(1);expect(result.proposals[0].target.field).toBe("identifier");expect(result.unrepresented).toHaveLength(1);
});
it("keeps pending DOB and conflicts unpromoted until explicit correction/resolution with history preserved",()=>{
 let c=setContextFact(productCapacityCase(),"patient:patient:dateOfBirth",{kind:"known",value:"2024-02-29"});c=setContextFact(c,"patient:patient:a2Value",{kind:"known",value:"date-of-birth"});const source=contextSource("DOB alternatives");
 const pending=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"dob-alternatives",expectedRevision:c.revision,products:[],sources:[source],proposals:["2023-02-28","2024-02-29"].map((value,i)=>({proposalId:`dob-${i}`,groupId:"dob-group",intent:"alternative" as const,target:{entity:"patient" as const,entityId:"patient",field:"dateOfBirth" as const},value:{kind:"known" as const,value},sourceIds:[source.id]}))}).case;
 expect(projectForm3500(pending).sections.A.dateOfBirth).toBe("2024-02-29");
 const conflict=applyCaseCommand(pending,{type:"review-proposal-groups",commandId:"accept-dob-conflict",expectedRevision:pending.revision,decisions:[{groupId:"dob-group",action:"accept"}]}).case;expect(projectForm3500(conflict).sections.A.dateOfBirth).toBeUndefined();
 const resolved=applyCaseCommand(conflict,{type:"resolve-conflict",commandId:"resolve-dob",expectedRevision:conflict.revision,target:{entity:"patient",entityId:"patient",field:"dateOfBirth"},chosenValueId:"dob-0",source:contextSource("chosen DOB")}).case;
 expect(projectForm3500(resolved).sections.A.dateOfBirth).toBe("2023-02-28");expect(resolved.patient.facts.ageYears).toEqual(c.patient.facts.ageYears);expect(resolved.patient.facts.dateOfBirth.supersededValues.length).toBeGreaterThan(0);
});
it("upgrades genuine v13 by adding only empty fields, preserving week history and rejecting new DOB fields mislabelled as v13",()=>{
 let c=setContextFact(productCapacityCase(),"patient:patient:ageYears",{kind:"known",value:{value:6,unit:"weeks"},qualifier:"supplied estimate"});c=setContextFact(c,"patient:patient:ageYears",{kind:"known",value:57});
 const expected={version:browserStateVersion,stage:"output",case:c,unrepresented:[]};const legacy=structuredClone({...expected,version:"wilson-browser-state-v13"});removeBirthDateFields(legacy.case);const before=structuredClone(legacy);
 expect(parseBrowserJourneyState(legacy)).toEqual(expected);expect(legacy).toEqual(before);
 const mislabeled={...expected,version:"wilson-browser-state-v13"};expect(()=>parseBrowserJourneyState(mislabeled)).toThrow();
 const withDob=setContextFact(c,"patient:patient:dateOfBirth",{kind:"known",value:"2024-02-29"});expect(()=>parseBrowserJourneyState({...expected,case:withDob,version:"wilson-browser-state-v22"})).toThrow();
});
it.each(["2023-02-29","2024-02"])("rejects invalid DOB %s at the direct action boundary without modifying submitted state",async value=>{
 const state={version:browserStateVersion,stage:"output",case:productCapacityCase(),unrepresented:[]},before=structuredClone(state);
 const req=new NextRequest("http://wilson.test/api/case",{method:"POST",headers:{host:"wilson.test",origin:"http://wilson.test","content-type":"application/json"},body:JSON.stringify({operation:"act",state,expectedRevision:state.case.revision,action:{action:"set-fact",target:"patient:patient:dateOfBirth",value:{kind:"known",value}}})});
 const response=await postCase(req,{propose:async()=>{throw new Error("No model calls");}});expect(response.status).toBe(400);expect(state).toEqual(before);
});
