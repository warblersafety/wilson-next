import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {productCapacityCase} from "../fixtures/product-capacity";
it.each([{value:["asian","hispanic-latino"],valid:true},{value:["canadian"],valid:false},{value:[],valid:false}])("preserves only supported explicitly supplied A5 lists $value without substituting a category",({value,valid})=>{
 const text=valid?"Fictional patient A5-1 reports Asian and Hispanic or Latino.":"Fictional patient A5-1 supplied a response outside the native categories.";
 const result=parseQuotedFixture({turn:"opening",input:{id:"a5-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[],proposals:[{proposalReference:"identifier",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"identifier"},value:{kind:"known",value:"A5-1"},evidenceQuote:text},{proposalReference:"a5",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"raceEthnicity"},value:{kind:"known",value},evidenceQuote:text}]}},(kind,ref)=>`${kind}-${ref}`);
 const a5=result.proposals.filter(p=>p.target.field==="raceEthnicity");if(valid){expect(a5[0].value).toEqual({kind:"known",value});expect(result.unrepresented).toEqual([]);}else{expect(a5).toEqual([]);expect(result.unrepresented).toContainEqual(expect.objectContaining({field:"raceEthnicity",reason:"incompatible-value",evidenceQuote:text}));}expect(result.proposals.find(p=>p.target.field==="identifier")).toBeDefined();
});
it("preserves positive ethnicity and explicitly unknown race context instead of clearing it or inferring race",()=>{
 const text="Fictional patient A5-2 reports Hispanic or Latino; race not known.";
 const result=parseQuotedFixture({turn:"opening",input:{id:"a5-partial",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[],proposals:[{proposalReference:"a5",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"raceEthnicity"},value:{kind:"known",value:["hispanic-latino"],qualifier:"race not known"},evidenceQuote:text}]}},(kind,ref)=>`${kind}-${ref}`);
 expect(result.proposals[0].value).toEqual({kind:"known",value:["hispanic-latino"],qualifier:"race not known"});expect(result.sources[0].excerpt).toBe(text);expect(result.unrepresented).toEqual([]);
});
it("records human category names in direct-edit source without exposing enum codes",async()=>{
 const c=productCapacityCase(),repo=new InMemoryCaseRepository({initialCase:c});const s=await performJourneyAction(repo,c.id,{action:"set-fact",target:"patient:patient:raceEthnicity",value:{kind:"known",value:["asian","middle-eastern-north-african"]}},{propose:async()=>{throw new Error("No model calls");}});
 expect(s.projection.sections.A.raceEthnicity).toEqual(["asian","middle-eastern-north-african"]);const restored=await repo.load(c.id);expect(restored!.sources.some(source=>source.excerpt.includes("Asian and Middle Eastern or North African")&&source.excerpt.includes("race and/or ethnicity"))).toBe(true);
});
