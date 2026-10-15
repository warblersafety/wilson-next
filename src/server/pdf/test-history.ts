import type { Form3500Projection } from "../../domain/case/projection";
import { multilineTextLimitation } from "./multiline-text";
// Independently verified native09/2025 rectangles,8pt,2000chars,border0/padding1.
export const testHistoryGeometry = {
  relevantTestContext: { width: 528.001, height: 197.008, fontSize: 8, maxLength: 2000, label: "B6 additional comments" },
  relevantHistory: { width: 528.001, height: 201.838, fontSize: 8, maxLength: 2000, label: "B7 history" },
} as const;
export async function testHistoryLimitations(projection: Form3500Projection) {
  const issues: Array<{ field: keyof typeof testHistoryGeometry; limitation: string }> = [];
  for (const field of ["relevantTestContext", "relevantHistory"] as const) {
    const limitation = await multilineTextLimitation(projection.sections.B[field], testHistoryGeometry[field]);
    if (limitation) issues.push({ field, limitation });
  }
  return issues;
}
