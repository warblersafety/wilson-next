import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {modelProposalOutputSchema} from "../../src/domain/case/model-boundary";
import {referenceFixture} from "../fixtures/source-references";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {productCapacityCase} from "../fixtures/product-capacity";
it.each([{value:"1.50",unit:"hours"},{value:"2",unit:""},{value:"1",unit:"doses"},{value:2,unit:"days"}])("keeps only complete supported supplied duration pairs $value $unit without conversion",value=>{
 const text="Fictional product X has an explicitly supplied treatment duration.";
 const r=parseQuotedFixture({turn:"opening",input:{id:"duration-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"name",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"name"},value:{kind:"known",value:"X"},evidenceQuote:text},{proposalReference:"duration",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"treatmentDuration"},value:{kind:"known",value},evidenceQuote:text}]}},(k,ref)=>`${k}-${ref}`);
 const p=r.proposals.filter(p=>p.target.field==="treatmentDuration");if(value.unit==="hours"){expect(p[0].value).toEqual({kind:"known",value});expect(r.unrepresented).toEqual([]);}else{expect(p).toEqual([]);expect(r.unrepresented).toContainEqual(expect.objectContaining({field:"treatmentDuration",reason:"incompatible-value",evidenceQuote:text}));}expect(r.proposals.some(p=>p.target.field==="startDate"||p.target.field==="stopDate")).toBe(false);
});
it("does not allow the application model to choose the clinician-only D3 print alternative",()=>{
 const text="Fictional supplied dates and duration.";const raw={products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"choose",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"d3Value"},value:{kind:"known",value:"duration"},evidenceQuote:text}]};
 expect(modelProposalOutputSchema.safeParse(referenceFixture(text,raw)).success).toBe(false);
});
it("preserves the coherent direct duration and all date/source history without model calls",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,repo=new InMemoryCaseRepository({initialCase:c}),noModel={propose:async()=>{throw new Error("No model calls");}};
 let s=await performJourneyAction(repo,c.id,{action:"set-fact",target:`product:${id}:treatmentDuration`,value:{kind:"known",value:{value:"1.50",unit:"hours"},qualifier:"explicit estimated duration"}},noModel);expect(s.outputIssues.some(i=>i.code==="product-d3-choice-required")).toBe(true);
 s=await performJourneyAction(repo,c.id,{action:"set-fact",target:`product:${id}:d3Value`,value:{kind:"known",value:"duration"}},noModel);expect(s.projection.sections.D.suspectProducts[0].treatmentDuration).toEqual({value:"1.50",unit:"hours"});const after=(await repo.load(c.id))!;expect(after.products[0].facts.startDate).toEqual(c.products[0].facts.startDate);expect(after.products[0].facts.treatmentDuration.resolvedValue!.sourceIds.length).toBeGreaterThan(0);
});
