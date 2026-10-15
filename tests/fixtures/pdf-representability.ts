import { applyCaseCommand } from "../../src/domain/case/commands";
import type { CaseValue, SemanticCase } from "../../src/domain/case/types";

export function correctReportedSex(current: SemanticCase, value: CaseValue<unknown>): SemanticCase {
  const stamp = `reported-sex-${current.revision}`;
  const text = `Fictional clinician-provided sex correction: ${JSON.stringify(value)}.`;
  return applyCaseCommand(current, { type: "record-clinician-facts", commandId: stamp, expectedRevision: current.revision,
    source: { id: stamp, inputId: stamp, inputType: "correction", actor: "clinician", excerpt: text, start: 0, end: text.length, recordedAt: "2026-10-15T00:00:00.000Z" },
    facts: [{ id: stamp, intent: "correction", target: { entity: "patient", entityId: "patient", field: "sex" }, value }],
  }).case;
}
