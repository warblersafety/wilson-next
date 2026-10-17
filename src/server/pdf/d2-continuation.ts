import {PDFDocument, StandardFonts} from "@cantoo/pdf-lib";
import type {Form3500Projection} from "../../domain/case/projection";
import {needsD2Supplement} from "./product-text";
import {continuationGeometry, form3500ReportReference, narrativeGlyphLimitation, wrapContinuationText} from "./narrative-continuation";
export function d2NativeText(field:"route"|"frequency",value:string) {
  return needsD2Supplement(field,value)?"D2 supplement":value;
}
export async function d2TextIssues(projection:Form3500Projection) {
  const issues=[];
  for(const product of projection.sections.D.suspectProducts)for(const context of product.d2Context??[]) {
    const limitation=await narrativeGlyphLimitation(context.text,"D2");
    if(limitation)issues.push({productId:product.productId,field:context.field,limitation});
  }
  return issues;
}
/** Exact accepted wording; each continuation page repeats current product/field identity. */
export async function appendD2Continuations(document:PDFDocument,projection:Form3500Projection,referenceProjection=projection) {
  const font=await document.embedFont(StandardFonts.Helvetica),reference=form3500ReportReference(referenceProjection);
  for(const [slot,product]of projection.sections.D.suspectProducts.entries()) {
    if((["route","frequency"] as const).some(field=>product[field]!==undefined&&(needsD2Supplement(field,product[field]!)||product.d2Context?.some(c=>c.field===field)))) {
      const ordinal=referenceProjection.sections.D.suspectProducts.findIndex(p=>p.productId===product.productId)+1;
      document.getPages()[slot+3].drawText(`Report ${reference} - D2 product #${ordinal} supplements follow.`,{x:44,y:750,size:8,font});
    }
  }
  for(const product of projection.sections.D.suspectProducts)for(const field of ["route","frequency"]as const) {
    const value=product[field],context=product.d2Context?.find(c=>c.field===field)?.text;
    if(value===undefined || (!needsD2Supplement(field,value)&&context===undefined))continue;
    const ordinal=referenceProjection.sections.D.suspectProducts.findIndex(p=>p.productId===product.productId)+1;
    if(ordinal===0)throw new Error("D2 supplement product is missing from report identity");
    const heading=`D2 suspect product #${ordinal} - ${field}`;
    const text=`Exact supplied ${field}:\n${value}${context!==undefined?`\n${field} uncertainty or context:\n${context}`:""}`;
    const limitation=await narrativeGlyphLimitation(text,"D2");if(limitation)throw new Error(`The reviewed D2 ${field} ${limitation}`);
    const lines=wrapContinuationText(text,font),count=Math.floor((continuationGeometry.bodyTop-continuationGeometry.bodyBottom)/continuationGeometry.lineHeight)+1,total=Math.ceil(lines.length/count);
    for(let start=0,n=1;start<lines.length;start+=count,n++) {
      const page=document.addPage([612,792]);page.drawText("Form FDA 3500 (09/2025) - D2 continuation",{x:42,y:750,size:12,font});
      page.drawText(heading,{x:42,y:730,size:10,font});page.drawText(`Report reference: ${reference}`,{x:42,y:714,size:8.5,font});
      lines.slice(start,start+count).forEach((line,i)=>{if(line.text)page.drawText(line.text,{x:42,y:continuationGeometry.bodyTop-i*continuationGeometry.lineHeight,size:10,font});});
      page.drawText(`${heading} - page ${n} of ${total}`,{x:42,y:32,size:9,font});
    }
  }
}
