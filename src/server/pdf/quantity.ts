import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { quantityContextEntries, type Form3500Projection } from "../../domain/case/projection";
import type { ProjectedQuantity } from "../../domain/case/projection";
import { nativeSingleLineTextLimitation } from "./product-text";

export const quantityTextGeometry = {
  dose: { width: 208.709, fontSize: 8.5 },
  strength: { width: 76.116, fontSize: 8.5 },
} as const;

// Existing formatting-only literal split. Never calculate, infer a total or
// mine a parenthetical phrase from the clinician's value for qualifier metadata.
function literalQuantityParts(quantity: ProjectedQuantity): { amount: string; unit: string } {
  const match = quantity.value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mg|g|kg|mcg|µg|μg|ng|mL|L|IU|mg\/mL|%)$/i);
  const units: Record<string, string> = {
    mg: "MILLIGRAM(S) - MG", g: "GRAM(S) - GM", kg: "KILOGRAM(S) - KG",
    mcg: "MICROGRAM(S) - UGM", "µg": "MICROGRAM(S) - UGM", "μg": "MICROGRAM(S) - UGM",
    ng: "NANOGRAM(S) - NGM", ml: "MILLILITRE(S) - ML", l: "LITRE(S) - L",
    iu: "INTERNATIONAL UNIT(S) - IU", "mg/ml": "MILLIGRAMS/MILLILITRES - MG/ML", "%": "PERCENT - %",
  };
  const rawAmount = match ? match[1] : quantity.value;
  const amount = rawAmount;
  return { amount, unit: match ? units[match[2].toLowerCase()] : " " };
}

export function quantityParts(quantity: ProjectedQuantity, field: "dose" | "strength"): { amount: string; unit: string } {
  const parts = literalQuantityParts(quantity);
  if (quantity.qualifier === undefined) return parts;
  const { width, fontSize } = quantityTextGeometry[field];
  // The full raw value and context are carried in B5. Never clip a compound
  // quantity or infer an amount/unit from its words to fill this narrow control.
  const amount = `${parts.amount} (see B5)`;
  return nativeSingleLineTextLimitation(amount, width, fontSize, "quantity text control")
    ? { amount: "See B5", unit: " " } : { ...parts, amount };
}

export function quantityLimitation(_field: "dose" | "strength", quantity: ProjectedQuantity | undefined): string | undefined {
  return quantity !== undefined && !quantity.value.trim() ? "has no non-blank wording" : undefined;
}

// Independent native metadata: Page2 DescEvent, 531.102 x520.574, border0,
// padding1, fixed8.5pt, MaxLen4000. No font shrinking or continuation pages.
export const quantityNarrativeGeometry = { width: 531.102, height: 520.574, fontSize: 8.5, maxLength: 4000 };
const narrativeFont = PDFDocument.create().then(document => document.embedFont(StandardFonts.Helvetica));
export async function eventNarrativeLimitation(projection: Form3500Projection): Promise<string | undefined> {
  const entries = quantityContextEntries(projection.sections.D.suspectProducts);
  const text = projection.sections.B.eventDescription ?? "";
  if (entries.some(entry => !text.includes(entry.text))) return "does not carry the full reviewed quantity context in B5";
  return narrativeTextLimitation(text);
}

/** B5 fidelity is checked regardless of whether a quantity qualifier exists. */
export async function narrativeTextLimitation(text: string | undefined): Promise<string | undefined> {
  if (!text) return undefined;
  if (text.length > quantityNarrativeGeometry.maxLength) return "exceeds the B5 narrative capacity";
  const font = await narrativeFont;
  const characters = new Set(font.getCharacterSet());
  if (Array.from(text).some(character => character !== "\n" && !characters.has(character.codePointAt(0)!))) return "contains characters the current B5 appearance font cannot represent";
  const bounds = { x: 1, y: 1, width: quantityNarrativeGeometry.width - 2, height: quantityNarrativeGeometry.height - 2 };
  // Native appearance wraps at whitespace and leaves an unbreakable token whole.
  // Count conservatively with the same font metrics; retain all original text.
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    let remaining = paragraph;
    do {
      let end = remaining.length;
      while (end > 0 && font.widthOfTextAtSize(remaining.slice(0, end), quantityNarrativeGeometry.fontSize) >= bounds.width) {
        const previous = remaining.slice(0, end).search(/\s+\S*$/);
        end = previous >= 0 ? previous : 0;
      }
      if (end === 0 && remaining.length > 0) return "does not fit B5 at its native font size";
      lines++;
      remaining = remaining.slice(end).trimStart();
    } while (remaining.length);
  }
  const lineHeight = font.heightAtSize(quantityNarrativeGeometry.fontSize) * 1.2;
  if (lines * lineHeight > bounds.height) return "does not fit B5 at its native font size";
  return undefined;
}
