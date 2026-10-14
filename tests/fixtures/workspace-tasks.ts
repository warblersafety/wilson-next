import { randomUUID } from "node:crypto";
import { createSemanticCase } from "../../src/domain/case/create";
import { applyCaseCommand } from "../../src/domain/case/commands";
import type { CaseValue, EventFactKey, FactTarget, ProductFactKey } from "../../src/domain/case/types";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { journeyResponse } from "../../src/server/case/browser-state";

export const workspaceTaskKinds = ["indications", "serious-outcomes", "death-date", "clinical-context", "medication-history", "device-details"] as const;
export type WorkspaceTaskKind = typeof workspaceTaskKinds[number];
/** Explicit synthetic accepted facts exercise persistence, not model extraction. */
export async function workspaceTaskCase(kind: WorkspaceTaskKind) {
  const id = "restart-product";
  const known = (value: unknown): CaseValue<unknown> => ({ kind: "known", value });
  const facts: Array<[FactTarget, CaseValue<unknown>]> = [
    [{ entity: "patient", entityId: "patient", field: "ageYears" }, known(40)],
    [{ entity: "event", entityId: "event", field: "reportType" }, known("adverse-event")],
    [{ entity: "event", entityId: "event", field: "symptoms" }, known(["fictional rash"])],
  ];
  const event = (field: EventFactKey, value: CaseValue<unknown>) => facts.push([{ entity: "event", entityId: "event", field }, value]);
  const product = (field: ProductFactKey, value: CaseValue<unknown>) => facts.push([{ entity: "product", entityId: id, field }, value]);
  product("name", known(kind === "device-details" ? "Fictional device" : "Fictional medicine"));
  product("productType", known(kind === "device-details" ? "device" : "drug-or-biologic"));
  product("role", known("suspect"));
  if (kind !== "indications") product("indication", known("Fictional indication"));
  for (const field of ["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const) {
    if (kind !== "serious-outcomes" || field !== "death") event(field, known(kind === "death-date" && field === "death"));
  }
  if (kind !== "clinical-context") { event("relevantTestsAvailable", known(false)); event("relevantHistory", { kind: "explicitly-absent" }); }
  if (kind === "device-details") { product("implanted", known(true)); product("reprocessedSingleUse", known(true)); }
  const text = "Fictional clinician-entered selections for browser recovery acceptance. No extraction is tested.";
  const source = { id: "restart-source", inputId: "restart-input", inputType: "selection" as const, excerpt: text, start: 0, end: text.length, actor: "clinician" as const, recordedAt: "2026-10-14T12:00:00.000Z" };
  let current = applyCaseCommand(createSemanticCase(`case-${randomUUID()}`), { type: "attach-grounded-proposals", commandId: "restart-attach", expectedRevision: 0,
    products: [{ id, groupId: id }], sources: [source], proposals: facts.map(([target, value], index) => ({ proposalId: `restart-${index}`, groupId: target.entityId, intent: "fact", target, value, sourceIds: [source.id] })) }).case;
  current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "restart-accept", expectedRevision: current.revision,
    decisions: ["patient", "event", id].map(groupId => ({ groupId, action: "accept" })) }).case;
  const repository = new InMemoryCaseRepository({ initialCase: current });
  return journeyResponse(repository, await getJourneySnapshot(repository, current.id));
}
