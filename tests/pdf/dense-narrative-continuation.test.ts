import {expect,it} from "vitest";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {applyCaseCommand} from "../../src/domain/case/commands";
import {projectForm3500} from "../../src/domain/case/projection";
import {fillForm3500Projection} from "../../src/server/pdf/form-3500";
import {testHistoryContextCase,labHistoryFields} from "../fixtures/test-history-context";
import {contextSource,setContextFact} from "../fixtures/reviewed-context";
import {browserStateVersion,parseBrowserJourneyState} from "../../src/server/case/browser-state";
import {getJourneySnapshot} from "../../src/server/journey/service";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
const comments="topmostSubform[0].Page3[0].AdditionalComments[0]";
function denseCase(){
 let c=testHistoryContextCase();
 for(let n=3;n<=6;n++){
  const id=`dense-assay-${n}`,source=contextSource(id,`Fictional assay ${n}: result ${n}.2 µg/L, low limit 1.0, high limit 9.0, collected 2026-08-19. Each field was transcribed from the supplied paper report; collection time relative to treatment is uncertain.`);
  const values={testName:`Fictional assay ${n}`,testResult:`${n}.2 µg/L`,lowRange:"1.0",highRange:"9.0",date:"2026-08-19"};
  c=applyCaseCommand(c,{type:"attach-grounded-proposals",commandId:`add-${id}`,expectedRevision:c.revision,products:[],relevantTests:[{id,groupId:id}],sources:[source],proposals:labHistoryFields.map(field=>({proposalId:`${id}-${field}`,groupId:id,intent:"fact",target:{entity:"test",entityId:id,field},value:{kind:"known",value:values[field],qualifier:"Transcribed from the supplied paper report; collection time relative to treatment is uncertain."},sourceIds:[source.id]}))}).case;
  c=applyCaseCommand(c,{type:"review-proposal-groups",commandId:`accept-${id}`,expectedRevision:c.revision,decisions:[{groupId:id,action:"accept"}]}).case;
 }
 return c;
}
async function inspect(c:ReturnType<typeof denseCase>,stem?:string){
 const projection=projectForm3500(c),filled=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 const directory=process.env.WILSON_CONTINUATION_EVIDENCE??await mkdtemp(join(tmpdir(),"wilson190-dense-")),path=join(directory,`${stem??"dense"}.pdf`);await writeFile(path,filled.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/continuation_readback.py",path]);
 if(stem&&process.env.WILSON_CONTINUATION_EVIDENCE)await writeFile(join(directory,`${stem}-readback.json`),stdout);
 const r=JSON.parse(stdout);r.pages=r.pages.filter((p:any)=>p.runs.some((r:any)=>r.text.includes("Narrative continuation")));return{...r,projection,body:r.pages.flatMap((p:any)=>p.runs.filter((r:any)=>r.y>=56&&r.y<=700).map((r:any)=>r.text)).join("")};
}
it("six reviewed serial tests export dense field/row-linked context exactly; withdrawal reflows correct current rows without obsolete context",async()=>{
 const c=denseCase(),before=structuredClone(c),restored=parseBrowserJourneyState(JSON.parse(JSON.stringify({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}))).case;
 const snap=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:restored}),restored.id);expect(snap.outputIssues).toEqual([]);expect(snap.downloadReady).toBe(true);
 const original=await inspect(restored,"dense-six-tests");expect(original.pageCount).toBeGreaterThan(8);expect(original.fields[comments]).toContain("continued");expect(original.body).toBe(original.projection.sections.B.relevantTestContext!.replaceAll("\n",""));expect(original.body).toContain("B6 table row 6 - Test date context:");
 const removed=applyCaseCommand(restored,{type:"withdraw-case-entity",commandId:"withdraw-first-dense",expectedRevision:restored.revision,target:{entity:"test",entityId:"test-hemoglobin"},source:contextSource("withdraw-first-dense")}).case;
 const after=await inspect(removed,"dense-after-withdrawal");expect(after.body).toBe(after.projection.sections.B.relevantTestContext!.replaceAll("\n",""));expect(after.body).not.toContain("B6 table row 6");expect(after.body).toContain("B6 table row 1 - Result and stated units context: second report:");expect(after.projection.sections.B.relevantTests[0].testId).toBe("test-lab-second");expect(removed.relevantTests[0].facts).toEqual(c.relevantTests[0].facts);expect(c).toEqual(before);
});
it.each(["unknown","declined","explicitly-absent","inapplicable"]as const)("long prior history is not resurrected by continuation after current %s",async kind=>{
 let c=testHistoryContextCase();const wording="Earlier fictional history. ".repeat(150);c=setContextFact(c,"event:event:relevantHistory",{kind:"known",value:wording});expect((await inspect(c)).body).toContain("Earlier fictional history.");
 c=setContextFact(c,"event:event:relevantHistory",{kind});const r=await inspect(c);expect(r.pageCount).toBe(9);expect(r.pages).toEqual([]);expect(r.fields["topmostSubform[0].Page3[0].Sec6Data[0].OtherHistory[0]"]??"").toBe("");expect(c.event.facts.relevantHistory.supersededValues.some(v=>v.value.kind==="known"&&v.value.value===wording)).toBe(true);
});
