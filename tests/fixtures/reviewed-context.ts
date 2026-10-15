import { applyCaseCommand } from "../../src/domain/case/commands";
import { targetFromKey } from "../../src/domain/case/facts";
import type { CaseValue, SemanticCase } from "../../src/domain/case/types";
import { productCapacityCase } from "./product-capacity";

export const assayContext = "assay repeated, first draw haemolysed";
export function contextSource(stamp: string, text = "Fictional clinician-provided information.") {
  return { id: `context-source-${stamp}`, inputId: `context-input-${stamp}`, inputType: "correction" as const,
    actor: "clinician" as const, excerpt: text, start: 0, end: text.length, recordedAt: "2026-10-15T00:00:00.000Z" };
}
export function setContextFact(current: SemanticCase, target: string, value: CaseValue<unknown>) {
  const stamp = `${current.revision}-${target}`;
  return applyCaseCommand(current, { type: "record-clinician-facts", commandId: `context-${stamp}`, expectedRevision: current.revision,
    source: contextSource(stamp, `Fictional explicit correction: ${target} = ${JSON.stringify(value)}`),
    facts: [{ id: `context-value-${stamp}`, intent: "correction", target: targetFromKey(current, target), value }],
  }).case;
}
export function contextCase() {
  let current = structuredClone(productCapacityCase()); current.id = "case-11111111-1111-4111-8111-111111111115";
  for (const [field, value] of [["testName", "Fictional assay"], ["testResult", "14.2"], ["date", "2026-08-18"], ["lowRange", "4.0"], ["highRange", "16.0"]]) {
    current = setContextFact(current, `test:test-hemoglobin:${field}`, { kind: "known", value });
  }
  return current;
}
export function pendingContextCase() {
  const current = contextCase(), source = contextSource("conflict", "Two fictional records disagree on outcome: partially improved (chart A uncertain) or persistent symptoms (chart B follow-up incomplete).");
  return applyCaseCommand(current, { type: "attach-grounded-proposals", commandId: "attach-context-alternatives", expectedRevision: current.revision,
    products: [], sources: [source], proposals: [
      { proposalId: "outcome-A", groupId: "outcome-context", intent: "alternative", target: { entity: "event", entityId: "event", field: "outcome" }, value: { kind: "known", value: "partially improved", qualifier: "chart A uncertain" }, sourceIds: [source.id] },
      { proposalId: "outcome-B", groupId: "outcome-context", intent: "alternative", target: { entity: "event", entityId: "event", field: "outcome" }, value: { kind: "known", value: "persistent symptoms", qualifier: "chart B follow-up incomplete" }, sourceIds: [source.id] },
    ],
  }).case;
}
export function conflictedContextCase() {
  const current = pendingContextCase();
  return applyCaseCommand(current, { type: "review-proposal-groups", commandId: "accept-context-alternatives", expectedRevision: current.revision, decisions: [{ groupId: "outcome-context", action: "accept" }] }).case;
}
