import {correctCapacityProduct,productCapacityCase} from "./product-capacity";
import {purchaseDetailsA} from "./medication-model";
import {referenceFixture} from "./source-references";
export const nativeDContext="Fictional third-product classification supplied; label source pending";
export function nativeDCopyCase(){return correctCapacityProduct(productCapacityCase(),2,{
 role:{kind:"known",value:"suspect"},productType:{kind:"known",value:"other"},
 manufacturer:{kind:"known",value:"Fictional Third Maker"},lotNumber:{kind:"known",value:"THIRD-LOT-208"},ndcOrUniqueId:{kind:"known",value:"00000-0208-03"},
 strength:{kind:"known",value:"25 mg",qualifier:"Fictional strength account unconfirmed"},dose:{kind:"known",value:"10 mg",qualifier:"Fictional dose record uncertain"},
 purchaseDate:{kind:"known",value:"2026-08-12"},...Object.fromEntries(Object.entries(purchaseDetailsA).map(([k,v])=>[k,{kind:"known",value:v}])),
 expirationDate:{kind:"known",value:"2027-01-31"},startDate:{kind:"known",value:"2026-08-13"},stopDate:{kind:"known",value:"2026-08-20"},doseReductionDate:{kind:"known",value:"2026-08-15"},therapyOngoing:{kind:"known",value:false},
 medicationType:{kind:"known",value:["brand","otc"]},cosmeticUse:{kind:"known",value:"retail"},otherProductTypes:{kind:"known",value:["other","cannabinoid-hemp"],qualifier:nativeDContext},
 stopped:{kind:"known",value:true},improvedAfterChange:{kind:"known",value:true},restarted:{kind:"known",value:true},recurred:{kind:"known",value:false},
});}
export const nativeDUpdate="Correction for Synthetic product C: it is a suspect product, not concomitant. Keep its supplied category, all details, context and the other two products unchanged.";
export const nativeDCopyScenario=[{identityScope:"native-d-copy",turn:"correction"as const,output:referenceFixture(nativeDUpdate,{products:[],proposals:[{proposalReference:"third-role",groupReference:"third-role",intent:"correction",target:{entity:"product",productReference:"product-lisinopril",field:"role"},value:{kind:"known",value:"suspect"},evidenceQuote:nativeDUpdate}]})}];
