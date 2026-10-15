import type { TreatmentDuration } from "../../domain/case/duration";
import {nativeSingleLineTextLimitation} from "./product-text";
export function durationLimitation(value: TreatmentDuration | undefined): string | undefined {
 return value ? nativeSingleLineTextLimitation(value.value,61.455,8.5,"D3 duration amount control") : undefined;
}
