import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
export interface NativeMultilineGeometry { width: number; height: number; fontSize: number; maxLength: number; label: string }
const narrativeFont = PDFDocument.create().then(document => document.embedFont(StandardFonts.Helvetica));
/** Native border0/padding1 and existing appearance metrics; never truncate/shrink. */
export async function multilineTextLimitation(text: string | undefined, geometry: NativeMultilineGeometry): Promise<string | undefined> {
  if (!text) return undefined;
  if (text.length > geometry.maxLength) return `exceeds the ${geometry.label} narrative capacity`;
  const font = await narrativeFont;
  const characters = new Set(font.getCharacterSet());
  if (Array.from(text).some(character => character !== "\n" && !characters.has(character.codePointAt(0)!))) return `contains characters the current ${geometry.label} appearance font cannot represent`;
  const bounds = { x: 1, y: 1, width: geometry.width - 2, height: geometry.height - 2 };
  // Native appearance wraps at whitespace and leaves an unbreakable token whole.
  // Count conservatively with the same font metrics; retain all original text.
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    let remaining = paragraph;
    do {
      let end = remaining.length;
      while (end > 0 && font.widthOfTextAtSize(remaining.slice(0, end), geometry.fontSize) >= bounds.width) {
        const previous = remaining.slice(0, end).search(/\s+\S*$/);
        end = previous >= 0 ? previous : 0;
      }
      if (end === 0 && remaining.length > 0) return `does not fit ${geometry.label} at its native font size`;
      lines++;
      remaining = remaining.slice(end).trimStart();
    } while (remaining.length);
  }
  const lineHeight = font.heightAtSize(geometry.fontSize) * 1.2;
  if (lines * lineHeight > bounds.height) return `does not fit ${geometry.label} at its native font size`;
  return undefined;
}
