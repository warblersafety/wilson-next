import {applyCaseCommand} from '../../src/domain/case/commands';
import {productCapacityCase} from './product-capacity';
import {contextSource} from './reviewed-context';
/** Stored legacy shapes, deliberately injected after valid authoritative attachment. */
export function legacyPendingCalendar(opening=false){
 let c=structuredClone(productCapacityCase());if(opening){c.event.state='proposed';c.event.facts.onsetDate={state:'empty',proposedValues:[],conflictingValues:[],supersededValues:[],sourceIds:[]};}
 const source=contextSource('legacy-date-review','Fictional retained date account and a separately supplied outcome.');
 c=structuredClone(applyCaseCommand(c,{type:'attach-grounded-proposals',commandId:'legacy-calendar-attach',expectedRevision:c.revision,products:[],sources:[source],proposals:[{proposalId:'legacy-date-proposal',groupId:opening?'event':'legacy-date-update',intent:'correction',target:{entity:'event',entityId:'event',field:'onsetDate'},value:{kind:'known',value:'2028-02-29'},sourceIds:[source.id]},{proposalId:'legacy-outcome-proposal',groupId:opening?'event':'legacy-date-update',intent:'correction',target:{entity:'event',entityId:'event',field:'outcome'},value:{kind:'known',value:'Fictional separately supplied improvement'},sourceIds:[source.id]}]}).case);
 c.event.facts.onsetDate.proposedValues[0].value={kind:'known',value:'2026-02-30'};return c;
}
export function legacyCalendarConflict(){const c=legacyPendingCalendar();const f=c.event.facts.onsetDate,other=structuredClone(f.proposedValues[0]);other.id='legacy-date-alternative';other.value={kind:'known',value:'2026-13-01'};f.state='conflicted';f.conflictingValues=[f.proposedValues[0],other];f.proposedValues=[];f.resolvedValue=undefined;c.event.facts.outcome.proposedValues=[];return c;}
