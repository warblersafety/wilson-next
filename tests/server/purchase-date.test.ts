import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {modelProposalOutputSchema} from "../../src/domain/case/model-boundary";
import {referenceFixture} from "../fixtures/source-references";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {productCapacityCase} from "../fixtures/product-capacity";
it.each(["2024-02-29","2026-08","2026-02-29",20260812])("validates only complete explicitly supplied purchase dates %j at the model boundary",value=>{
 const text="Fictional product X has an explicitly supplied purchase date.";
 const r=parseQuotedFixture({turn:"opening",input:{id:"purchase-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"name",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"name"},value:{kind:"known",value:"X"},evidenceQuote:text},{proposalReference:"purchase",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"purchaseDate"},value:{kind:"known",value},evidenceQuote:text}]}},(k,ref)=>`${k}-${ref}`);
 const p=r.proposals.filter(p=>p.target.field==="purchaseDate");if(value==="2024-02-29"){expect(p[0].value).toEqual({kind:"known",value});expect(r.unrepresented).toEqual([]);}else{expect(p).toEqual([]);expect(r.unrepresented).toContainEqual(expect.objectContaining({field:"purchaseDate",reason:"incompatible-value",evidenceQuote:text}));}expect(r.proposals.some(p=>["startDate","stopDate","expirationDate"].includes(p.target.field))).toBe(false);
});
it("direct purchase correction preserves all unrelated product facts and never calls a model",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,repo=new InMemoryCaseRepository({initialCase:c}),noModel={propose:async()=>{throw new Error("No model calls");}};
 await performJourneyAction(repo,c.id,{action:"set-fact",target:`product:${id}:purchaseDate`,value:{kind:"known",value:"2026-08-12",qualifier:"explicit estimate"}},noModel);
 const after=(await repo.load(c.id))!;for(const field of Object.keys(c.products[0].facts)as Array<keyof typeof c.products[0]["facts"]>)if(field!=="purchaseDate")expect(after.products[0].facts[field]).toEqual(c.products[0].facts[field]);expect(after.products[0].facts.purchaseDate.resolvedValue!.sourceIds.length).toBeGreaterThan(0);
});
