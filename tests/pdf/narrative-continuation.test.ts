import { expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectForm3500 } from "../../src/domain/case/projection";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { planNarrativeContinuations, wrapContinuationText, narrativeGlyphLimitation, narrativeBlocks } from "../../src/server/pdf/narrative-continuation";
import { setContextFact } from "../fixtures/reviewed-context";
import { testHistoryContextCase } from "../fixtures/test-history-context";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
const source = () => readFile("assets/fda/form-fda-3500-09-2025.pdf");
const native = { eventDescription: "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]", relevantTestContext: "topmostSubform[0].Page3[0].AdditionalComments[0]", relevantHistory: "topmostSubform[0].Page3[0].Sec6Data[0].OtherHistory[0]" };
const lines = (prefix: string, count: number) => Array.from({length: count}, (_, i) => `${prefix} ${String(i+1).padStart(3,"0")}: fictional detail, wording retained.`).join("\n");
async function inspect(projection: ReturnType<typeof projectForm3500>, stem?: string) {
 const result = await fillForm3500Projection(new Uint8Array(await source()), projection);
 const directory = process.env.WILSON_CONTINUATION_EVIDENCE ?? await mkdtemp(join(tmpdir(),"wilson190-"));
 const path=join(directory,`${stem??"continuation"}.pdf`);await writeFile(path,result.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/continuation_readback.py",path]);
 if(stem&&process.env.WILSON_CONTINUATION_EVIDENCE)await writeFile(join(directory,`${stem}-readback.json`),stdout);
 const parsed=JSON.parse(stdout);parsed.pages=parsed.pages.filter((p:any)=>p.runs.some((r:any)=>r.text.includes("Narrative continuation")));return {result,...parsed} as {result:typeof result;pageCount:number;fields:Record<string,string>;pages:Array<{pdfPage:number;width:number;height:number;runs:Array<{text:string;x:number;y:number;size:number;font:string}>}>};
}
it("wraps exactly without discarding spaces/newlines or splitting Unicode, including empty paragraphs and long tokens",async()=>{
 const font=await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
 for(const text of["  leading  spaces\n\ntrailing  \n", "W".repeat(4100), "é".repeat(2100),lines("context",100)]){
 const wrapped=wrapContinuationText(text,font);expect(wrapped.map(l=>l.text+(l.breakAfter==="newline"?"\n":"")).join("")).toBe(text);
 for(const line of wrapped)expect(font.widthOfTextAtSize(line.text,10)).toBeLessThanOrEqual(528);
 }
});
it("keeps native-fitting narrative unchanged while retaining the separate F medication supplement",async()=>{
 const p=projectForm3500(testHistoryContextCase()),r=await inspect(p);expect(r.pageCount).toBe(9);expect(r.pages).toEqual([]);expect(await planNarrativeContinuations(p)).toEqual([]);for(const field of Object.keys(native)as Array<keyof typeof native>)expect(r.fields[native[field]]).toBe(p.sections.B[field]);
});
it("exports all current B5-B7 content across correctly labelled numbered attachments with native cross-references and unchanged other fields",async()=>{
 const p=projectForm3500(testHistoryContextCase()),before=structuredClone(p),baseline=await inspect(p);
 p.sections.B.eventDescription=lines("B5 account",100);p.sections.B.relevantTestContext=lines("B6 table row 1 - Result context",65);p.sections.B.relevantHistory=lines("B7 history",60);
 const expected=structuredClone(p),plans=await planNarrativeContinuations(p),r=await inspect(p,"all-blocks");expect(p).toEqual(expected);expect(plans.map(p=>p.block)).toEqual(["B5","B6","B7"]);expect(r.pageCount).toBe(9+plans.reduce((n,p)=>n+p.pages.length,0));
 let attachment=0;
 for(const plan of plans){expect(r.fields[native[plan.field]]).toBe(plan.marker);expect(plan.marker.endsWith("continued")).toBe(true);const actual:string[]=[];
 for(const pageLines of plan.pages){const page=r.pages[attachment++];expect(page.width).toBe(612);expect(page.height).toBe(792);expect(page.runs.some(r=>r.text===`Section B, block ${plan.block} - ${plan.label}`)).toBe(true);expect(page.runs.some(r=>r.text===`Report reference: ${plan.reportReference}`)).toBe(true);expect(r.fields[native[plan.field]]).toContain(`Report reference: ${plan.reportReference}`);expect(page.runs.some(run=>run.text===`Attachment page ${attachment} of ${r.pages.length}`)).toBe(true);const body=page.runs.filter(run=>run.y>=56&&run.y<=700);expect(body.map(r=>r.text)).toEqual(pageLines.filter(l=>l.text).map(l=>l.text));for(const run of body){expect(run.size).toBe(10);expect(run.font).toBe("/Helvetica");expect(run.x).toBe(42);}actual.push(...body.map(r=>r.text));}
 // Short explicit fixture lines do not wrap: extraction must preserve each original line exactly.
 expect(actual.join("\n")).toBe(p.sections.B[plan.field]);}
 const ours=new Set(Object.values(native));for(const [name,value]of Object.entries(baseline.fields))if(!ours.has(name))expect(r.fields[name]).toEqual(value);expect(before.sections.D).toEqual(p.sections.D);
});
it.each(["W".repeat(2100),Array(40).fill("line").join("\n")])("previously blocked B6/B7 long context is now ready, survives restore and is fully exported",async qualifier=>{
 let c=testHistoryContextCase();c=setContextFact(c,"test:test-hemoglobin:testResult",{kind:"known",value:"14.2 µg/L",qualifier});c=setContextFact(c,"event:event:relevantHistory",{kind:"known",value:"Fictional history",qualifier});
 const restored=parseBrowserJourneyState(JSON.parse(JSON.stringify({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}))).case;
 const snap=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:restored}),restored.id);expect(snap.outputIssues.filter(i=>["unsupported-test-history","unsupported-event-narrative"].includes(i.code))).toEqual([]);const r=await inspect(snap.projection);expect(r.pageCount).toBeGreaterThan(8);expect(r.fields[native.relevantHistory]).toContain("continued");
 const text=r.pages.flatMap(p=>p.runs.filter(r=>r.y>=56&&r.y<=700).map(r=>r.text)).join("");expect(text).toContain(qualifier.replaceAll("\n",""));expect(restored).toEqual(c);
});
it.each(["W".repeat(4100),Array(90).fill("line").join("\n")])("previously blocked B5 base and quantity/course context now use faithful continuation",async wording=>{
 let c=testHistoryContextCase();c=setContextFact(c,"event:event:treatments",{kind:"known",value:["Fictional treatment"],qualifier:wording});c=setContextFact(c,`product:${c.products[0].id}:strength`,{kind:"known",value:"5 mg",qualifier:wording});
 const snap=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id);expect(snap.outputIssues.some(i=>i.code==="unsupported-event-narrative")).toBe(false);const r=await inspect(snap.projection);expect(r.fields[native.eventDescription]).toContain("continued");expect(r.pages.flatMap(p=>p.runs.filter(r=>r.y>=56&&r.y<=700).map(r=>r.text)).join("")).toContain(wording.replaceAll("\n",""));
});
it("still blocks unsupported glyphs/controls before native or attachment generation without replacement",async()=>{
 for(const text of["β", "≥", "a\tb", "a\rb", "a\u0000b", "a\u200bb"]){expect(await narrativeGlyphLimitation(text,"B5")).toBeTruthy();const p=projectForm3500(testHistoryContextCase());for(const field of Object.keys(narrativeBlocks)as Array<keyof typeof narrativeBlocks>){p.sections.B[field]=text;await expect(planNarrativeContinuations(p)).rejects.toThrow("characters");delete p.sections.B[field];}}
});

it("report references are stable for unchanged output, distinguish cases/content, and do not coerce an unsupported or long A1 identifier into an attachment header",async()=>{
 const p=projectForm3500(testHistoryContextCase());p.sections.B.relevantHistory=lines("history",60);const original=(await planNarrativeContinuations(p))[0];
 p.revision++;expect((await planNarrativeContinuations(p))[0].reportReference).toBe(original.reportReference);p.sections.A.patientIdentifier="β".repeat(200);const changed=(await planNarrativeContinuations(p))[0];expect(changed.reportReference).not.toBe(original.reportReference);expect(changed.marker).not.toContain("β");p.caseId+="-separate";expect((await planNarrativeContinuations(p))[0].reportReference).not.toBe(changed.reportReference);
});
it("wraps a very large paragraph by forward index without loss or expanding per-line work",async()=>{
 const font=await(await PDFDocument.create()).embedFont(StandardFonts.Helvetica),text="W".repeat(200_000),wrapped=wrapContinuationText(text,font);expect(wrapped.map(l=>l.text).join("")).toBe(text);expect(wrapped.length).toBeGreaterThan(1000);
});
