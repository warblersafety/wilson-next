import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import type { CaseValue, FactTarget, GroundedProposal, ProductFactKey, SemanticCase, Source } from "../../src/domain/case/types";

export function medicationSource(text: string, stamp: string): Source {
  return { id: `source-${stamp}`, inputId: `input-${stamp}`, inputType: "answer", excerpt: text,
    start: 0, end: text.length, actor: "clinician", recordedAt: "2026-09-21T12:00:00.000Z" };
}

/** Independent synthetic clinical expectations, without the completion policy. */
export function medicationCase(two = false): SemanticCase {
  const source = medicationSource("A fictional adult developed a rash while taking suspect amoxicillin for infection and, in the two-product case, suspect naproxen for pain. No serious outcomes, relevant tests or additional history are reported.", "opening-medication");
  const facts: Array<[FactTarget, CaseValue<unknown>]> = [
    [{ entity: "patient", entityId: "patient", field: "ageYears" }, { kind: "known", value: 40 }],
    [{ entity: "event", entityId: "event", field: "symptoms" }, { kind: "known", value: ["rash"] }],
    [{ entity: "event", entityId: "event", field: "relevantHistory" }, { kind: "explicitly-absent" }],
    [{ entity: "event", entityId: "event", field: "relevantTestsAvailable" }, { kind: "known", value: false }],
  ];
  for (const field of ["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const) {
    facts.push([{ entity: "event", entityId: "event", field }, { kind: "known", value: false }]);
  }
  const products = two ? ["amoxicillin", "naproxen"] : ["amoxicillin"];
  for (const name of products) for (const [field, value] of Object.entries({ name, productType: "drug-or-biologic", role: "suspect", indication: name === "amoxicillin" ? "infection" : "pain" })) {
    facts.push([{ entity: "product", entityId: name, field: field as ProductFactKey }, { kind: "known", value }]);
  }
  const proposals: GroundedProposal[] = facts.map(([target, value], index) => ({
    proposalId: `medication-proposal-${index}`, groupId: target.entityId, intent: "fact", target, value, sourceIds: [source.id],
  }));
  let current = applyCaseCommand(createSemanticCase("case-11111111-1111-4111-8111-111111111192"), {
    type: "attach-grounded-proposals", commandId: "medication-opening", expectedRevision: 0,
    products: products.map((id) => ({ id, groupId: id })), sources: [source], proposals,
  }).case;
  current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "accept-medication-opening", expectedRevision: current.revision,
    decisions: ["patient", "event", ...products].map((groupId) => ({ groupId, action: "accept" })) }).case;
  return applyCaseCommand(current, { type: "record-clinician-facts", commandId: "medication-report-type", expectedRevision: current.revision,
    source: medicationSource("Adverse event", "report-type-medication"), facts: [{ id: "medication-report-type", intent: "fact", target: { entity: "event", entityId: "event", field: "reportType" }, value: { kind: "known", value: "adverse-event" } }] }).case;
}

export function setMedication(current: SemanticCase, productId: string, values: Partial<Record<ProductFactKey, CaseValue<unknown>>>, text = "The clinician supplied the following fictional medication details."): SemanticCase {
  const stamp = `medication-update-${current.revision}`;
  return applyCaseCommand(current, { type: "record-clinician-facts", commandId: stamp, expectedRevision: current.revision,
    source: medicationSource(text, stamp), facts: Object.entries(values).map(([field, value], index) => ({
      id: `${stamp}-${index}`, target: { entity: "product", entityId: productId, field: field as ProductFactKey }, intent: "correction", value: value!,
    })) }).case;
}
