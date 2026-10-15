import { isPatientAge, patientAgeParts } from "../../domain/case/age";
import { nativeSingleLineTextLimitation } from "./product-text";
export const nativeAgeGeometry = { width: 27.621, fontSize: 8.5 } as const;
export function patientAgeLimitation(age: unknown): string | undefined {
  if (age === undefined) return undefined;
  if (!isPatientAge(age)) return "does not have a supported whole value and unit";
  return nativeSingleLineTextLimitation(String(patientAgeParts(age).value), nativeAgeGeometry.width, nativeAgeGeometry.fontSize, "age control");
}
