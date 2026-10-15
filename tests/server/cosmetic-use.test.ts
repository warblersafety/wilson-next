import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {modelProposalOutputSchema} from "../../src/domain/case/model-boundary";
import {referenceFixture} from "../fixtures/source-references";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction} from "../../src/server/journey/service";
import {productCapacityCase} from "../fixtures/product-capacity";
it.each(["professional-use-only","retail",["professional-use-only","retail"],true])("validates only complete explicitly supplied cosmetic choices %j at the model boundary",value=>{
 const text="Fictional product X has an explicitly supplied cosmetic product type.";
 const r=parseQuotedFixture({turn:"opening",input:{id:"cosmetic-input",type:"narrative",text,recordedAt:"2026-10-15T00:00:00Z"},output:{products:[{productReference:"x",groupReference:"x"}],proposals:[{proposalReference:"name",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"name"},value:{kind:"known",value:"X"},evidenceQuote:text},{proposalReference:"cosmetic",groupReference:"x",intent:"fact",target:{entity:"product",productReference:"x",field:"cosmeticUse"},value:{kind:"known",value},evidenceQuote:text}]}},(k,ref)=>`${k}-${ref}`);
 const p=r.proposals.filter(p=>p.target.field==="cosmeticUse");if(value==="professional-use-only"||value==="retail"){expect(p[0].value).toEqual({kind:"known",value});expect(r.unrepresented).toEqual([]);}else{expect(p).toEqual([]);expect(r.unrepresented).toContainEqual(expect.objectContaining({field:"cosmeticUse",reason:"incompatible-value",evidenceQuote:text}));}expect(r.proposals.some(p=>["productType","medicationType"].includes(p.target.field))).toBe(false);
});
it("direct cosmetic correction preserves all unrelated product facts and never calls a model",async()=>{
 const c=productCapacityCase(),id=c.products[0].id,repo=new InMemoryCaseRepository({initialCase:c}),noModel={propose:async()=>{throw new Error("No model calls");}};
 await performJourneyAction(repo,c.id,{action:"set-fact",target:`product:${id}:cosmeticUse`,value:{kind:"known",value:"retail",qualifier:"explicit supplied label"}},noModel);
 const after=(await repo.load(c.id))!;for(const field of Object.keys(c.products[0].facts)as Array<keyof typeof c.products[0]["facts"]>)if(field!=="cosmeticUse")expect(after.products[0].facts[field]).toEqual(c.products[0].facts[field]);expect(after.products[0].facts.cosmeticUse.resolvedValue!.sourceIds.length).toBeGreaterThan(0);
});
