import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { reporterTextFields, type Form3500Projection, type ReporterTextField } from "../../domain/case/projection";
import { purchaseCountryLabel, purchaseCountrySuggestions } from "../../domain/case/purchase-details";
import { nativeSingleLineTextLimitation } from "./product-text";
import { wrapContinuationText, narrativeGlyphLimitation, form3500ReportReference, continuationGeometry } from "./narrative-continuation";

export const reporterCountryLabel = purchaseCountryLabel;
export const reporterCountrySuggestions = purchaseCountrySuggestions;
export const reporterTextLabels: Record<ReporterTextField, string> = {
  lastName: "Last name", firstName: "First name", address: "Address", city: "City",
  state: "State/province/region", postalCode: "ZIP/postal code", country: "Country",
  phone: "Phone", email: "Email",
};

/** Pinned FDA09/2025 native G1 text widgets; never shrink or truncate. */
export const reporterGeometry = {
  lastName: { widget: "LastName", width: 258.491, max: Infinity },
  firstName: { widget: "FirstName", width: 260.759, max: Infinity },
  address: { widget: "Address", width: 524.88, max: 100 },
  city: { widget: "City", width: 215.768, max: Infinity },
  state: { widget: "State", width: 229.751, max: Infinity },
  postalCode: { widget: "ZipCode", width: 68.876, max: 10 },
  phone: { widget: "PhoneNum", width: 108.232, max: Infinity },
  email: { widget: "Email", width: 410.74, max: Infinity },
} as const;

export function reporterNativeText(field: keyof typeof reporterGeometry, text: string | undefined) {
  const g = reporterGeometry[field];
  return text !== undefined && (text.length > g.max || nativeSingleLineTextLimitation(text, g.width, 8.5, "G1 control"))
    ? "Continued" : text;
}

export function reporterSupplementEntries(projection: Form3500Projection) {
  const r = projection.sections.G.reporter;
  return reporterTextFields.flatMap(field => {
    const value = r[field];
    const overflow = value !== undefined && (field === "country"
      ? !reporterCountryLabel(value) : reporterNativeText(field, value) !== value);
    return [
      ...(overflow ? [{ field, text: `G1 ${reporterTextLabels[field]}: ${value}` }] : []),
      ...(r.fieldContext ?? []).filter(c => c.field === field)
        .map(c => ({ field, text: `G1 ${reporterTextLabels[field]} context: ${c.text}` })),
    ];
  });
}

export async function reporterTextIssues(projection: Form3500Projection) {
  const r = projection.sections.G.reporter;
  const issues: { field: ReporterTextField; limitation: string }[] = [];
  for (const field of reporterTextFields) {
    const texts = [
      ...(r[field] !== undefined ? [r[field]!] : []),
      ...(r.fieldContext ?? []).filter(c => c.field === field).map(c => c.text),
    ];
    for (const text of texts) {
      const limitation = await narrativeGlyphLimitation(text, "G1");
      if (limitation) issues.push({ field, limitation });
    }
  }
  return issues;
}

export async function appendReporterContinuations(document: PDFDocument, projection: Form3500Projection, referenceProjection = projection) {
  const entries = reporterSupplementEntries(projection);
  if (!entries.length) return;
  const font = await document.embedFont(StandardFonts.Helvetica);
  const reference = form3500ReportReference(referenceProjection);
  document.getPages()[6].drawText(`Report ${reference} - Section G1 continued in attached supplement.`, {
    x: 42, y: 776, size: 8, font,
  });
  const lines = entries.flatMap(entry => wrapContinuationText(entry.text, font)
    .map(line => ({ line, field: entry.field })));
  const count = Math.floor((continuationGeometry.bodyTop - continuationGeometry.bodyBottom) / continuationGeometry.lineHeight) + 1;
  const total = Math.ceil(lines.length / count);
  for (let start = 0, n = 1; start < lines.length; start += count, n++) {
    const page = document.addPage([612, 792]);
    page.drawText("Form FDA 3500 (09/2025) - Section G1 continuation", { x: 42, y: 750, size: 12, font });
    page.drawText(`Starts with G1 ${reporterTextLabels[lines[start].field]}`, { x: 42, y: 730, size: 10, font });
    page.drawText(`Report reference: ${reference}`, { x: 42, y: 714, size: 8.5, font });
    lines.slice(start, start + count).forEach(({ line }, i) => {
      if (line.text) page.drawText(line.text, { x: 42, y: 700 - i * 14, size: 10, font });
    });
    page.drawText(`Section G1 supplement page ${n} of ${total}`, { x: 42, y: 32, size: 10, font });
  }
}
