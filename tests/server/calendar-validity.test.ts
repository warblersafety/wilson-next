import {expect,it} from "vitest";
import {parseQuotedFixture} from "../fixtures/source-references";
import {productCapacityCase} from "../fixtures/product-capacity";
import {setContextFact} from "../fixtures/reviewed-context";
import {allFacts,getFact} from "../../src/domain/case/facts";
import {isCalendarDateTarget,knownValueMismatch} from "../../src/domain/case/value-contract";
import {parseBrowserJourneyState,browserStateVersion} from "../../src/server/case/browser-state";
import {getJourneySnapshot,performJourneyAction} from "../../src/server/journey/service";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
const noModel={propose:async()=>{throw new Error('No model calls');}};
const dateTargets=allFacts(productCapacityCase()).filter(({target})=>isCalendarDateTarget(target)).map(({target})=>target);
it.each(dateTargets)('rejects impossible and partial new dates at every date target %j',async target=>{
 const c=productCapacityCase(),repo=new InMemoryCaseRepository({initialCase:c});
 for(const value of ['2026-02-29','1900-02-29','2026-04-31','2026-13-01','2026-01-00','0000-01-01','2026-09']){
  expect(knownValueMismatch(target,{kind:'known',value})).toContain('complete valid');
  await expect(performJourneyAction(repo,c.id,{action:'set-fact',target:`${target.entity}:${target.entityId}:${target.field}`,value:{kind:'known',value}},noModel)).rejects.toThrow();
  expect(await repo.load(c.id)).toEqual(c);
 }
 for(const value of ['2000-02-29','2028-02-29','0001-01-01','9999-12-31'])expect(knownValueMismatch(target,{kind:'known',value})).toBeUndefined();
});
it.each(['onsetDate','deathDate','dischargeDate','productReturnDate'])('quarantines model %s with exact evidence and no substitute date',field=>{
 const text=`Fictional symptom and clinician supplied ${field}: 2026-02-30; exact day needs clarification.`;
 const result=parseQuotedFixture({turn:'opening',input:{id:'calendar-input',type:'narrative',text,recordedAt:'2026-10-16T00:00:00Z'},output:{products:[],proposals:[{proposalReference:"symptoms",groupReference:"symptoms",intent:"fact",target:{entity:"event",field:"symptoms"},value:{kind:"known",value:["Fictional symptom"]},evidenceQuote:text},{proposalReference:'date',groupReference:'date',intent:'fact',target:{entity:'event',field},value:{kind:'known',value:'2026-02-30'},evidenceQuote:text}]}},(kind,ref)=>`${kind}-${ref}`);
 expect(result.proposals.map(p=>p.target.field)).toEqual(["symptoms"]);expect(result.unrepresented).toContainEqual(expect.objectContaining({field,reason:'incompatible-value',evidenceQuote:text}));
});
it('restores invalid legacy current/pending/history losslessly, blocks only current value, and explicit correction keeps history',async()=>{
 let c=structuredClone(setContextFact(productCapacityCase(),'event:event:onsetDate',{kind:'known',value:'2028-02-29'}));
 const fact=c.event.facts.onsetDate;fact.resolvedValue!.value={kind:'known',value:'2026-02-30'};
 const pending=structuredClone(fact.resolvedValue!);pending.id='legacy-pending';pending.value={kind:'known',value:'2026-13-01'};fact.proposedValues.push(pending);
 const previous=structuredClone(pending);previous.id='legacy-history';fact.supersededValues.push(previous);
 const state={version:browserStateVersion,stage:'output' as const,case:c,unrepresented:[]};expect(parseBrowserJourneyState(structuredClone(state))).toEqual(state);
 fact.proposedValues=[];const repo=new InMemoryCaseRepository({initialCase:c}),before=structuredClone(c),snapshot=await getJourneySnapshot(repo,c.id);
 expect(snapshot.downloadReady).toBe(false);expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({code:'invalid-calendar-date',targets:['event:event:onsetDate']}));expect(await repo.load(c.id)).toEqual(before);
 const result=await performJourneyAction(repo,c.id,{action:'set-fact',target:'event:event:onsetDate',value:{kind:'known',value:'2028-02-29'}},noModel);expect(result.outputIssues.some(i=>i.code==='invalid-calendar-date')).toBe(false);
 const after=(await repo.load(c.id))!;expect(after.event.facts.onsetDate.supersededValues.some(v=>v.value.kind==='known'&&v.value.value==='2026-02-30')).toBe(true);expect(after.event.facts.onsetDate.supersededValues.some(v=>v.value.kind==='known'&&v.value.value==='2026-13-01')).toBe(true);
 for(const {target,fact:old}of allFacts(before))if(target.field!=='onsetDate')expect(getFact(after,target)).toEqual(old);
 expect(parseBrowserJourneyState({version:browserStateVersion,stage:'output',case:after,unrepresented:[]}).case).toEqual(after);
});
it('legacy invalid pending and conflict alternatives stay unaccepted; selecting valid alternative preserves invalid history',async()=>{
 const {applyCaseCommand}=await import('../../src/domain/case/commands');const {contextSource}=await import('../fixtures/reviewed-context');
 const c=structuredClone(setContextFact(productCapacityCase(),'event:event:onsetDate',{kind:'known',value:'2028-02-29'}));const f=c.event.facts.onsetDate,valid=structuredClone(f.resolvedValue!),invalid=structuredClone(valid);invalid.id='legacy-impossible';invalid.groupId='legacy-invalid-group';invalid.value={kind:'known',value:'2026-02-30'};
 f.proposedValues=[invalid];const before=structuredClone(c);expect(()=>applyCaseCommand(c,{type:'review-proposal-groups',commandId:'review-invalid',expectedRevision:c.revision,decisions:[{groupId:invalid.groupId,action:'accept'}]})).toThrow('complete valid');expect(c).toEqual(before);
 f.proposedValues=[];f.state='conflicted';f.resolvedValue=undefined;f.conflictingValues=[invalid,valid];const state={version:browserStateVersion,stage:'output' as const,case:c,unrepresented:[]};expect(parseBrowserJourneyState(state)).toEqual(state);
 const command={type:'resolve-conflict' as const,commandId:'choose-date',expectedRevision:c.revision,target:{entity:'event' as const,entityId:'event' as const,field:'onsetDate' as const},chosenValueId:invalid.id,source:contextSource('choose-date')};expect(()=>applyCaseCommand(c,command)).toThrow('complete valid');expect(c.event.facts.onsetDate.conflictingValues).toEqual([invalid,valid]);
 const after=applyCaseCommand(c,{...command,chosenValueId:valid.id}).case;expect(after.event.facts.onsetDate.resolvedValue?.value).toEqual(valid.value);expect(after.event.facts.onsetDate.supersededValues).toContainEqual(invalid);expect((await getJourneySnapshot(new InMemoryCaseRepository({initialCase:after}),after.id)).outputIssues.some(i=>i.code==='invalid-calendar-date')).toBe(false);
});
it('recovers a legacy invalid date in a mixed later group without rejecting unrelated proposals',async()=>{
 const {legacyPendingCalendar}=await import('../fixtures/legacy-calendar');const c=legacyPendingCalendar(),repo=new InMemoryCaseRepository({initialCase:c});
 const result=await performJourneyAction(repo,c.id,{action:'review-update-group',groupId:'legacy-date-update',decision:'accept',dateCorrections:[{proposalId:'legacy-date-proposal',value:{kind:'known',value:'2028-02-29'}}]},noModel);
 const after=(await repo.load(c.id))!;expect(after.event.facts.outcome.resolvedValue?.value).toEqual({kind:'known',value:'Fictional separately supplied improvement'});expect(after.event.facts.onsetDate.resolvedValue?.value).toEqual({kind:'known',value:'2028-02-29'});expect(after.event.facts.onsetDate.supersededValues.some(v=>v.id==='legacy-date-proposal'&&v.value.kind==='known'&&v.value.value==='2026-02-30')).toBe(true);expect(result.outputIssues.some(i=>i.code==='invalid-calendar-date')).toBe(false);expect(after.products).toEqual(c.products);expect(after.patient).toEqual(c.patient);expect(after.reporter).toEqual(c.reporter);
});
it('explicit supplied correction resolves an all-invalid legacy date conflict while retaining every alternative and rejects unrelated correction targets',async()=>{
 const {legacyCalendarConflict}=await import('../fixtures/legacy-calendar');const c=legacyCalendarConflict(),repo=new InMemoryCaseRepository({initialCase:c}),old=structuredClone(c.event.facts.onsetDate.conflictingValues);
 await performJourneyAction(repo,c.id,{action:'resolve-conflict',target:'event:event:onsetDate',chosenValueId:old[0].id,dateCorrection:{kind:'unknown'}},noModel);const after=(await repo.load(c.id))!;expect(after.event.facts.onsetDate.resolvedValue?.value).toEqual({kind:'unknown'});for(const value of old)expect(after.event.facts.onsetDate.supersededValues).toContainEqual(value);expect(after.products).toEqual(c.products);expect(after.patient).toEqual(c.patient);
 const {applyCaseCommand}=await import('../../src/domain/case/commands');const {contextSource}=await import('../fixtures/reviewed-context');const valid=structuredClone(c);valid.event.facts.onsetDate.conflictingValues[0].value={kind:'known',value:'2028-02-29'};expect(()=>applyCaseCommand(valid,{type:'resolve-conflict',commandId:'out-of-scope',expectedRevision:valid.revision,target:{entity:'event',entityId:'event',field:'onsetDate'},chosenValueId:old[0].id,dateCorrection:{kind:'unknown'},source:contextSource('out-of-scope')})).toThrow('Only a retained invalid date');
});
