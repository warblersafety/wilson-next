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
export type ProductTextField = "route" | "frequency" | "dose" | "strength";
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
  const matched = options.find(option => option.trim() && option.toLowerCase() === value.trim().toLowerCase());
  return matched && matched !== "Other" ? { option: matched } : { option: "Other", other: value };
}
/** A PDF-owned representation limit: never shorten text or shrink native type. */
export function productTextLimitation(field: ProductTextField, value: string): string | undefined {
  if (!value.trim()) return "has no non-blank wording";
  if (field === "dose" || field === "strength") return undefined;
  const other = field === "route" ? encodeForm3500Route(value).other : encodeForm3500Frequency(value).other;
  if (other === undefined) return undefined;
  const { width, fontSize } = otherTextGeometry[field];
  return nativeSingleLineTextLimitation(other, width, fontSize, "Other text control");
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
