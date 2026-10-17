import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {productCapacityCase} from "../fixtures/product-capacity";
import {setContextFact} from "../fixtures/reviewed-context";
import {browserStateVersion,parseBrowserJourneyState} from "../../src/server/case/browser-state";
import {isTreatmentDuration,durationText} from "../../src/domain/case/duration";
import {journeyActionSchema} from "../../src/server/journey/action-contract";
it.each(["1 dose","2-3 weeks","2 weeks and 3 days","about two weeks\npossibly interrupted"])("retains exact supplied %s with no inferred pair",wording=>{
 const c=productCapacityCase(),id=c.products[0].id,changed=setContextFact(c,`product:${id}:treatmentDuration`,{kind:"known",value:{wording},qualifier:"reporter unsure"});
 expect(isTreatmentDuration({wording})).toBe(true);expect(durationText({wording})).toBe(wording);expect(changed.products[0].facts.startDate).toEqual(c.products[0].facts.startDate);
 const state={version:browserStateVersion,stage:"output",case:changed,unrepresented:[]};expect(parseBrowserJourneyState(JSON.parse(JSON.stringify(state)))).toEqual(state);
 expect(journeyActionSchema.safeParse({action:"set-fact",target:`product:${id}:treatmentDuration`,value:{kind:"known",value:{wording}}}).success).toBe(true);
 expect(()=>parseBrowserJourneyState({...state,version:"wilson-browser-state-v31"})).toThrow();
});
it.each([{wording:""},{wording:"   "},{wording:2},{wording:"1 dose",unit:"days"},{wording:"1 dose",extra:true}])("rejects malformed accepted wording %j",v=>expect(isTreatmentDuration(v)).toBe(false));
it("upgrades genuine v31 without mutating identity, history or sources and rejects malformed legacy pairs",()=>{
 let c=productCapacityCase();c=setContextFact(c,`product:${c.products[0].id}:treatmentDuration`,{kind:"known",value:{value:"1.50",unit:"hours"}});const old={version:"wilson-browser-state-v31",stage:"output",case:c,unrepresented:[]},before=structuredClone(old);expect(parseBrowserJourneyState(old)).toEqual({...old,version:browserStateVersion});expect(old).toEqual(before);
 const bad=structuredClone(old);(bad.case.products[0].facts.treatmentDuration.resolvedValue!.value as {value:unknown}).value={value:"2",unit:"doses"};expect(()=>parseBrowserJourneyState(bad)).toThrow();
});
it.each([true,false])("grounds exact wording in the cited source, exact=%s",exact=>{
 const text="Fictional product X duration was 2 weeks and 3 days; reporter unsure.",wording=exact?"2 weeks and 3 days":"17 days";
 const r=parseQuotedFixture({turn:"opening",input:{id:"wording-input",type:"narrative",text,recordedAt:"2026-10-17T00:00:00Z"},output:{products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"name",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"name"},value:{kind:"known",value:"X"},evidenceQuote:text},{proposalReference:"duration",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"treatmentDuration"},value:{kind:"known",value:{wording},qualifier:"reporter unsure"},evidenceQuote:text}]}},(k,ref)=>`${k}-${ref}`);
 expect(r.proposals.filter(p=>p.target.field==="treatmentDuration")).toHaveLength(exact?1:0);if(!exact)expect(r.unrepresented).toContainEqual(expect.objectContaining({reason:"evidence-not-found",field:"treatmentDuration"}));expect(r.proposals.some(p=>p.target.field==="startDate"||p.target.field==="d3Value")).toBe(false);
});
