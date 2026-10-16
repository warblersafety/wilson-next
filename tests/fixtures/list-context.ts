import { contextCase, setContextFact, contextSource } from "./reviewed-context";
import { referenceFixture, type QuotedFixtureOutput } from "./source-references";
import { applyCaseCommand } from "../../src/domain/case/commands";
export const listValues = { symptoms: ["dizziness", "rash"], treatments: ["IV fluids", "vitamin K"] };
export const listContext = { symptoms: "rash may predate dizziness; order uncertain", treatments: "vitamin K dose not recorded; timing of IV fluids uncertain" };
export const listUpdate = "Fictional correction: symptoms were dizziness and rash; rash may predate dizziness; order uncertain. Treatments were IV fluids and vitamin K; vitamin K dose not recorded; timing of IV fluids uncertain. Keep other details unchanged.";
export const listDispute = "Fictional records disagree: treatments were IV fluids and vitamin K, vitamin K dose not recorded; timing of IV fluids uncertain; or observation and oral fluids, order uncertain. Retain both records for explicit review.";
export function listContextCase() {
 let c=contextCase();for(const field of ["symptoms","treatments"]as const)c=setContextFact(c,`event:event:${field}`,{kind:"known",value:listValues[field],qualifier:listContext[field]});return c;
}
export function listConflict(field:"symptoms"|"treatments") {
 const c=listContextCase(),source=contextSource(`list-${field}`,listDispute);
 const pending=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:`list-pending-${field}`,expectedRevision:c.revision,products:[],sources:[source],proposals:[{proposalId:"list-alternative",groupId:"list-dispute",intent:"alternative",target:{entity:"event",entityId:"event",field},value:{kind:"known",value:["observation","oral fluids"],qualifier:"order uncertain"},sourceIds:[source.id]}]}).case;
 return {pending,accepted:applyCaseCommand(pending,{type:"review-proposal-groups",commandId:`list-accept-${field}`,expectedRevision:pending.revision,decisions:[{groupId:"list-dispute",action:"accept"}]}).case};
}
const corrections:QuotedFixtureOutput={products:[],proposals:(["symptoms","treatments"]as const).map(field=>({proposalReference:`list-${field}`,groupReference:"list-correction",intent:"correction",target:{entity:"event",field},value:{kind:"known",value:listValues[field],qualifier:listContext[field]},evidenceQuote:listUpdate}))};
export const listContextScenario=[
 {identityScope:"list-context",turn:"correction"as const,output:referenceFixture(listUpdate,corrections)},
 {identityScope:"list-context-dispute",turn:"correction"as const,output:referenceFixture(listDispute,{products:[],proposals:[{proposalReference:"list-alternative",groupReference:"list-dispute",intent:"alternative",target:{entity:"event",field:"treatments"},value:{kind:"known",value:["observation","oral fluids"],qualifier:"order uncertain"},evidenceQuote:listDispute}]})},
];
