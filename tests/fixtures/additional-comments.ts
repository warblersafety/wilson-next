import oldState from "./additional-comments-v22.json" with { type: "json" };
import { parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { setContextFact } from "./reviewed-context";
import { referenceFixture } from "./source-references";
export const generalComment="Fictional general comment: the sealed sample remains in the clinic cabinet.\nThe reporter can supply label photographs separately.";
export const commentContext="arrangement reported by staff; availability not independently confirmed";
export const commentsUpdate=`Add these general Additional comments to the fictional report, without changing other facts: ${generalComment} Context for these comments: ${commentContext}.`;
export const disputedComment="Fictional records disagree on the general Additional comments: the sealed sample was moved to room B; location awaits confirmation. Preserve both alternatives for review, keep all other details unchanged.";
export const alternativeComment="the sealed sample was moved to room B";
export function additionalCommentsCase(){return parseBrowserJourneyState(structuredClone(oldState)).case;}
export function reviewedCommentsCase(){return setContextFact(additionalCommentsCase(),"event:event:additionalComments",{kind:"known",value:generalComment,qualifier:commentContext});}
export const additionalCommentsScenario=[
 {identityScope:"additional-comments",turn:"correction"as const,output:referenceFixture(commentsUpdate,{products:[],proposals:[{proposalReference:"comments",groupReference:"comments",intent:"fact",target:{entity:"event",field:"additionalComments"},value:{kind:"known",value:generalComment,qualifier:commentContext},evidenceQuote:commentsUpdate}]})},
 {identityScope:"comments-dispute",turn:"correction"as const,output:referenceFixture(disputedComment,{products:[],proposals:[{proposalReference:"comments-alternative",groupReference:"comments-dispute",intent:"alternative",target:{entity:"event",field:"additionalComments"},value:{kind:"known",value:alternativeComment,qualifier:"location awaits confirmation"},evidenceQuote:disputedComment}]})},
];
