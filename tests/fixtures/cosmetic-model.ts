import type {ProductFactKey} from "../../src/domain/case/types";
import {referenceFixture,type QuotedFixtureOutput} from "./source-references";
export const cosmeticOpening="Fictional patient COS-55 is 55 years old and developed a rash. I suspect Fictional lotion A and Fictional lotion B. Both are explicitly cosmetic products. Both were used for skin moisturization. Lotion A is cosmetics for professional use only; lotion B is cosmetics sold on a retail basis. Neither product was stopped, dose-reduced or restarted. No serious outcomes applied, and there are no relevant tests or additional medical history.";
export const cosmeticCorrection="Correction: Fictional lotion B is cosmetics for professional use only, not cosmetics sold on a retail basis.";
const proposals:QuotedFixtureOutput["proposals"]=[];
const add=(target:QuotedFixtureOutput["proposals"][number]["target"],value:unknown,groupReference:string)=>proposals.push({proposalReference:`cos-${proposals.length}`,groupReference,intent:"fact",target,value:{kind:"known",value}as QuotedFixtureOutput["proposals"][number]["value"],evidenceQuote:cosmeticOpening});
add({entity:"patient",field:"identifier"},"COS-55","patient");add({entity:"patient",field:"ageYears"},55,"patient");add({entity:"event",field:"symptoms"},["rash"],"event");
for(const field of["death","lifeThreatening","hospitalized","disability","requiredIntervention","congenitalAnomaly","otherSerious","relevantTestsAvailable"]as const)add({entity:"event",field},false,"event");
proposals.push({proposalReference:"no-history",groupReference:"event",intent:"fact",target:{entity:"event",field:"relevantHistory"},value:{kind:"explicitly-absent"},evidenceQuote:cosmeticOpening});
for(const [ref,name,use]of[["a","Fictional lotion A","professional-use-only"],["b","Fictional lotion B","retail"]]as const){
 for(const [field,value]of Object.entries({name,productType:"other",role:"suspect",indication:"skin moisturization",stopped:false,doseReduced:false,restarted:false,cosmeticUse:use}))add({entity:"product",productReference:ref,field:field as Exclude<ProductFactKey,"d3Value">},value,ref);
}
export const cosmeticScenario=[
 {identityScope:"cosmetic-use",turn:"opening"as const,output:referenceFixture(cosmeticOpening,{products:["a","b"].map(productReference=>({productReference,groupReference:productReference})),proposals})},
 {identityScope:"cosmetic-use-update",turn:"correction"as const,output:referenceFixture(cosmeticCorrection,{products:[],proposals:[{proposalReference:"cosmetic-correction",groupReference:"cosmetic-update",intent:"correction",target:{entity:"product",productReference:"product-cosmetic-use-b",field:"cosmeticUse"},value:{kind:"known",value:"professional-use-only"},evidenceQuote:cosmeticCorrection}]})},
];
