import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {productCapacityCase} from "../fixtures/product-capacity";
it.each(["2028-02-29","2026-09","2026-02-29",20260918])("preserves only complete valid explicitly supplied reduction date %j without coercion or inference",value=>{
 const text="Fictional product X has a clinician-supplied dose-reduction date.";
 const r=parseQuotedFixture({turn:"opening",input:{id:"reduction-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"name",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"name"},value:{kind:"known",value:"X"},evidenceQuote:text},{proposalReference:"date",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"doseReductionDate"},value:{kind:"known",value},evidenceQuote:text}]}},(k,ref)=>`${k}-${ref}`);
 const dates=r.proposals.filter(p=>p.target.field==="doseReductionDate");if(value==="2028-02-29"){expect(dates[0].value).toEqual({kind:"known",value});expect(r.unrepresented).toEqual([]);}else{expect(dates).toEqual([]);expect(r.unrepresented).toContainEqual(expect.objectContaining({field:"doseReductionDate",reason:"incompatible-value",evidenceQuote:text}));}expect(r.proposals.some(p=>p.target.field==="name")).toBe(true);expect(r.proposals.some(p=>p.target.field==="doseReduced")).toBe(false);
});
it("direct accepted date preserves the reduction answer, dates and source history without model calls",async()=>{
 const c=productCapacityCase(),repo=new InMemoryCaseRepository({initialCase:c}),id=c.products[0].id;
 const s=await performJourneyAction(repo,c.id,{action:"set-fact",target:`product:${id}:doseReductionDate`,value:{kind:"known",value:"2028-02-29",qualifier:"supplied best estimate"}},{propose:async()=>{throw new Error("No model calls");}});
 expect(s.projection.sections.D.suspectProducts[0].doseReductionDate).toBe("2028-02-29");const after=(await repo.load(c.id))!;for(const field of["doseReduced","stopDate","startDate","therapyOngoing"]as const)expect(after.products[0].facts[field]).toEqual(c.products[0].facts[field]);expect(after.products[0].facts.doseReductionDate.resolvedValue!.sourceIds.length).toBeGreaterThan(0);
});
