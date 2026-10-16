import { referenceFixture, type QuotedFixtureOutput } from "./source-references";
export const noPatientOpening = "Entirely fictional product-problem report. An unopened bottle of Example Meadow lotion, a retail cosmetic, contained visible foreign particles. It was not used and no patient was involved. No adverse event occurred. The bottle is available for evaluation. I identify Example Meadow lotion as the suspect product.";
export const patientPresentCorrection = "Correction: a patient was involved in this fictional report; the patient identifier is unknown. Keep all product details unchanged.";
export const patientUnknownCorrection = "Correction: whether any patient was involved is unknown. Keep all other details unchanged.";
export const noPatientOutput: QuotedFixtureOutput = {
 products: [{ productReference: "lotion", groupReference: "lotion" }],
 proposals: [
  {proposalReference:"participation",groupReference:"patient",intent:"fact",target:{entity:"patient",field:"involvement"},value:{kind:"known",value:"none"},evidenceQuote:"It was not used and no patient was involved."},
  {proposalReference:"complaint",groupReference:"event",intent:"fact",target:{entity:"event",field:"problemDescription"},value:{kind:"known",value:"An unopened bottle of Example Meadow lotion contained visible foreign particles. It was not used."},evidenceQuote:noPatientOpening},
  ...([['name','Example Meadow lotion'],['productType','other'],['role','suspect'],['cosmeticUse','retail']] as const).map(([field,value],i)=>({proposalReference:`product-${i}`,groupReference:"lotion",intent:"fact" as const,target:{entity:"product" as const,productReference:"lotion",field},value:{kind:"known" as const,value},evidenceQuote:noPatientOpening})),
  {proposalReference:"availability",groupReference:"event",intent:"fact",target:{entity:"event",field:"productAvailability"},value:{kind:"known",value:"available"},evidenceQuote:"The bottle is available for evaluation."},
  {proposalReference:"symptoms",groupReference:"event",intent:"fact",target:{entity:"event",field:"symptoms"},value:{kind:"explicitly-absent"},evidenceQuote:"No adverse event occurred."},
 ],
};
export const patientInvolvementScenario = [
 {identityScope:"patient-involvement",turn:"opening" as const,output:referenceFixture(noPatientOpening,noPatientOutput)},
 {identityScope:"patient-present",turn:"correction" as const,output:referenceFixture(patientPresentCorrection,{products:[],proposals:[{proposalReference:"present",groupReference:"patient-update",intent:"correction",target:{entity:"patient",field:"involvement"},value:{kind:"known",value:"present"},evidenceQuote:patientPresentCorrection},{proposalReference:"identifier-unknown",groupReference:"patient-update",intent:"fact",target:{entity:"patient",field:"identifier"},value:{kind:"unknown"},evidenceQuote:patientPresentCorrection}]})},
 {identityScope:"patient-unknown",turn:"correction" as const,output:referenceFixture(patientUnknownCorrection,{products:[],proposals:[{proposalReference:"unknown",groupReference:"patient-unknown",intent:"correction",target:{entity:"patient",field:"involvement"},value:{kind:"unknown"},evidenceQuote:patientUnknownCorrection}]})},
];
