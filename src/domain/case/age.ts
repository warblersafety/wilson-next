/** Numeric legacy values mean years; explicit non-year ages remain one atomic fact. */
export type NativePatientAge = number | { value: number; unit: "months" | "weeks" | "days" };
export type PatientAge = NativePatientAge | { wording: string };
export function isNativePatientAge(value: unknown): value is NativePatientAge {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 && value <= 150;
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 2 && Object.hasOwn(value, "value") && Object.hasOwn(value, "unit")
    && ((value as { unit: unknown }).unit === "months" || (value as { unit: unknown }).unit === "weeks" || (value as { unit: unknown }).unit === "days")
    && Number.isSafeInteger((value as { value?: unknown }).value)
    && ((value as { value: number }).value >= 0);
}
export function patientAgeParts(value: NativePatientAge): { value: number; unit: "years" | "months" | "weeks" | "days" } {
  return typeof value === "number" ? { value, unit: "years" } : value;
}

export function isStatedAge(value: unknown): value is { wording: string } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && "wording" in value && typeof value.wording === "string" && value.wording.trim());
}
export function isPatientAge(value: unknown): value is PatientAge { return isNativePatientAge(value) || isStatedAge(value); }
export function patientAgeText(value: PatientAge): string {
  if (isStatedAge(value)) return value.wording;
  const age = patientAgeParts(value); return `${age.value} ${age.unit}`;
}
