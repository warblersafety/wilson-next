import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import type { Form3500Projection } from "../../domain/case/projection";
import { continuationGeometry, form3500ReportReference, narrativeGlyphLimitation, wrapContinuationText } from "./narrative-continuation";

/** Same reviewed fact, never a reclassification or inferred sex-at-birth value. */
export function sexSupplementText(projection: Form3500Projection): string | undefined {
  const { sex, sexContext } = projection.sections.A;
  if (sex === undefined || (sex !== "intersex" && !sexContext)) return;
  return [
    `A3 Sex (reviewed value): ${sex}`,
    ...(sexContext ? [`A3 Sex context: ${sexContext}`] : []),
    ...(sex === "intersex" ? ["Native Male/Female boxes are unselected. This preserves the supplied value without inferring sex at birth."] : []),
  ].join("\n");
}

export async function sexTextLimitation(projection: Form3500Projection) {
  return narrativeGlyphLimitation(sexSupplementText(projection), "A3");
}

export async function appendSexContinuations(document: PDFDocument, projection: Form3500Projection, referenceProjection = projection) {
  const text = sexSupplementText(projection);
  if (text === undefined) return;
  const font = await document.embedFont(StandardFonts.Helvetica);
  const reference = form3500ReportReference(referenceProjection);
  // Pinned A3 box: its unused right side ends before Weight at x201.
  // At 8pt even the widest W- + 20 hex characters fit between x98 and x198.
  document.getPages()[0].drawText("A3 continued", { x: 105, y: 518, size: 8.5, font });
  document.getPages()[0].drawText(reference, { x: 98, y: 503, size: 8, font });
  const lines = wrapContinuationText(text, font);
  const count = Math.floor((continuationGeometry.bodyTop - continuationGeometry.bodyBottom) / continuationGeometry.lineHeight) + 1;
  const total = Math.ceil(lines.length / count);
  for (let start = 0, number = 1; start < lines.length; start += count, number++) {
    const page = document.addPage([612, 792]);
    page.drawText("Form FDA 3500 (09/2025) - Section A, block A3 continuation", { x: 42, y: 750, size: 12, font });
    page.drawText(`A3 Sex (reviewed value): ${projection.sections.A.sex}`, { x: 42, y: 730, size: 10, font });
    page.drawText(`Report reference: ${reference}`, { x: 42, y: 714, size: 8.5, font });
    lines.slice(start, start + count).forEach((line, index) => {
      if (line.text) page.drawText(line.text, { x: 42, y: continuationGeometry.bodyTop - index * continuationGeometry.lineHeight, size: continuationGeometry.fontSize, font });
    });
    page.drawText(`Section A, block A3 supplement page ${number} of ${total}`, { x: 42, y: 32, size: 10, font });
  }
}
