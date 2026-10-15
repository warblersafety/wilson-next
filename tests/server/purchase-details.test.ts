import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {modelProposalOutputSchema} from "../../src/domain/case/model-boundary";
import {referenceFixture} from "../fixtures/source-references";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {productCapacityCase} from "../fixtures/product-capacity";
import {purchaseDetailFields} from "../../src/domain/case/purchase-details";
it.each(purchaseDetailFields)("captures only explicit exact %s text at the model boundary, without inferring sibling facts",field=>{
 const text="Explicit fictional seller detail with exact source.";const value=field==="purchaseSellerCountry"?"UK":"001 exact supplied text";
 const r=parseQuotedFixture({turn:"opening",input:{id:"seller-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"name",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"name"},value:{kind:"known",value:"Fictional product"},evidenceQuote:text},{proposalReference:"detail",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field},value:{kind:"known",value},evidenceQuote:text}]}},(k,ref)=>`${k}-${ref}`);
 expect(r.proposals.filter(p=>p.target.field===field)[0].value).toEqual({kind:"known",value});expect(r.unrepresented).toEqual([]);expect(r.proposals.filter(p=>p.target.field!=="name"&&p.target.field!==field)).toEqual([]);
});
it("direct seller city correction leaves manufacturer, reporter and all other metadata unchanged without model calls",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,repo=new InMemoryCaseRepository({initialCase:c});
 await performJourneyAction(repo,c.id,{action:"set-fact",target:`product:${id}:purchaseSellerCity`,value:{kind:"known",value:"Fictional City"}},{propose:async()=>{throw new Error("No live model");}});
 const after=(await repo.load(c.id))!;expect(after.reporter).toEqual(c.reporter);for(const f of Object.keys(c.products[0].facts)as Array<keyof typeof c.products[0]["facts"]>)if(f!=="purchaseSellerCity")expect(after.products[0].facts[f]).toEqual(c.products[0].facts[f]);
});
