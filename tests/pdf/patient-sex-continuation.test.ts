import { expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { createSemanticCase } from "../../src/domain/case/create";
import { projectForm3500 } from "../../src/domain/case/projection";
import { parseBrowserJourneyState, browserStateVersion } from "../../src/server/case/browser-state";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { productCapacityCase } from "../fixtures/product-capacity";
import { setContextFact } from "../fixtures/reviewed-context";
import { nativeECase } from "../fixtures/native-e-copies";
const prefix="topmostSubform[0].Page1[0].SecA_Patient[0].";
async function inspect(c=productCapacityCase()) {
 const before=structuredClone(c),projection=projectForm3500(c);
 const result=await fillForm3500Projection(new Uint8Array(await readFile('assets/fda/form-fda-3500-09-2025.pdf')),projection);
 const file=join(await mkdtemp(join(tmpdir(),'wilson151-')),'sex.pdf');await writeFile(file,result.output);
 const x=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??'python3',['tools/pdf/independent_readback.py',file,'--named','--page-text'])).stdout);
 expect(c).toEqual(before);return {projection,result,x};
}
it('reviewed intersex and exact qualifier export with both native boxes off and no source/history mutation',async()=>{
 const c=setContextFact(productCapacityCase(),'patient:patient:sex',{kind:'known',value:'intersex',qualifier:'Explicit supplied account; not independently confirmed'}),{projection,result,x}=await inspect(c);
 expect(x.pageCount).toBe(9);for(const f of ['SexM','SexF'])expect(x.namedFields[prefix+f+'[0]']).toBe('/Off');expect(result.readback.sections.A.sex).toBeUndefined();
 expect(x.pageTexts[0]).toContain('A3 continued');expect(x.pageTexts[8]).toContain('A3 Sex (reviewed value): intersex');expect(x.pageTexts[8]).toContain('A3 Sex context: Explicit supplied account; not independently confirmed');expect(x.pageTexts[8]).toContain('without inferring sex at birth');expect(new Set(x.pageTexts.join('\n').match(/W-[0-9a-f]{20}/g)).size).toBe(1);
 expect(projection.omissions.filter(o=>o.target==='patient:patient:sex')).toEqual([]);expect(projection.sourceTrace['sections.A.sex']).toEqual(c.patient.facts.sex.resolvedValue?.sourceIds);expect((await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id)).downloadReady).toBe(true);
 const state={version:browserStateVersion,stage:'output'as const,case:c,unrepresented:[]};expect(parseBrowserJourneyState(structuredClone(state))).toEqual(state);
});
it.each(['female','male']as const)('known %s keeps its sole native selection and carries current qualifier in A3',async value=>{
 const c=setContextFact(productCapacityCase(),'patient:patient:sex',{kind:'known',value,qualifier:'Stated by clinician; verification pending'}),{x}=await inspect(c);expect(x.pageCount).toBe(9);expect(x.namedFields[prefix+(value==='female'?'SexF':'SexM')+'[0]']).toBe('/1');expect(x.namedFields[prefix+(value==='female'?'SexM':'SexF')+'[0]']).toBe('/Off');expect(x.pageTexts[8]).toContain(`A3 Sex (reviewed value): ${value}`);expect(x.pageTexts[8]).toContain('Stated by clinician; verification pending');expect(x.pageTexts[8]).not.toContain('boxes are unselected');
});
it.each(['unknown','declined','inapplicable','explicitly-absent']as const)('current %s removes former sex/qualifier and supplement without inventing a checkbox',async kind=>{
 let c=setContextFact(productCapacityCase(),'patient:patient:sex',{kind:'known',value:'intersex',qualifier:'UNIQUE-FORMER-SEX-CONTEXT'});expect((await inspect(c)).x.pageTexts[8]).toContain('UNIQUE-FORMER-SEX-CONTEXT');c=setContextFact(c,'patient:patient:sex',{kind});const{x,projection}=await inspect(c);expect(x.pageCount).toBe(8);for(const f of ['SexM','SexF'])expect(x.namedFields[prefix+f+'[0]']).toBe('/Off');expect(x.pageTexts.join('\n')).not.toContain('UNIQUE-FORMER-SEX-CONTEXT');expect(x.pageTexts.join('\n')).not.toContain('A3 continued');expect(projection.omissions).toContainEqual(expect.objectContaining({target:'patient:patient:sex',reason:kind}));expect(c.patient.facts.sex.supersededValues.some(v=>v.value.kind==='known'&&v.value.value==='intersex')).toBe(true);
});
it('unanswered stays empty rather than becoming unknown or inferred from other attributes',async()=>{
 const c=createSemanticCase('unanswered-sex'),{projection,x}=await inspect(c);expect(projection.sections.A.sex).toBeUndefined();expect(projection.omissions).toContainEqual(expect.objectContaining({target:'patient:patient:sex',reason:'empty'}));expect(x.pageCount).toBe(8);expect(x.pageTexts.join('\n')).not.toContain('A3 continued');
});
it('dense A3 context reflows at fixed readable size with field and report identity on every page',async()=>{
 const lines=Array.from({length:110},(_,i)=>`Fictional A3 context line ${i+1}: supplied wording.`),c=setContextFact(productCapacityCase(),'patient:patient:sex',{kind:'known',value:'intersex',qualifier:lines.join('\n')}),{x}=await inspect(c);expect(x.pageCount).toBeGreaterThan(10);const text=x.pageTexts.slice(8).join('\n');for(const line of lines)expect(text).toContain(line);for(const page of x.pageTexts.slice(8)){expect(page).toContain('Section A, block A3 continuation');expect(page).toContain('A3 Sex (reviewed value): intersex');expect(page).toContain('Report reference: W-');}
});
it('unsupported A3 context remains accepted and blocks with the precise sex target',async()=>{
 const c=setContextFact(productCapacityCase(),'patient:patient:sex',{kind:'known',value:'intersex',qualifier:'Supplied β context'}),before=structuredClone(c),s=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id);expect(s.downloadReady).toBe(false);expect(s.outputIssues).toContainEqual(expect.objectContaining({code:'unsupported-patient-sex',targets:['patient:patient:sex']}));await expect(inspect(c)).rejects.toThrow('patient sex context');expect(c).toEqual(before);
});
it('A3 stays on main report when extra native E copies are attached',async()=>{
 const c=setContextFact(nativeECase(2),'patient:patient:sex',{kind:'known',value:'intersex',qualifier:'MAIN-A3-CONTEXT'}),{x}=await inspect(c);expect(x.pageCount).toBe(17);expect(x.pageTexts[8]).toContain('MAIN-A3-CONTEXT');expect(x.pageTexts.slice(9).join('\n')).not.toContain('MAIN-A3-CONTEXT');expect(x.pageTexts[14]).toContain('Fictional device Beta');expect(x.pageTexts[9]).not.toContain('A3 continued');expect(new Set(x.pageTexts.join('\n').match(/W-[0-9a-f]{20}/g)).size).toBe(1);
});
it('pinned A3 marker and widest opaque reference fit the unused native space at no less than eight points',async()=>{
 const font=await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);expect(98+font.widthOfTextAtSize('W-'+ '8'.repeat(20),8)).toBeLessThan(201);expect(105+font.widthOfTextAtSize('A3 continued',8.5)).toBeLessThan(201);
 const script="from pypdf import PdfReader; import json; r=PdfReader('assets/fda/form-fda-3500-09-2025.pdf'); print(json.dumps({str(a.get_object().get('/T')):list(a.get_object().get('/Rect')) for a in r.pages[0]['/Annots'] if 'Sex' in str(a.get_object().get('/T'))}))",meta=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??'python3',['-c',script])).stdout);expect(meta['SexM[0]']).toEqual([51.942,514.702,62.612,525.372]);expect(meta['SexF[0]']).toEqual([51.942,500.274,62.612,510.944]);
});
