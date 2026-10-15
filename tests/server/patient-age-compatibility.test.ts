import { removeBirthDateFields } from "../fixtures/pre-dob";
import { expect, it } from "vitest";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { productCapacityCase } from "../fixtures/product-capacity";
import { setContextFact } from "../fixtures/reviewed-context";
import { parseQuotedFixture } from "../fixtures/source-references";
it("upgrades v11 numeric age facts and all histories/targets byte-equivalently at the data level without rewriting the input", () => {
  const state = { version: browserStateVersion, stage: "output", case: setContextFact(productCapacityCase(), "patient:patient:ageYears", { kind: "known", value: 58, qualifier: "approximately" }), unrepresented: [] };
  const legacy = { ...structuredClone(state), version: "wilson-browser-state-v11" }; removeBirthDateFields(legacy.case); const before = structuredClone(legacy);
  expect(parseBrowserJourneyState(legacy)).toEqual(state); expect(legacy).toEqual(before);
});
it("does not admit new unit objects mislabelled as v11 or future/malformed accepted values", () => {
  const current = { version: browserStateVersion, stage: "output", case: setContextFact(productCapacityCase(), "patient:patient:ageYears", { kind: "known", value: { value:24,unit:"months" } }), unrepresented: [] };
  expect(parseBrowserJourneyState(current).case).toEqual(current.case);
  for (const version of ["wilson-browser-state-v11","wilson-browser-state-v15"]) { const candidate={...structuredClone(current),version}, before=structuredClone(candidate); expect(()=>parseBrowserJourneyState(candidate)).toThrow(); expect(candidate).toEqual(before); }
  const malformed=structuredClone(current); malformed.case.patient.facts.ageYears.resolvedValue!.value={kind:"known",value:{value:1.5,unit:"days"}}; expect(()=>parseBrowserJourneyState(malformed)).toThrow();
});
it.each([{value:24,unit:"months"},{value:5,unit:"days"},{value:6,unit:"weeks"}])("accepts exact grounded $value $unit without conversion or date calculation", value => {
  const text=`Fictional patient age at onset: ${value.value} ${value.unit}.`;
  const result=parseQuotedFixture({turn:"opening",input:{id:"age-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[],proposals:[{proposalReference:"age",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"ageYears"},value:{kind:"known",value},evidenceQuote:text}]}},(kind,ref)=>`${kind}-${ref}`);
  expect(result.proposals[0].value).toEqual({kind:"known",value}); expect(result.unrepresented).toEqual([]); expect(result.sources[0].excerpt).toBe(text);
});

it("records a chosen mixed-unit age with readable value/unit evidence through the journey boundary", async () => {
  const { applyCaseCommand } = await import("../../src/domain/case/commands");
  const { InMemoryCaseRepository } = await import("../../src/server/case/repository");
  const { performJourneyAction } = await import("../../src/server/journey/service");
  const { contextSource } = await import("../fixtures/reviewed-context");
  let c=setContextFact(productCapacityCase(),"patient:patient:ageYears",{kind:"known",value:{value:24,unit:"months"}});
  const source=contextSource("journey-age-alternatives");
  c=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"journey-age-alt",expectedRevision:c.revision,products:[],sources:[source],proposals:[{value:5,unit:"days"},{value:24,unit:"months"}].map((value,i)=>({proposalId:`journey-age-${i}`,groupId:"journey-age-group",intent:"alternative" as const,target:{entity:"patient" as const,entityId:"patient" as const,field:"ageYears" as const},value:{kind:"known" as const,value},sourceIds:[source.id]}))}).case;
  c=applyCaseCommand(c,{type:"review-proposal-groups",commandId:"journey-age-conflict",expectedRevision:c.revision,decisions:[{groupId:"journey-age-group",action:"accept"}]}).case;
  const repo=new InMemoryCaseRepository({initialCase:c});
  const snapshot=await performJourneyAction(repo,c.id,{action:"resolve-conflict",target:"patient:patient:ageYears",chosenValueId:"journey-age-0"},{propose:async()=>{throw new Error("No model calls");}});
  expect(snapshot.projection.sections.A.ageYears).toEqual({value:5,unit:"days"});
  const restored=await repo.load(c.id);expect(restored?.sources.some(s=>s.excerpt==="Use 5 days as the patient age.")).toBe(true);
});

it("upgrades v12 atomic age facts, history, sources and revisions unchanged and rejects weeks mislabelled as v12", () => {
  let c = setContextFact(productCapacityCase(), "patient:patient:ageYears", {kind:"known",value:{value:5,unit:"days"},qualifier:"caregiver estimate"});
  c = setContextFact(c, "patient:patient:ageYears", {kind:"known",value:{value:24,unit:"months"}});
  const legacy={version:"wilson-browser-state-v12",stage:"output",case:structuredClone(c),unrepresented:[]};removeBirthDateFields(legacy.case);const before=structuredClone(legacy);
  expect(parseBrowserJourneyState(legacy)).toEqual({...legacy,case:c,version:browserStateVersion}); expect(legacy).toEqual(before);
  const weeks=setContextFact(c,"patient:patient:ageYears",{kind:"known",value:{value:6,unit:"weeks"}});
  const candidate={...legacy,case:weeks}, unchanged=structuredClone(candidate);
  expect(()=>parseBrowserJourneyState(candidate)).toThrow(); expect(candidate).toEqual(unchanged);
  // Legacy validation applies to superseded/proposed/conflicting values too.
  const hidden=structuredClone(before); hidden.case.patient.facts.ageYears.supersededValues[0].value={kind:"known",value:{value:6,unit:"weeks"}};
  expect(()=>parseBrowserJourneyState(hidden)).toThrow();
});
