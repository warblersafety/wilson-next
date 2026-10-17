import { isPatientAge, isStatedAge, patientAgeParts, patientAgeText, type PatientAge } from "../../domain/case/age";
import { appearanceTextGlyphLimitation, nativeSingleLineTextLimitation } from "./product-text";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import type { Form3500Projection } from "../../domain/case/projection";
import { continuationGeometry, form3500ReportReference, narrativeGlyphLimitation, wrapContinuationText } from "./narrative-continuation";
export const nativeAgeGeometry = { width: 27.621, fontSize: 8.5 } as const;
export function ageNeedsSupplement(age: PatientAge): boolean {
  return isStatedAge(age) || Boolean(nativeSingleLineTextLimitation(String(patientAgeParts(age).value), nativeAgeGeometry.width, nativeAgeGeometry.fontSize, "age control"));
}
export function patientAgeLimitation(age: unknown): string | undefined {
  if (age === undefined) return undefined;
  if (!isPatientAge(age)) return "does not have a supported whole value and unit or exact supplied wording";
  return appearanceTextGlyphLimitation(patientAgeText(age));
}
export function ageSupplementText(projection: Form3500Projection): string | undefined {
  const { ageYears, ageContext } = projection.sections.A;
  if (ageYears === undefined || (!ageNeedsSupplement(ageYears) && ageContext === undefined)) return;
  return `Exact supplied chronological age at event onset:\n${patientAgeText(ageYears)}${ageContext !== undefined ? `\nAge uncertainty or context:\n${ageContext}` : ""}`;
}
export async function ageTextLimitation(projection: Form3500Projection) {
  return narrativeGlyphLimitation(projection.sections.A.ageYears !== undefined ? projection.sections.A.ageContext : undefined, "A2");
}
/** Selected age only: no DOB arithmetic, unit conversion or basis inferred. */
export async function appendAgeContinuations(document: PDFDocument, projection: Form3500Projection, referenceProjection = projection) {
  const text = ageSupplementText(projection); if (text === undefined) return;
  const limit = await narrativeGlyphLimitation(text,"A2"); if(limit)throw new Error(`The reviewed patient age ${limit}`);
  const font = await document.embedFont(StandardFonts.Helvetica), reference = form3500ReportReference(referenceProjection);
  // Below B, separate from the existing A3 reference at y185.
  document.getPages()[0].drawText(`Section A, block A2 age supplement - report reference: ${reference}`, {x:42,y:169,size:8.5,font});
  const lines=wrapContinuationText(text,font),count=Math.floor((continuationGeometry.bodyTop-continuationGeometry.bodyBottom)/continuationGeometry.lineHeight)+1,total=Math.ceil(lines.length/count);
  for(let start=0,n=1;start<lines.length;start+=count,n++) {
    const page=document.addPage([612,792]);page.drawText("Form FDA 3500 (09/2025) - Section A, block A2 continuation",{x:42,y:750,size:12,font});
    page.drawText("A2 patient age at event onset - exact supplied wording",{x:42,y:730,size:10,font});page.drawText(`Report reference: ${reference}`,{x:42,y:714,size:8.5,font});
    lines.slice(start,start+count).forEach((line,i)=>{if(line.text)page.drawText(line.text,{x:42,y:continuationGeometry.bodyTop-i*continuationGeometry.lineHeight,size:10,font});});
    page.drawText(`Section A, block A2 age supplement page ${n} of ${total}`,{x:42,y:32,size:9,font});
  }
}
