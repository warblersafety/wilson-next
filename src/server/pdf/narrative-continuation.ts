import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, type PDFFont } from "@cantoo/pdf-lib";
import type { Form3500Projection } from "../../domain/case/projection";
import { multilineTextLimitation, type NativeMultilineGeometry } from "./multiline-text";

export const narrativeBlocks = {
  eventDescription: { block: "B5", label: "Event, problem or product use error", width: 531.102, height: 520.574, fontSize: 8.5, maxLength: 4000 },
  relevantTestContext: { block: "B6", label: "Additional comments and relevant test context", width: 528.001, height: 197.008, fontSize: 8, maxLength: 2000 },
  relevantHistory: { block: "B7", label: "Other relevant history", width: 528.001, height: 201.838, fontSize: 8, maxLength: 2000 },
} as const;
export type NarrativeField = keyof typeof narrativeBlocks;
const fontPromise = PDFDocument.create().then(document => document.embedFont(StandardFonts.Helvetica));
// Fixed 10pt body, 14pt leading, letter pages with 42pt margins. Never shrink.
export const continuationGeometry = { width: 612, height: 792, margin: 42, bodyTop: 700, bodyBottom: 56, fontSize: 10, lineHeight: 14 } as const;
export interface ContinuationLine { text: string; breakAfter: "wrap" | "newline" | "end" }
export interface NarrativeContinuation { field: NarrativeField; block: string; label: string; marker: string; reportReference: string; pages: ContinuationLine[][] }

/** This gate applies before both native and attachment output. No substitutions. */
export async function narrativeGlyphLimitation(text: string | undefined, label: string): Promise<string | undefined> {
  const font = await fontPromise;
  const characters = new Set(font.getCharacterSet());
  return text !== undefined && Array.from(text).some(character => character !== "\n" && (!characters.has(character.codePointAt(0)!) || /[\u0000-\u001f\u007f]/.test(character)))
    ? `contains characters the current ${label} appearance font cannot represent` : undefined;
}

/** Slices concatenate back to the original, including spaces, blank lines and newlines. */
export function wrapContinuationText(text: string, font: PDFFont): ContinuationLine[] {
  const { width, margin, fontSize } = continuationGeometry;
  const lines: ContinuationLine[] = [];
  const paragraphs = text.split("\n");
  paragraphs.forEach((paragraph, index) => {
    const characters = Array.from(paragraph);
    let start = 0;
    do {
      let end = start, lastSpace = start, measured = "";
      while (end < characters.length && font.widthOfTextAtSize(measured + characters[end], fontSize) <= width - margin * 2) {
        measured += characters[end++];
        if (characters[end - 1] === " ") lastSpace = end;
      }
      if (end === start && characters.length > start) throw new Error("Continuation character exceeds available line width");
      if (end < characters.length && lastSpace > start) end = lastSpace;
      const slice = characters.slice(start, end).join("");
      start = end;
      lines.push({ text: slice, breakAfter: start < characters.length ? "wrap" : index < paragraphs.length - 1 ? "newline" : "end" });
    } while (start < characters.length);
  });
  return lines;
}

export function form3500ReportReference(projection: Form3500Projection): string {
  return `W-${createHash("sha256").update(JSON.stringify([projection.caseId, projection.sections, ...(projection.expirationNotes?.length ? [projection.expirationNotes.map(({block,ordinal,text})=>({block,ordinal,text}))] : [])])).digest("hex").slice(0, 20)}`;
}

export async function planNarrativeContinuations(projection: Form3500Projection, referenceProjection: Form3500Projection = projection): Promise<NarrativeContinuation[]> {
  const font = await fontPromise;
  const plans: NarrativeContinuation[] = [];
  for (const field of Object.keys(narrativeBlocks) as NarrativeField[]) {
    const geometry = narrativeBlocks[field], text = projection.sections.B[field];
    const glyphError = await narrativeGlyphLimitation(text, geometry.block);
    if (glyphError) throw new Error(`The reviewed ${geometry.block} text ${glyphError}`);
    if (!text || !await multilineTextLimitation(text, geometry as NativeMultilineGeometry)) continue;
    const lines = wrapContinuationText(text, font), pages: ContinuationLine[][] = [];
    const count = Math.floor((continuationGeometry.bodyTop - continuationGeometry.bodyBottom) / continuationGeometry.lineHeight) + 1;
    for (let start = 0; start < lines.length; start += count) pages.push(lines.slice(start, start + count));
    plans.push({ field, block: geometry.block, label: geometry.label, marker: "", reportReference: "", pages });
  }
  const reportReference = form3500ReportReference(referenceProjection);
  let pageNumber = 1;
  for (const plan of plans) {
    const last = pageNumber + plan.pages.length - 1;
    plan.reportReference = reportReference;
    plan.marker = `Report reference: ${reportReference}\nSee Section B, block ${plan.block}, attachment ${pageNumber === last ? "page " + pageNumber : "pages " + pageNumber + "-" + last}; continued`;
    pageNumber = last + 1;
  }
  return plans;
}

export async function appendNarrativeContinuations(document: PDFDocument, plans: NarrativeContinuation[]): Promise<void> {
  if (!plans.length) return;
  const font = await document.embedFont(StandardFonts.Helvetica);
  const total = plans.reduce((sum, plan) => sum + plan.pages.length, 0);
  let number = 0;
  for (const plan of plans) for (const lines of plan.pages) {
    const page = document.addPage([continuationGeometry.width, continuationGeometry.height]);
    page.drawText("Form FDA 3500 (09/2025) - Narrative continuation", { x: 42, y: 750, size: 12, font });
    page.drawText(`Section B, block ${plan.block} - ${plan.label}`, { x: 42, y: 728, size: 10, font });
    page.drawText(`Report reference: ${plan.reportReference}`, { x: 42, y: 714, size: 8.5, font });
    lines.forEach((line, index) => {
      if (line.text) page.drawText(line.text, { x: 42, y: continuationGeometry.bodyTop - index * continuationGeometry.lineHeight, size: continuationGeometry.fontSize, font });
    });
    page.drawText(`Attachment page ${++number} of ${total}`, { x: 42, y: 32, size: 10, font });
  }
}
