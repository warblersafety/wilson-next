import {PDFDocument, StandardFonts} from "@cantoo/pdf-lib";
import type {Form3500Projection} from "../../domain/case/projection";
import {maximumForm3500ConcomitantProducts} from "../../domain/case/limits";
import {nativeSingleLineTextLimitation} from "./product-text";
import {continuationGeometry, form3500ReportReference, narrativeGlyphLimitation, wrapContinuationText} from "./narrative-continuation";

/** Pinned09/2025 native F controls: all ten rows share this width/font. */
export const concomitantNameGeometry={width:198.766,fontSize:8.5};
export function concomitantFieldLabel(field:"name"|"startDate"|"stopDate") {
  return field==="name"?"Name":field==="startDate"?"Therapy start date":"Therapy end date";
}
export function concomitantRowFields(index:number) {
  if(!Number.isInteger(index)||index<0||index>=maximumForm3500ConcomitantProducts)throw new Error("Invalid native Section F row");
  const n=index+1,prefix=`topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row${n}[0].`;
  return {name:prefix+`Prod${n}[0]`,startDate:prefix+`Start${n}[0]`,stopDate:prefix+(n<=2?`End${n}[0]`:"Cell4[0]")};
}
export function concomitantNativeName(name:string|undefined,index:number) {
  return name!==undefined && nativeSingleLineTextLimitation(name,concomitantNameGeometry.width,concomitantNameGeometry.fontSize,"Section F name control") ? `See F row ${index+1} supplement` : name;
}
export function concomitantSupplementEntries(projection:Form3500Projection) {
  return projection.sections.F.concomitantProducts.flatMap((product,index)=>[
    ...(product.name!==undefined&&concomitantNativeName(product.name,index)!==product.name?[{index,field:"name" as const,heading:`F row ${index+1} - Name`,text:`F row ${index+1} Name: ${product.name}`}]:[]),
    ...(product.fieldContext??[]).map(context=>({index,field:context.field,heading:`F row ${index+1} - ${concomitantFieldLabel(context.field)} context`,text:`F row ${index+1} ${concomitantFieldLabel(context.field)} context: ${context.text}`})),
  ]);
}
export async function concomitantTextIssues(projection:Form3500Projection) {
  const issues:{productId:string;field:"name"|"startDate"|"stopDate";limitation:string}[]=[];
  for(const product of projection.sections.F.concomitantProducts) {
    for(const value of [...(product.name!==undefined?[{field:"name" as const,text:product.name}]:[]),...(product.fieldContext??[])]) {
      const limitation=await narrativeGlyphLimitation(value.text,"Section F");
      if(limitation)issues.push({productId:product.productId,field:value.field,limitation});
    }
  }
  return issues;
}
/** Fixed-size exact text with native row references; never changes semantic facts. */
export async function appendConcomitantContinuations(document:PDFDocument,projection:Form3500Projection,referenceProjection=projection) {
  const entries=concomitantSupplementEntries(projection);if(!entries.length)return;
  const reference=form3500ReportReference(referenceProjection),font=await document.embedFont(StandardFonts.Helvetica);
  document.getPages()[5].drawText(`Report ${reference} - Section F row supplements follow.`,{x:44,y:750,size:8,font});
  const lines=entries.flatMap(entry=>wrapContinuationText(entry.text,font).map(line=>({line,heading:entry.heading})));
  const count=Math.floor((continuationGeometry.bodyTop-continuationGeometry.bodyBottom)/continuationGeometry.lineHeight)+1,total=Math.ceil(lines.length/count);
  for(let start=0,number=1;start<lines.length;start+=count,number++) {
    const page=document.addPage([612,792]);
    page.drawText("Form FDA 3500 (09/2025) - Section F continuation",{x:42,y:750,size:12,font});
    page.drawText(`Starts with ${lines[start].heading}`,{x:42,y:730,size:10,font});
    page.drawText(`Report reference: ${reference}`,{x:42,y:714,size:8.5,font});
    lines.slice(start,start+count).forEach(({line},i)=>{if(line.text)page.drawText(line.text,{x:42,y:continuationGeometry.bodyTop-i*continuationGeometry.lineHeight,size:10,font});});
    page.drawText(`Section F supplement page ${number} of ${total}`,{x:42,y:32,size:10,font});
  }
}
