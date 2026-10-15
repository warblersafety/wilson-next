import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {productCapacityCase} from "../fixtures/product-capacity";
it.each([true,false,"yes",1])("preserves only explicit boolean ongoing proposals without coercion: %j",value=>{
 const text="Fictional product X current therapy status was explicitly supplied.";
 const r=parseQuotedFixture({turn:"opening",input:{id:"ongoing-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"name",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"name"},value:{kind:"known",value:"X"},evidenceQuote:text},{proposalReference:"ongoing",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"therapyOngoing"},value:{kind:"known",value},evidenceQuote:text}]}},(k,ref)=>`${k}-${ref}`);
 const proposed=r.proposals.filter(p=>p.target.field==="therapyOngoing");if(typeof value==="boolean"){expect(proposed[0].value).toEqual({kind:"known",value});expect(r.unrepresented).toEqual([]);}else{expect(proposed).toEqual([]);expect(r.unrepresented).toContainEqual(expect.objectContaining({field:"therapyOngoing",reason:"incompatible-value"}));}expect(r.proposals.some(p=>p.target.field==="name")).toBe(true);
});
it("direct correction preserves unrelated dates/history without calling a model",async()=>{
 const c=productCapacityCase(),repo=new InMemoryCaseRepository({initialCase:c});const id=c.products[0].id;
 const s=await performJourneyAction(repo,c.id,{action:"set-fact",target:`product:${id}:therapyOngoing`,value:{kind:"known",value:true,qualifier:"explicit current report"}},{propose:async()=>{throw new Error("No model calls");}});
 expect(s.projection.sections.D.suspectProducts[0].therapyOngoing).toBe(true);
 const after=(await repo.load(c.id))!;expect(after.products[0].facts.stopDate).toEqual(c.products[0].facts.stopDate);expect(after.products[0].facts.restarted).toEqual(c.products[0].facts.restarted);expect(after.products[0].facts.therapyOngoing.resolvedValue!.sourceIds.length).toBeGreaterThan(0);
});
