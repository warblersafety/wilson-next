import { expect, it } from "vitest";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "@cantoo/pdf-lib";
import { NextRequest } from "next/server";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { isCompleteBirthDate } from "../../src/domain/case/birth-date";
import { projectForm3500 } from "../../src/domain/case/projection";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { productCapacityCase } from "../fixtures/product-capacity";
import { setContextFact } from "../fixtures/reviewed-context";
const prefix="topmostSubform[0].Page1[0].SecA_Patient[0].", dobKey=prefix+"DateBirth[0]";
const ageKeys=["Value","Years","Months","Weeks","Days"].map(v=>prefix+`Age${v}[0]`);
function fixture(date="2024-02-29"){return setContextFact(setContextFact(productCapacityCase(),"patient:patient:ageYears",{kind:"unknown"}),"patient:patient:dateOfBirth",{kind:"known",value:date});}
async function inspect(c:ReturnType<typeof fixture>, name?:string){
 const before=structuredClone(c),projection=projectForm3500(c),result=await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")),projection);
 expect(result.readback.sections).toEqual(projection.sections);expect(c).toEqual(before);
 const path=join(await mkdtemp(join(tmpdir(),"wilson172-")),"dob.pdf");await writeFile(path,result.output);
 const {stdout}=await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",path,"--named"]);
 if(name&&process.env.WILSON_DOB_EVIDENCE){await writeFile(join(process.env.WILSON_DOB_EVIDENCE,name+".pdf"),result.output);await writeFile(join(process.env.WILSON_DOB_EVIDENCE,name+"-readback.json"),stdout);}
 return {projection,fields:JSON.parse(stdout).namedFields as Record<string,string>};
}
it.each(["2024-02-29","2000-02-29","0001-01-01","9999-12-31"])("prints exact supplied complete DOB %s with all age controls clear and unrelated controls unchanged",async value=>{
 const c=fixture(value),r=await inspect(c,value==="2024-02-29"?"birth-date-leap":undefined),baseline=(await inspect(productCapacityCase())).fields;
 const [y,m,d]=value.split("-"),month=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][Number(m)-1];
 expect(r.fields[dobKey]).toBe(`${d}-${month}-${y}`);expect(r.projection.sections.A.dateOfBirth).toBe(value);expect(r.projection.sections.A.ageYears).toBeUndefined();
 for(const key of ageKeys)expect([undefined,"","/Off"]).toContain(r.fields[key]);
 const withoutA2=(map:Record<string,string>)=>Object.fromEntries(Object.entries(map).filter(([k])=>k!==dobKey&&!ageKeys.includes(k)));
 expect(withoutA2(r.fields)).toEqual(withoutA2(baseline));expect(r.projection.sourceTrace["sections.A.dateOfBirth"]).toEqual(c.patient.facts.dateOfBirth.resolvedValue!.sourceIds);
});
it.each(["2023-02-29","1900-02-29","2024-04-31","0000-01-01","2024-00-12","2024-13-01","2024-01-00","2024-02","2024","29-Feb-2024","2024-2-29"," 2024-02-29"])("rejects impossible/partial/malformed DOB %s without coercion",value=>{
 expect(isCompleteBirthDate(value)).toBe(false);const c=productCapacityCase(),before=structuredClone(c);
 expect(()=>setContextFact(c,"patient:patient:dateOfBirth",{kind:"known",value})).toThrow("complete valid ISO calendar date");expect(c).toEqual(before);
 const malformed=structuredClone(fixture());malformed.patient.facts.dateOfBirth.resolvedValue!.value={kind:"known",value};expect(()=>parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:malformed,unrepresented:[]})).toThrow();
});
it("requires explicit choice for both known values, preserves both facts and blocks API/adapter output until selection",async()=>{
 const c=setContextFact(fixture(),"patient:patient:ageYears",{kind:"known",value:{value:6,unit:"weeks"}}),before=structuredClone(c);
 const snapshot=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id);expect(snapshot.downloadReady).toBe(false);expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({code:"patient-a2-choice-required"}));
 await expect(inspect(c)).rejects.toThrow("explicit age or date-of-birth print choice");
 for(const mode of ["preview","download"]){const r=await pdfPost(new NextRequest("http://wilson.test/api/case/pdf",{method:"POST",headers:{host:"wilson.test",origin:"http://wilson.test","content-type":"application/json"},body:JSON.stringify({mode,state:{version:browserStateVersion,stage:"output",case:c,unrepresented:[]}})}));expect(r.status).toBe(409);}
 let current=c;
 for(const choice of ["date-of-birth","age","date-of-birth"] as const){current=setContextFact(current,"patient:patient:a2Value",{kind:"known",value:choice});const r=await inspect(current,choice==="age"?"birth-date-age-selected":undefined);expect(current.patient.facts.ageYears).toEqual(before.patient.facts.ageYears);expect(current.patient.facts.dateOfBirth).toEqual(before.patient.facts.dateOfBirth);
  expect(r.fields[dobKey]??"").toBe(choice==="date-of-birth"?"29-FEB-2024":"");expect(r.fields[ageKeys[0]]??"").toBe(choice==="age"?"6":"");
  expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:`patient:patient:${choice==="age"?"dateOfBirth":"ageYears"}`,reason:"a2-alternative-not-selected"}));
 }
 expect(c).toEqual(before);
});
it.each(["unknown","declined","explicitly-absent","inapplicable"] as const)("keeps chosen but unavailable DOB %s blocked rather than silently using retained age",async kind=>{
 let c=setContextFact(fixture(),"patient:patient:ageYears",{kind:"known",value:57});c=setContextFact(c,"patient:patient:a2Value",{kind:"known",value:"date-of-birth"});c=setContextFact(c,"patient:patient:dateOfBirth",{kind});
 const s=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id);expect(s.downloadReady).toBe(false);expect(s.outputIssues).toContainEqual(expect.objectContaining({code:"patient-a2-choice-required"}));expect(s.projection.sections.A.ageYears).toBeUndefined();expect(s.projection.sections.A.dateOfBirth).toBeUndefined();
 c=setContextFact(c,"patient:patient:a2Value",{kind:"known",value:"age"});expect((await inspect(c)).fields[ageKeys[0]]).toBe("57");
});
it("retains DOB correction history and qualifier while distinguishing unselected-base omission",async()=>{
 let c=fixture();c=setContextFact(c,"patient:patient:dateOfBirth",{kind:"known",value:"2023-02-28",qualifier:"caregiver estimate"});
 expect((await inspect(c)).fields[dobKey]).toBe("28-FEB-2023");c=setContextFact(c,"patient:patient:ageYears",{kind:"known",value:57});c=setContextFact(c,"patient:patient:a2Value",{kind:"known",value:"age"});
 const r=await inspect(c);expect(r.projection.omissions).toContainEqual(expect.objectContaining({target:"patient:patient:dateOfBirth",reason:"qualifier-not-included",qualifier:"caregiver estimate",baseValueIncluded:false}));
 const restored=parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}).case;expect(restored).toEqual(c);expect(restored.patient.facts.dateOfBirth.supersededValues.some(v=>v.value.kind==="known"&&v.value.value==="2024-02-29")).toBe(true);
 const doc=await PDFDocument.load(await readFile("assets/fda/form-fda-3500-09-2025.pdf"),{password:""});expect(doc.getForm().getTextField(dobKey).acroField.getWidgets()[0].getRectangle().width).toBeCloseTo(127.02,3);
});
