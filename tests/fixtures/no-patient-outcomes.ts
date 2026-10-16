import oldState from "./patient-involvement-v21.json" with { type: "json" };
import { parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { seriousOutcomeFields } from "../../src/domain/case/serious-outcomes";
import { setContextFact, contextSource } from "./reviewed-context";
export { seriousOutcomeFields };
export function explicitNoPatientCase() {
  return setContextFact(parseBrowserJourneyState(structuredClone(oldState)).case,"patient:patient:involvement",{kind:"known",value:"none"});
}
export function disputedOutcome(field: typeof seriousOutcomeFields[number] = "hospitalized", values: Array<{kind:"known";value:boolean}|{kind:"unknown"}|{kind:"declined"}> = [{kind:"known",value:true},{kind:"known",value:false}]) {
  const c=explicitNoPatientCase(),source=contextSource("disputed-outcome",`Fictional explicit records disagree on ${field}: ${JSON.stringify(values)}.`);
  const pending=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:"pending-outcome",expectedRevision:c.revision,products:[],sources:[source],proposals:values.map((value,i)=>({proposalId:`outcome-${i}`,groupId:"outcome-disagreement",intent:"alternative" as const,target:{entity:"event" as const,entityId:"event" as const,field},value,sourceIds:[source.id]}))}).case;
  const accepted=applyCaseCommand(pending,{type:"review-proposal-groups",commandId:"accept-outcome-disagreement",expectedRevision:pending.revision,decisions:[{groupId:"outcome-disagreement",action:"accept"}]}).case;
  return {pending,accepted};
}
