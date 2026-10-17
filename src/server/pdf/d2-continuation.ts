import {quantityNeedsSupplement} from "./quantity";
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
export function d2SupplementEntries(projection:Form3500Projection) {
  return projection.sections.D.suspectProducts.flatMap(product => [
    ...(["route","frequency"] as const).flatMap(field => {
      const value=product[field], context=product.d2Context?.find(c=>c.field===field)?.text;
      return value!==undefined && (needsD2Supplement(field,value)||context!==undefined)
        ? [{productId:product.productId,field,text:`Exact supplied ${field}:\n${value}${context!==undefined?`\n${field} uncertainty or context:\n${context}`:""}`}] : [];
    }),
    ...(["dose","strength"] as const).flatMap(field => {
      const quantity=product[field];
      return quantity && quantityNeedsSupplement(quantity,field)
        ? [{productId:product.productId,field,text:`Exact supplied ${field}:\n${quantity.value}`}] : [];
    }),
  ]);
}
/** Exact accepted wording; each continuation page repeats current product/field identity. */
export async function appendD2Continuations(document:PDFDocument,projection:Form3500Projection,referenceProjection=projection) {
  const entries=d2SupplementEntries(projection); if(!entries.length)return;
  const font=await document.embedFont(StandardFonts.Helvetica),reference=form3500ReportReference(referenceProjection);
  for(const [slot,product]of projection.sections.D.suspectProducts.entries()) {
    if(entries.some(entry=>entry.productId===product.productId)) {
      const ordinal=referenceProjection.sections.D.suspectProducts.findIndex(p=>p.productId===product.productId)+1;
      const blocks=[...new Set(entries.filter(e=>e.productId===product.productId).map(e=>e.field==="strength"?"D1":"D2"))].sort().join("/");
      document.getPages()[slot+3].drawText(`Report ${reference} - ${blocks} product #${ordinal} supplements follow.`,{x:44,y:750,size:8,font});
    }
  }
  for(const {productId,field,text} of entries) {
    const ordinal=referenceProjection.sections.D.suspectProducts.findIndex(p=>p.productId===productId)+1;
    if(ordinal===0)throw new Error("D2 supplement product is missing from report identity");
    const block=field === "strength" ? "D1" : "D2";
    const heading=`${block} suspect product #${ordinal} - ${field}`;
    const limitation=await narrativeGlyphLimitation(text,"D2");if(limitation)throw new Error(`The reviewed D2 ${field} ${limitation}`);
    const lines=wrapContinuationText(text,font),count=Math.floor((continuationGeometry.bodyTop-continuationGeometry.bodyBottom)/continuationGeometry.lineHeight)+1,total=Math.ceil(lines.length/count);
    for(let start=0,n=1;start<lines.length;start+=count,n++) {
      const page=document.addPage([612,792]);page.drawText(`Form FDA 3500 (09/2025) - ${block} continuation`,{x:42,y:750,size:12,font});
      page.drawText(heading,{x:42,y:730,size:10,font});page.drawText(`Report reference: ${reference}`,{x:42,y:714,size:8.5,font});
      lines.slice(start,start+count).forEach((line,i)=>{if(line.text)page.drawText(line.text,{x:42,y:continuationGeometry.bodyTop-i*continuationGeometry.lineHeight,size:10,font});});
      page.drawText(`${heading} - page ${n} of ${total}`,{x:42,y:32,size:9,font});
    }
  }
}
