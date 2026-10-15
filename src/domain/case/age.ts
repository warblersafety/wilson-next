/** Numeric legacy values mean years; explicit non-year ages remain one atomic fact. */
export type PatientAge = number | { value: number; unit: "months" | "weeks" | "days" };
export function isPatientAge(value: unknown): value is PatientAge {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 && value <= 150;
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 2 && Object.hasOwn(value, "value") && Object.hasOwn(value, "unit")
    && ((value as { unit: unknown }).unit === "months" || (value as { unit: unknown }).unit === "weeks" || (value as { unit: unknown }).unit === "days")
    && Number.isSafeInteger((value as { value?: unknown }).value)
    && ((value as { value: number }).value >= 0);
}
export function patientAgeParts(value: PatientAge): { value: number; unit: "years" | "months" | "weeks" | "days" } {
  return typeof value === "number" ? { value, unit: "years" } : value;
}
