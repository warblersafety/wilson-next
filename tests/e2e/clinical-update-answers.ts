import {expect,type Page} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {performJourneyAction,getJourneySnapshot,type JourneyAction} from "../../src/server/journey/service";
import {journeyResponse} from "../../src/server/case/browser-state";
import {parseQuotedFixture,type QuotedFixtureOutput} from "../fixtures/source-references";
import {goTo,serverAction,storedState} from "./draft4-helpers";
import type{CaseValue}from"../../src/domain/case/types";

/** Test-only semantic model fixture for former direct-question regression paths.
 * Types the explicit supplied answers into the real Clinical update, mocks only
 * interpretation with the production boundary/service, then accepts each group
 * through the real HTTP/UI path. It never calls a live provider or consumes the
 * separately ordered opening/correction response queue. */
export async function clinicalAnswers(page:Page,action:JourneyAction){
 const state=await storedState(page),repo=new InMemoryCaseRepository({initialCase:state.case}),snapshot=await getJourneySnapshot(repo,state.case.id),q=snapshot.clarification;
 const entries:Array<{target:QuotedFixtureOutput['proposals'][number]['target'];value:CaseValue<unknown>}>=[],tests:Array<{testReference:string;groupReference:string}>=[];
 const event=(field:string,value:CaseValue<unknown>)=>entries.push({target:{entity:'event',field} as any,value});
 const product=(productReference:string,field:string,value:CaseValue<unknown>)=>entries.push({target:{entity:'product',productReference,field} as any,value});
 if(action.action==='answer-medication-history'){for(const[field,value]of Object.entries(action.answers))if(value)product(action.productId,field,value);}
 else if(action.action==='answer-serious-outcomes'){for(const target of q?.targetIds??[]){const field=target.split(':').at(-1)!;event(field,action.disposition==='known'?{kind:'known',value:action.selected.includes(field as any)}:{kind:action.disposition});}}
 else if(action.action==='answer-death-date')event('deathDate',action.value);
 else if(action.action==='answer-indications'){for(const a of action.answers)product(a.productId,'indication',a.value);}
 else if(action.action==='answer-device-details'){for(const field of ['implantDate','explantDate','reprocessor']as const)if(action[field])product(q?.kind==='device-details'?q.deviceId:'missing-device',field,action[field]!);}
 else if(action.action==='answer-clinical-context'){
  if(action.history)event('relevantHistory',action.history);
  const t=action.test;if(t){event('relevantTestsAvailable',t.kind==='known'?{kind:'known',value:true}:t.kind==='explicitly-absent'?{kind:'known',value:false}:t);
   if(t.kind==='known'){const ref='completion-test';tests.push({testReference:ref,groupReference:ref});for(const[field,value]of Object.entries({testName:t.testName,testResult:t.testResult,lowRange:t.lowRange,highRange:t.highRange,date:t.date}))if(value!==undefined)entries.push({target:{entity:'test',testReference:ref,field}as any,value:{kind:'known',value}});}
  }
 }else throw Error('Unsupported test clinical answer action');
 if(!entries.length)throw Error('No explicit answer fixture supplied');
 for(const {target} of entries)if(target.entity==='product'&&!state.case.products.some(p=>p.id===target.productReference))throw Error('Clinical answer fixture targets a different product than the resumed case');
 const text='Fictional clinical update. '+entries.map(({target,value})=>{const productName=target.entity==='product'?state.case.products.find(p=>p.id===target.productReference)?.facts.name.resolvedValue?.value:undefined;const name=productName?.kind==='known'?productName.value:target.entity;const field=target.field.replace(/([a-z])([A-Z])/g,'$1 $2');return `${name}: ${field}: ${value.kind==='known'?typeof value.value==='boolean'?(value.value?'Yes':'No'):typeof value.value==='string'?value.value:JSON.stringify(value.value):value.kind}${value.kind==='known'&&value.qualifier?'; context: '+value.qualifier:''}.`;}).join(' ');
 const output={products:[],tests,proposals:entries.map(({target,value},i)=>({proposalReference:'answer-'+i,groupReference:target.entity==='product'?target.productReference:target.entity==='test'?target.testReference:target.entity,intent:'fact',target,value,evidenceQuote:text}))};
 const handler=async(route:import('@playwright/test').Route)=>{try{const b=route.request().postDataJSON();if(b?.action?.action!=='submit-update'||b.action.text!==text)return route.fallback();const repository=new InMemoryCaseRepository({initialCase:b.state.case});const s=await performJourneyAction(repository,b.state.case.id,b.action,{propose:async(turn,input)=>({envelope:parseQuotedFixture({turn,input:{id:'input-'+randomUUID(),type:'correction',text:input,recordedAt:'2026-10-17T12:00:00Z'},existingProductIds:b.state.case.products.map((p:{id:string})=>p.id),existingTestIds:b.state.case.relevantTests.map((t:{id:string})=>t.id),output:output as any},kind=>kind+'-'+randomUUID())})});await route.fulfill({json:await journeyResponse(repository,s)});}catch(error){console.error("Clinical answer fixture failed",JSON.stringify(error));await route.fulfill({status:500,json:{error:"Test clinical answer fixture failed"}});}};
 await page.route('**/api/case',handler);
 try{await goTo(page,'Review details');await page.getByLabel('Clinical update',{exact:true}).fill(text);await serverAction(page,()=>page.getByRole('button',{name:'Prepare changes for review',exact:true}).click());await expect(page.getByRole('heading',{name:'Review the proposed update',exact:true})).toBeVisible();}finally{await page.unroute('**/api/case',handler);}
 for(let i=0;i<15;i++){const buttons=page.getByRole('button',{name:'Accept these changes',exact:true});if(!await buttons.count())return;await serverAction(page,()=>buttons.first().click());}throw Error('Completion proposal loop');
}
export async function unknownMedicationAnswers(page:Page){for(let i=0;i<3;i++){const state=await storedState(page),repo=new InMemoryCaseRepository({initialCase:state.case}),s=await getJourneySnapshot(repo,state.case.id),q=s.clarification;if(q?.kind!=='medication-history')return;await clinicalAnswers(page,{action:'answer-medication-history',productId:q.productId,answers:Object.fromEntries(q.targetIds.map(t=>[t.split(':').at(-1)!,{kind:'unknown'}]))});}}
export async function clinicalQuestion(page:Page){const state=await storedState(page),repo=new InMemoryCaseRepository({initialCase:state.case});return(await getJourneySnapshot(repo,state.case.id)).clarification;}
