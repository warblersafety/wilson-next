import { describe, expect, it } from "vitest";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { nextCompletionQuestion } from "../../src/domain/case/completion-policy";
import { projectForm3500 } from "../../src/domain/case/projection";
import { createUnderstandingView } from "../../src/domain/case/views";
import { maximumAskedNeeds } from "../../src/domain/case/limits";
import { medicationCase, medicationSource, setMedication } from "../fixtures/medication-case";
import type { SemanticCase } from "../../src/domain/case/types";

const known = <T>(value: T) => ({ kind: "known" as const, value });
const unknown = { kind: "unknown" as const };
function ask(current: SemanticCase): SemanticCase {
  const q = nextCompletionQuestion(current)!;
  return applyCaseCommand(current, { type: "record-asked-need", commandId: `ask-${current.revision}`, expectedRevision: current.revision, key: q.key, targetIds: q.targetIds }).case;
}

describe("medication history, attribution and correction", () => {
  it("asks one product's missing history, accepts conditional answers together, and does not ask supplied details", () => {
    let current = medicationCase();
    expect(nextCompletionQuestion(current)).toMatchObject({ kind: "medication-history", productId: "amoxicillin", targetIds: ["product:amoxicillin:stopped", "product:amoxicillin:doseReduced"] });
    current = ask(current);
    current = applyCaseCommand(current, { type: "record-clinician-facts", commandId: "complete-history", expectedRevision: current.revision,
      source: medicationSource("Amoxicillin was stopped September 18, the rash improved afterward, and it was never restarted.", "complete-history"), answersNeed: "medication-history",
      facts: Object.entries({ stopped: true, stopDate: "2026-09-18", improvedAfterChange: true, restarted: false }).map(([field, value], index) => ({
        id: `answer-${index}`, target: { entity: "product" as const, entityId: "amoxicillin", field: field as "stopped" }, intent: "fact" as const, value: known(value),
      })) }).case;
    expect(nextCompletionQuestion(current)?.kind).toBe("reporter");
    expect(current.askedNeeds[0].status).toBe("answered");
    expect(projectForm3500(current).sections.D.suspectProducts[0]).toMatchObject({ stopDate: "2026-09-18", improvedAfterChange: true, recurred: "inapplicable" });
  });

  it.each(["unknown", "declined"] as const)("closes %s details without guessing or looping and leaves outcomes blank", (kind) => {
    const current = setMedication(ask(medicationCase()), "amoxicillin", { stopped: { kind }, doseReduced: { kind } });
    expect(nextCompletionQuestion(current)?.kind).toBe("reporter");
    expect(current.askedNeeds[0].status).not.toBe("open");
    expect(projectForm3500(current).sections.D.suspectProducts[0].improvedAfterChange).toBeUndefined();
    expect(projectForm3500(current).omissions).toContainEqual(expect.objectContaining({ target: "product:amoxicillin:improvedAfterChange", reason: kind }));
  });

  it("represents dose reduction without stopping, unknown restart and supplied product-type combinations", () => {
    let current = setMedication(medicationCase(), "amoxicillin", { stopped: known(false), doseReduced: known(true), improvedAfterChange: known(false), medicationType: known(["otc", "generic-biosimilar"]), restarted: unknown, recurred: known(true) });
    expect(nextCompletionQuestion(current)?.kind).toBe("reporter");
    expect(projectForm3500(current).sections.D.suspectProducts[0]).toMatchObject({ improvedAfterChange: false, medicationType: ["generic-biosimilar", "otc"] });
    expect(projectForm3500(current).sections.D.suspectProducts[0].recurred).toBeUndefined();
    expect(createUnderstandingView(current).products[0].medicationNotice).toContain("unresolved");
    current = setMedication(current, "amoxicillin", { doseReduced: known(false) });
    expect(projectForm3500(current).sections.D.suspectProducts[0].improvedAfterChange).toBe("inapplicable");
    expect(current.products[0].facts.improvedAfterChange.resolvedValue).toBeUndefined();
  });

  it("keeps products separate and invalidates then reopens recurrence without resurrecting history", () => {
    let current = medicationCase(true);
    current = setMedication(current, "amoxicillin", { stopped: known(true), stopDate: unknown, improvedAfterChange: known(true), restarted: known(true), recurred: known(true) });
    current = setMedication(current, "naproxen", { stopped: known(false), doseReduced: known(false), restarted: known(false) });
    expect(projectForm3500(current).sections.D.suspectProducts.map(({ recurred }) => recurred)).toEqual([true, "inapplicable"]);
    current = setMedication(current, "amoxicillin", { restarted: known(false) });
    expect(current.products[0].facts.recurred.resolvedValue).toBeUndefined();
    expect(current.products[0].facts.recurred.supersededValues[0].value).toEqual(known(true));
    expect(createUnderstandingView(current).products[0].facts.recurred.history[0].value).toEqual(known(true));
    expect(createUnderstandingView(current).products[0].medicationNotice).toContain("moved to history");
    expect(projectForm3500(current).sections.D.suspectProducts[0].recurred).toBe("inapplicable");
    current = setMedication(current, "amoxicillin", { restarted: known(true) });
    expect(nextCompletionQuestion(current)?.targetIds).toEqual(["product:amoxicillin:recurred"]);
    expect(projectForm3500(current).sections.D.suspectProducts[0].recurred).toBeUndefined();
    current = ask(current);
    current = setMedication(current, "amoxicillin", { recurred: known(false) });
    current = setMedication(current, "amoxicillin", { restarted: known(false) });
    current = setMedication(current, "amoxicillin", { restarted: known(true) });
    expect(() => ask(current)).not.toThrow();
    expect(ask(current).askedNeeds.length).toBeLessThan(maximumAskedNeeds);
    current = setMedication(current, "amoxicillin", { recurred: { kind: "declined" } });
    current = setMedication(current, "amoxicillin", { restarted: known(false) });
    current = setMedication(current, "amoxicillin", { restarted: known(true) });
    expect(nextCompletionQuestion(current)?.kind).toBe("reporter");
    expect(current.products[1].facts.restarted.resolvedValue?.value).toEqual(known(false));
  });

  it("does not close a question from unreviewed proposals; partial review leaves the rest answerable", () => {
    let current = ask(medicationCase());
    const source = medicationSource("The medication was not stopped. Its dose change is unknown.", "partial-conversation");
    current = applyCaseCommand(current, { type: "attach-grounded-proposals", commandId: "partial-conversation", expectedRevision: current.revision, products: [], sources: [source],
      proposals: [{ proposalId: "stopped-answer", groupId: "stopped-answer", intent: "fact", target: { entity: "product", entityId: "amoxicillin", field: "stopped" }, value: known(false), sourceIds: [source.id] }] }).case;
    expect(current.askedNeeds[0].status).toBe("open");
    current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "accept-partial", expectedRevision: current.revision, decisions: [{ groupId: "stopped-answer", action: "accept" }] }).case;
    expect(current.askedNeeds[0].targetIds).toEqual(["product:amoxicillin:doseReduced"]);
    current = applyCaseCommand(current, { type: "record-clinician-facts", commandId: "finish-partial", expectedRevision: current.revision, source, answersNeed: "medication-history", facts: [{ id: "reduction-unknown", intent: "fact", target: { entity: "product", entityId: "amoxicillin", field: "doseReduced" }, value: unknown }] }).case;
    expect(nextCompletionQuestion(current)?.kind).toBe("reporter");
  });

  it("keeps newly applicable details in the same grouped task after partial conversation", () => {
    let current = ask(medicationCase());
    current = setMedication(current, "amoxicillin", { stopped: known(true) });
    expect(current.askedNeeds[0]).toMatchObject({ status: "open", targetIds: ["product:amoxicillin:stopDate", "product:amoxicillin:improvedAfterChange", "product:amoxicillin:restarted"] });
    current = setMedication(current, "amoxicillin", { stopDate: unknown, improvedAfterChange: unknown, restarted: known(true) });
    expect(current.askedNeeds[0]).toMatchObject({ status: "open", targetIds: ["product:amoxicillin:recurred"] });
    current = setMedication(current, "amoxicillin", { recurred: unknown });
    expect(current.askedNeeds).toHaveLength(1);
    expect(current.askedNeeds[0].status).toBe("answered");
  });

  it("retains bounded correction history beyond the old ten-need storage limit", () => {
    let current = medicationCase(true);
    for (const id of ["amoxicillin", "naproxen"]) {
      current = ask(current);
      current = setMedication(current, id, { stopped: known(true), stopDate: unknown, improvedAfterChange: unknown, restarted: known(true), recurred: known(false) });
    }
    for (let round = 0; round < 5; round++) for (const id of ["amoxicillin", "naproxen"]) {
      current = setMedication(current, id, { restarted: known(false) });
      current = setMedication(current, id, { restarted: known(true) });
      current = ask(current);
      expect(() => ask(current)).toThrow(/already recorded/);
      current = setMedication(current, id, { recurred: known(false) });
    }
    expect(current.askedNeeds).toHaveLength(12);
    expect(current.askedNeeds.every(({ status }) => status === "answered")).toBe(true);
    expect(nextCompletionQuestion(current)?.kind).toBe("reporter");
  });

  it("leaves a partially answered existing clinical-context group answerable", () => {
    let current = structuredClone(medicationCase());
    for (const field of ["relevantHistory", "relevantTestsAvailable"] as const) {
      current.event.facts[field] = { state: "empty", proposedValues: [], conflictingValues: [], supersededValues: [], sourceIds: [] };
    }
    current = ask(current);
    current = applyCaseCommand(current, { type: "record-clinician-facts", commandId: "history-partial", expectedRevision: current.revision,
      source: medicationSource("No other history", "history-partial"), facts: [{ id: "history-answer", intent: "fact", target: { entity: "event", entityId: "event", field: "relevantHistory" }, value: { kind: "explicitly-absent" } }] }).case;
    expect(current.askedNeeds[0].targetIds).toEqual(["event:event:relevantTestsAvailable"]);
    expect(nextCompletionQuestion(current)).toMatchObject({ kind: "clinical-context", askTests: true, askHistory: false });
    current = applyCaseCommand(current, { type: "record-clinician-facts", commandId: "tests-remaining", expectedRevision: current.revision,
      source: medicationSource("Tests unknown", "tests-remaining"), answersNeed: "relevant-clinical-context", facts: [{ id: "tests-answer", intent: "fact", target: { entity: "event", entityId: "event", field: "relevantTestsAvailable" }, value: unknown }] }).case;
    expect(current.askedNeeds[0].status).toBe("answered");
    expect(nextCompletionQuestion(current)?.kind).toBe("medication-history");
  });

  it("rejects answers attributed to a different medication without changing the case", () => {
    const current = ask(medicationCase(true));
    expect(() => applyCaseCommand(current, { type: "record-clinician-facts", commandId: "wrong-product", expectedRevision: current.revision,
      source: medicationSource("Unknown", "wrong-product"), answersNeed: "medication-history", facts: [
        { id: "stopped-a", intent: "fact", target: { entity: "product", entityId: "amoxicillin", field: "stopped" }, value: unknown },
        { id: "reduced-a", intent: "fact", target: { entity: "product", entityId: "amoxicillin", field: "doseReduced" }, value: unknown },
        { id: "stopped-b", intent: "fact", target: { entity: "product", entityId: "naproxen", field: "stopped" }, value: unknown },
      ] })).toThrow(/outside semantic need/);
    expect(current.products.every(({ facts }) => facts.stopped.state === "empty")).toBe(true);
  });

  it("does not proactively question other products or infer subtype from a drug name", () => {
    const current = setMedication(medicationCase(), "amoxicillin", { productType: known("other") });
    expect(nextCompletionQuestion(current)?.kind).toBe("reporter");
    expect(projectForm3500(current).sections.D.suspectProducts[0].medicationType).toBeUndefined();
    const supplied = setMedication(current, "amoxicillin", { stopped: known(true), improvedAfterChange: known(true), restarted: known(false) });
    expect(projectForm3500(supplied).sections.D.suspectProducts[0]).toMatchObject({ improvedAfterChange: true, recurred: "inapplicable" });
  });
});
