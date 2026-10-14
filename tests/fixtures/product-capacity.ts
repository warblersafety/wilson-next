import { applyCaseCommand } from "../../src/domain/case/commands";
import type { CaseValue, ProductFactKey, SemanticCase } from "../../src/domain/case/types";
import { completeResolvedCase } from "../domain/fixture";

export const capacityProductIds = ["product-apixaban", "product-naproxen", "product-lisinopril"] as const;
export const capacityProductNames = ["Synthetic product A", "Synthetic product B", "Synthetic product C"];

/** All inputs are fictional. Changes use the normal authoritative command path. */
export function correctCapacityProduct(current: SemanticCase, index: number, values: Partial<Record<ProductFactKey, CaseValue<unknown>>>) {
  const stamp = `capacity-${current.revision}`;
  const text = `Fictional product ${index + 1}: ${JSON.stringify(values)}.`;
  return applyCaseCommand(current, {
    type: "record-clinician-facts", commandId: stamp, expectedRevision: current.revision,
    source: { id: stamp, inputId: stamp, inputType: "correction", excerpt: text, start: 0, end: text.length, actor: "clinician", recordedAt: "2026-10-14T00:00:00.000Z" },
    facts: Object.entries(values).map(([field, value], i) => ({ id: `${stamp}-${i}`, intent: "correction" as const, target: { entity: "product" as const, entityId: capacityProductIds[index], field: field as ProductFactKey }, value: value! })),
  }).case;
}

export function productCapacityCase(): SemanticCase {
  let current = structuredClone(completeResolvedCase());
  current.id = "case-11111111-1111-4111-8111-111111111126";
  for (let i = 0; i < 3; i++) current = correctCapacityProduct(current, i, {
    name: { kind: "known", value: capacityProductNames[i] },
    indication: { kind: "known", value: "Fictional indication" },
    stopped: { kind: "unknown" }, doseReduced: { kind: "unknown" },
    improvedAfterChange: { kind: "unknown" }, restarted: { kind: "unknown" }, recurred: { kind: "unknown" },
  });
  return current;
}
