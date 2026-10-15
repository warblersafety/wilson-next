import { medicationScenarios, medicationTwoOpening } from "./medication-model";
import { referenceFixture } from "./source-references";
export const continuationHistory = Array.from({length:65},(_,i)=>`Fictional prior episode ${i+1}: clinician supplied these exact words; dates uncertain.`).join("\n");
export const continuationOpening = medicationTwoOpening.replace("and there are no relevant tests or additional medical history.","and there are no relevant tests.")+" The complete relevant history is:\n"+continuationHistory;
const base=structuredClone(medicationScenarios.issue92Two[0].output);
export const continuationScenario = [{identityScope:"narrative-continuation",turn:"opening"as const,output:referenceFixture(continuationOpening,{...base,proposals:base.proposals.map(({evidenceReferences,...p})=>({...p,evidenceQuote:continuationOpening,...(p.target.entity==="event"&&p.target.field==="relevantHistory"?{value:{kind:"known",value:continuationHistory}}:{})}))})}];
