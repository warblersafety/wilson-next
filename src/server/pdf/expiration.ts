import {PDFDocument,StandardFonts} from '@cantoo/pdf-lib';
import type {Form3500Projection} from '../../domain/case/projection';
import {continuationGeometry,form3500ReportReference,narrativeGlyphLimitation,wrapContinuationText} from './narrative-continuation';
export async function expirationTextIssues(projection:Form3500Projection){
 const issues=[];for(const note of projection.expirationNotes??[]){const limitation=await narrativeGlyphLimitation(note.text,note.block);if(limitation)issues.push({productId:note.productId,limitation});}return issues;
}
export async function appendExpirationContinuations(document:PDFDocument,projection:Form3500Projection,referenceProjection=projection){
 const notes=(projection.expirationNotes??[]).filter(n=>(n.block==='D6'?projection.sections.D.suspectProducts:n.block==='E4'?projection.sections.E.suspectDevices:projection.sections.F.concomitantProducts).some(p=>p.productId===n.productId));if(!notes.length)return;
 const font=await document.embedFont(StandardFonts.Helvetica),reference=form3500ReportReference(referenceProjection),form=document.getForm();
 for(const note of notes){
  const heading=`${note.block} ${note.block==='F1'?'row':note.block==='E4'?'device':'product'} ${note.ordinal} - expiration wording`;
  if(note.block==='D6'){const index=projection.sections.D.suspectProducts.findIndex(p=>p.productId===note.productId)+1;form.getTextField(`topmostSubform[0].Page${index+3}[0].Prod${index}[0].Prod${index}ExpDate[0]`).setText('D6 continued');}
  if(note.block==='E4')form.getTextField('topmostSubform[0].Page6[0].SecE_Device[0].ExpDate[0]').setText('E4 continued');
  if(note.block==='F1' && notes.find(n=>n.block==='F1')===note)document.getPages()[5].drawText(`F1 expiration wording continued (rows ${notes.filter(n=>n.block==='F1').map(n=>n.ordinal).join(', ')}) - ${reference}`,{x:44,y:119,size:8,font});
  const limitation=await narrativeGlyphLimitation(note.text,note.block);if(limitation)throw new Error(`Unsupported expiration wording: ${limitation}`);
  const lines=wrapContinuationText(note.text,font),count=Math.floor((continuationGeometry.bodyTop-continuationGeometry.bodyBottom)/continuationGeometry.lineHeight)+1,total=Math.ceil(lines.length/count);
  for(let start=0,n=1;start<lines.length;start+=count,n++){
   const page=document.addPage([612,792]);page.drawText(`Form FDA 3500 (09/2025) - ${note.block} continuation`,{x:42,y:750,size:12,font});page.drawText(heading,{x:42,y:730,size:10,font});page.drawText(`Report reference: ${reference}`,{x:42,y:714,size:8.5,font});lines.slice(start,start+count).forEach((l,i)=>{if(l.text)page.drawText(l.text,{x:42,y:continuationGeometry.bodyTop-i*continuationGeometry.lineHeight,size:10,font});});page.drawText(`${heading} - page ${n} of ${total}`,{x:42,y:32,size:9,font});
  }
 }
}
