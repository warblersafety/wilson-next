import {isStatedDuration,isTreatmentDuration,durationText,type TreatmentDuration} from "../../domain/case/duration";
import {appearanceTextGlyphLimitation,nativeSingleLineTextLimitation} from "./product-text";
import type{Form3500Projection}from"../../domain/case/projection";
import{PDFDocument,StandardFonts}from"@cantoo/pdf-lib";
import{continuationGeometry,form3500ReportReference,narrativeGlyphLimitation,wrapContinuationText}from"./narrative-continuation";
export function durationNeedsSupplement(value:TreatmentDuration):boolean{return isStatedDuration(value)||Boolean(nativeSingleLineTextLimitation(value.value,61.455,8.5,"D3 duration amount control"));}
export function durationLimitation(value:TreatmentDuration|undefined):string|undefined{return value===undefined?undefined:!isTreatmentDuration(value)?"has invalid duration wording or amount/unit":appearanceTextGlyphLimitation(durationText(value));}
export async function durationContextIssues(projection:Form3500Projection){const issues=[];for(const p of projection.sections.D.suspectProducts){const limitation=await narrativeGlyphLimitation(p.durationContext,"D3");if(limitation)issues.push({productId:p.productId,limitation});}return issues;}
/** Selected D3 duration only; no relationship to dates or ongoing status inferred. */
export async function appendDurationContinuations(document:PDFDocument,projection:Form3500Projection,referenceProjection=projection){
 const entries=projection.sections.D.suspectProducts.filter(p=>p.treatmentDuration&&(durationNeedsSupplement(p.treatmentDuration)||p.durationContext!==undefined));if(!entries.length)return;
 const font=await document.embedFont(StandardFonts.Helvetica),reference=form3500ReportReference(referenceProjection);
 for(const p of entries){const ordinal=referenceProjection.sections.D.suspectProducts.findIndex(x=>x.productId===p.productId)+1;if(ordinal===0)throw new Error("D3 duration missing product identity");
  const text=`Exact supplied treatment duration:\n${durationText(p.treatmentDuration!)}${p.durationContext!==undefined?`\nDuration uncertainty or context:\n${p.durationContext}`:""}`,limit=await narrativeGlyphLimitation(text,"D3");if(limit)throw new Error(`The reviewed D3 duration ${limit}`);
  const heading=`D3 suspect product #${ordinal} - treatment duration`;
  const lines=wrapContinuationText(text,font),count=Math.floor((continuationGeometry.bodyTop-continuationGeometry.bodyBottom)/continuationGeometry.lineHeight)+1,total=Math.ceil(lines.length/count);
  for(let start=0,n=1;start<lines.length;start+=count,n++){const page=document.addPage([612,792]);page.drawText("Form FDA 3500 (09/2025) - D3 continuation",{x:42,y:750,size:12,font});page.drawText(heading,{x:42,y:730,size:10,font});page.drawText(`Report reference: ${reference}`,{x:42,y:714,size:8.5,font});lines.slice(start,start+count).forEach((line,i)=>{if(line.text)page.drawText(line.text,{x:42,y:continuationGeometry.bodyTop-i*continuationGeometry.lineHeight,size:10,font});});page.drawText(`${heading} - page ${n} of ${total}`,{x:42,y:32,size:9,font});}
 }
}
