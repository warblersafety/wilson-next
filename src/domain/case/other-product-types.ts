/** Explicit FDA D5 Other Product Types answers; independent of reporting route. */
export const otherProductTypeValues = ["cannabinoid-hemp", "other"] as const;
export type OtherProductType = typeof otherProductTypeValues[number];
export function isOtherProductTypes(value: unknown): value is OtherProductType[] {
  return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length
    && value.every(item => typeof item === "string" && otherProductTypeValues.includes(item as OtherProductType));
}
