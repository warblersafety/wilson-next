import { StandardFontEmbedder } from "@cantoo/pdf-lib";

// Pinned09/2025 native PDF metadata. Independently checked against both widgets.
export const nativeRouteOptions: readonly string[] = [
  " ",
  "Auricular (otic)",
  "Buccal",
  "Cutaneous",
  "Dental",
  "Endocervical",
  "Endosinusial",
  "Endotracheal",
  "Epidural",
  "Extra-amniotic",
  "Hemodialysis",
  "Intra corpus cavernosum",
  "Intra-amniotic",
  "Intra-arterial",
  "Intra-articular",
  "Intra-uterine",
  "Intracardiac",
  "Intracavernous",
  "Intracerebral",
  "Intracervical",
  "Intracisternal",
  "Intracorneal",
  "Intracoronary",
  "Intradermal",
  "Intradiscal (intraspinal)",
  "Intrahepatic",
  "Intralesional",
  "Intralymphatic",
  "Intramedullar (bone marrow)",
  "Intrameningeal",
  "Intramuscular",
  "Intraocular",
  "Intrapericardial",
  "Intraperitoneal",
  "Intrapleural",
  "Intrasynovial",
  "Intrathecal",
  "Intrathoracic",
  "Intratracheal",
  "Intratumor",
  "Intravenous (not otherwise specified)",
  "Intravenous bolus",
  "Intravenous drip",
  "Intravesical",
  "Iontophoresis",
  "Nasal",
  "Occlusive dressing technique",
  "Ophthalmic",
  "Oral",
  "Oropharingeal",
  "Parenteral",
  "Periarticular",
  "Perineural",
  "Rectal",
  "Respiratory (inhalation)",
  "Retrobulbar",
  "Subcutaneous",
  "Subdermal",
  "Sublingual",
  "Sunconjunctival",
  "Topical",
  "Transdermal",
  "Transmammary",
  "Transplacental",
  "Unknown",
  "Urethral",
  "Vaginal",
  "Other"
];
const frequencyOptions: Record<string, string> = {
  daily: "Daily", "twice daily": "BID", "three times daily": "TID",
  "four times daily": "QID", "at bedtime": "HS", "as needed": "PRN",
};
export type ProductTextField = "route" | "frequency" | "dose" | "strength" | "ndcOrUniqueId";
export const identifierGeometry = { width: 145.196, fontSize: 8.5 } as const;
export const otherTextGeometry = {
  route: { width: 165.6, fontSize: 8.5 },
  frequency: { width: 123.129, fontSize: 8.5 },
} as const;
// This is the existing pdf-lib default appearance font, not a new embedded font.
const appearanceFont = StandardFontEmbedder.for("Helvetica" as Parameters<typeof StandardFontEmbedder.for>[0]);
const appearanceCharacters = new Set(appearanceFont.encoding.supportedCodePoints);

export function encodeForm3500Frequency(value: string): { option: string; other?: string } {
  const option = Object.hasOwn(frequencyOptions, value) ? frequencyOptions[value] : undefined;
  return option ? { option } : { option: "Other", other: value };
}
export function encodeForm3500Route(value: string, options: readonly string[] = nativeRouteOptions): { option: string; other?: string } {
  const matched = /[\r\n\t]/.test(value) ? undefined : options.find(option => option.trim() && option.toLowerCase() === value.trim().toLowerCase());
  return matched && matched !== "Other" ? { option: matched } : { option: "Other", other: value };
}
export function needsD2Supplement(field: "route" | "frequency", value: string): boolean {
  const other = field === "route" ? encodeForm3500Route(value).other : encodeForm3500Frequency(value).other;
  const g = otherTextGeometry[field];
  return other !== undefined && Boolean(nativeSingleLineTextLimitation(other, g.width, g.fontSize, "Other text control"));
}
/** Charset of the actual existing appearance; linefeeds are supported on continuations. */
export function appearanceTextGlyphLimitation(text: string): string | undefined {
  return Array.from(text).some(c => c !== "\n" && (!appearanceCharacters.has(c.codePointAt(0)!) || /[\u0000-\u001f\u007f]/.test(c)))
    ? "contains characters the current PDF appearance font cannot represent" : undefined;
}
/** A PDF-owned representation limit: never shorten text or shrink native type. */
export function productTextLimitation(field: ProductTextField, value: string): string | undefined {
  if (!value.trim()) return "has no non-blank wording";
  if (field === "dose" || field === "strength") return undefined;
  if (field === "ndcOrUniqueId") return nativeSingleLineTextLimitation(value, identifierGeometry.width, identifierGeometry.fontSize, "NDC number or Unique ID control");
  const other = field === "route" ? encodeForm3500Route(value).other : encodeForm3500Frequency(value).other;
  if (other === undefined) return undefined;
  // Long/multiline wording uses the same charset on a fixed-size supplement.
  return appearanceTextGlyphLimitation(other);
}

/** Same metrics/charset used by the existing generated Helvetica appearance. */
export function nativeSingleLineTextLimitation(text: string, width: number, fontSize: number, label: string): string | undefined {
  if (/[\r\n\t]/.test(text)) return `does not fit the single-line ${label}`;
  try {
    // Cantoo substitutes ? for unsupported glyphs; encoding without an error is not proof.
    if (Array.from(text).some(character => !appearanceCharacters.has(character.codePointAt(0)!))) {
      return "contains characters the current PDF appearance font cannot represent";
    }
    // Native border width0 plus1pt padding on each side, per appearance provider.
    if (appearanceFont.widthOfTextAtSize(text, fontSize) <= width - 2) return undefined;
    return `does not fit the ${label} at its native font size`;
  } catch {
    return "contains characters the current PDF appearance font cannot represent";
  }
}
