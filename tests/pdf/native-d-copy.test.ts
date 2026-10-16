import {it,expect} from "vitest";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";import {join} from "node:path";import {execFile} from "node:child_process";import {promisify} from "node:util";
import {nativeDCopyCase,nativeDContext} from "../fixtures/native-d-copy";
import {setContextFact} from "../fixtures/reviewed-context";
import {getJourneySnapshot} from "../../src/server/journey/service";
import {InMemoryCaseRepository} from "../../src/server/case/repository";
import {projectForm3500} from "../../src/domain/case/projection";
import {fillForm3500Projection} from "../../src/server/pdf/form-3500";
it("third suspect is printed on a complete additional native FDA form, only D filled, with identity-linked context",async()=>{
 const c=nativeDCopyCase(),before=structuredClone(c),p=projectForm3500(c),r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p);
 expect(r.readback.sections.D.suspectProducts.map(p=>p.productId)).toEqual(p.sections.D.suspectProducts.map(p=>p.productId));
 const dir=await mkdtemp(join(tmpdir(),"wilson208-")),file=join(dir,"third.pdf");await writeFile(file,r.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["-c","from pypdf import PdfReader; import json,sys; r=PdfReader(sys.argv[1]); print(json.dumps({'count':len(r.pages),'texts':[p.extract_text() for p in r.pages]}))",file]);const data=JSON.parse(stdout);
 expect(data.count).toBe(16);expect(r.readback.pageCount).toBe(data.count);expect(data.texts[11]).toContain("Synthetic product C");expect(data.texts[11]).toContain("Suspect product #3");expect(data.texts[11]).toContain("Section D only");expect(data.texts[11]).toContain("context is in the main report B5");expect(data.texts[11]).toContain("D. SUSPECT PRODUCTS");
 for(const value of ["Fictional Third Maker","THIRD-LOT-208","00000-0208-03","25","10","31-JAN-2027","12-AUG-2026","Fictional Seller Alpha"])expect(data.texts[11]).toContain(value);
 const independent=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",file,"--named"])).stdout);
 expect(independent.namedFields["topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]"]).toContain(`Suspect product #3 D5 Other product types context: ${nativeDContext}`);
 expect(data.texts[3]).toContain("additional Section D form copy 1");
 for(const i of[8,9,10,12,13,14,15])for(const value of["Synthetic product A","Synthetic product B","Synthetic product C","THIRD-LOT-208","Fictional Third Maker"])expect(data.texts[i]).not.toContain(value);
 expect(c).toEqual(before);console.log('native D copy evidence',file);
});

it("third-product representation errors stay linked to that entity; native geometry and glyph gates do not disappear on overflow",async()=>{
 for(const [field,value,code] of [["purchaseSellerCountry","UK","unsupported-purchase-detail"],["purchaseSellerAddress","β fictional address","unsupported-purchase-detail"],["route","x".repeat(500),"unsupported-product-route"]]as const){const c=setContextFact(nativeDCopyCase(),`product:product-lisinopril:${field}`,{kind:"known",value}),s=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id);expect(s.downloadReady).toBe(false);expect(s.outputIssues).toContainEqual(expect.objectContaining({code,targets:[`product:product-lisinopril:${field}`]}));}
});
it("fourth projected suspect is rejected instead of silently losing or pooling native copies",async()=>{const p=projectForm3500(nativeDCopyCase());p.sections.D.suspectProducts.push({...p.sections.D.suspectProducts[2],productId:"fourth"});await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p)).rejects.toThrow("at most 3");});

it("long third-product context has one report identity across main narrative continuation and the additional native copy",async()=>{
 const context=Array.from({length:100},(_,i)=>`Fictional third-product qualifier ${i+1}: wording supplied, account uncertain.`).join("\n"),c=setContextFact(nativeDCopyCase(),"product:product-lisinopril:otherProductTypes",{kind:"known",value:["other"],qualifier:context}),p=projectForm3500(c),r=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),p),file=join(await mkdtemp(join(tmpdir(),"wilson208-long-")),"long.pdf");await writeFile(file,r.output);
 const x=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",file,"--named","--page-text"])).stdout);expect(x.pageCount).toBeGreaterThan(16);expect(r.readback.pageCount).toBe(x.pageCount);expect(x.pageTexts[x.pageCount-5]).toContain("Synthetic product C");expect(x.pageTexts.join("\n")).toContain("Fictional third-product qualifier 100:");const references=x.pageTexts.join("\n").match(/W-[0-9a-f]{20}/g);expect(new Set(references).size).toBe(1);expect(x.namedFields["topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]"]).toContain(references[0]);
 for(const text of x.pageTexts.slice(-8))expect(text).not.toContain("Fictional third-product qualifier");
});
