import output from "../../evidence/issue-109/preserved-model-output.json" with { type: "json" };
import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import type { FactTarget, GroundedProposal } from "../../src/domain/case/types";

export const preservedGroupingOutput = output;
export const ibuprofenId = "product-3b0d61ab-0c2f-45ad-b175-589a0f7bb712";
// Reconstructed synthetic wording, NOT the unlogged original input. Five passages
// support the unchanged references in the retained provider output.
export const groupingUpdate = "Ibuprofen was stopped on September 11, 2026. Symptoms improved after stopping ibuprofen and it was never restarted. Hemoglobin was 8.9 g/dL on September 11, 2026 and 9.4 g/dL on September 12, 2026. Both hemoglobin results had reference ranges of 12 to 16 g/dL. There is no additional relevant medical history.";
export const groupingInput = { id: "grouping-input", type: "correction" as const, text: groupingUpdate, recordedAt: "2026-09-23T00:18:20.480Z" };

export function groupingAcceptedCase() {
  const text = "Fictional patient age 54, female, had gastrointestinal bleeding with hospitalization, no other serious outcomes, and suspect ibuprofen 400 mg oral TID for back pain starting September 8, 2026.";
  const source = { id: "baseline-source", inputId: "baseline-input", inputType: "narrative" as const, excerpt: text, start: 0, end: text.length, actor: "clinician" as const, recordedAt: groupingInput.recordedAt };
  const proposals: GroundedProposal[] = [];
  const add = (target: FactTarget, value: unknown) => proposals.push({ proposalId: `baseline-${proposals.length}`, groupId: target.entityId, intent: "fact", target, value: { kind: "known", value }, sourceIds: [source.id] });
  add({ entity: "patient", entityId: "patient", field: "ageYears" }, 54);
  add({ entity: "patient", entityId: "patient", field: "sex" }, "female");
  add({ entity: "event", entityId: "event", field: "symptoms" }, ["gastrointestinal bleeding"]);
  add({ entity: "event", entityId: "event", field: "hospitalized" }, true);
  for (const field of ["death", "lifeThreatening", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const) add({ entity: "event", entityId: "event", field }, false);
  const product = { name: "ibuprofen", productType: "drug-or-biologic", role: "suspect", dose: "400 mg", route: "oral", frequency: "TID", indication: "back pain", startDate: "2026-09-08" };
  for (const [field, value] of Object.entries(product)) add({ entity: "product", entityId: ibuprofenId, field: field as keyof typeof product }, value);
  let state = applyCaseCommand(createSemanticCase("case-11111111-1111-4111-8111-111111111109"), { type: "attach-grounded-proposals", commandId: "baseline", expectedRevision: 0, products: [{ id: ibuprofenId, groupId: ibuprofenId }], proposals, sources: [source] }).case;
  state = applyCaseCommand(state, { type: "review-proposal-groups", commandId: "baseline-accept", expectedRevision: state.revision, decisions: ["patient", "event", ibuprofenId].map(groupId => ({ groupId, action: "accept" })) }).case;
  return applyCaseCommand(state, { type: "record-clinician-facts", commandId: "baseline-report-type", expectedRevision: state.revision, source: { ...source, id: "report-type-source", inputType: "selection", excerpt: "Adverse event", end: 13 }, facts: [{ id: "report-type", intent: "fact", target: { entity: "event", entityId: "event", field: "reportType" }, value: { kind: "known", value: "adverse-event" } }] }).case;
}
