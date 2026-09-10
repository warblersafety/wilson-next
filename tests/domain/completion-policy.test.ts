import { describe, expect, it } from "vitest";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { nextCompletionQuestion } from "../../src/domain/case/completion-policy";
import { createSemanticCase } from "../../src/domain/case/create";
import type { CaseValue, EventFactKey, SemanticCase, Source } from "../../src/domain/case/types";
import { acceptOpeningCase, answerIndications } from "./fixture";

describe("bounded medication completion policy", () => {
  it("uses accepted facts to order applicable groups and does not ask for recognized tests", () => {
    let current = answerIndications(acceptOpeningCase());
    expect(nextCompletionQuestion(current)).toMatchObject({ key: "serious-outcomes", kind: "serious-outcomes" });
    current = answerOutcomes(current, []);
    expect(nextCompletionQuestion(current)).toMatchObject({
      key: "relevant-clinical-context",
      kind: "clinical-context",
      askTests: false,
      askHistory: true,
      targetIds: ["event:event:relevantHistory"],
    });
    current = answerCurrent(current, "relevant-clinical-context", [{
      target: { entity: "event", entityId: "event", field: "relevantHistory" },
      value: { kind: "declined" },
    }]);
    expect(nextCompletionQuestion(current)?.key).toBe("reporter-details");
    expect(current.askedNeeds.map(({ key }) => key)).toEqual([
      "suspect-product-indications", "serious-outcomes", "relevant-clinical-context",
    ]);
  });

  it("opens the death date only when death is selected and retains unknown without looping", () => {
    let current = answerIndications(acceptOpeningCase());
    current = answerOutcomes(current, ["death"]);
    expect(nextCompletionQuestion(current)).toMatchObject({
      key: "death-date",
      targetIds: ["event:event:deathDate"],
    });
    current = answerCurrent(current, "death-date", [{
      target: { entity: "event", entityId: "event", field: "deathDate" },
      value: { kind: "unknown" },
    }]);
    expect(nextCompletionQuestion(current)?.key).toBe("relevant-clinical-context");
    expect(current.event.facts.deathDate.resolvedValue?.value).toEqual({ kind: "unknown" });
  });

  it("rejects attempts to record a later or unrelated need out of order", () => {
    const current = acceptOpeningCase();
    expect(() => applyCaseCommand(current, {
      type: "record-asked-need",
      commandId: "skip-to-reporter",
      expectedRevision: current.revision,
      key: "reporter-details",
      targetIds: ["reporter:reporter:firstName"],
    })).toThrow("not the next applicable question");
  });

  it("reopens an indication question only for a product whose later correction makes it suspect", () => {
    let current = answerIndications(acceptOpeningCase());
    const text = "Lisinopril should be treated as a suspect product.";
    current = applyCaseCommand(current, {
      type: "attach-grounded-proposals",
      commandId: "attach-role-correction",
      expectedRevision: current.revision,
      products: [],
      relevantTests: [],
      sources: [{
        id: "source-role-correction", inputId: "input-role-correction", inputType: "correction",
        excerpt: text, start: 0, end: text.length, actor: "clinician", recordedAt: "2026-09-10T00:00:00.000Z",
      }],
      proposals: [{
        proposalId: "proposal-role-correction", groupId: "group-role-correction", intent: "correction",
        target: { entity: "product", entityId: "product-lisinopril", field: "role" },
        value: { kind: "known", value: "suspect" }, sourceIds: ["source-role-correction"],
      }],
    }).case;
    current = applyCaseCommand(current, {
      type: "review-proposal-groups", commandId: "accept-role-correction", expectedRevision: current.revision,
      decisions: [{ groupId: "group-role-correction", action: "accept" }],
    }).case;

    expect(nextCompletionQuestion(current)).toMatchObject({
      key: "suspect-product-indications",
      status: "new",
      productIds: ["product-lisinopril"],
      targetIds: ["product:product-lisinopril:indication"],
    });
    const askedAgain = applyCaseCommand(current, {
      type: "record-asked-need", commandId: "ask-new-indication", expectedRevision: current.revision,
      key: "suspect-product-indications", targetIds: ["product:product-lisinopril:indication"],
    }).case;
    expect(askedAgain.askedNeeds.filter(({ key }) => key === "suspect-product-indications")).toHaveLength(2);
  });

  it("routes a product-problem-only report directly to reporter details", () => {
    const problem = "Unopened tablets contained visible particles.";
    const source: Source = {
      id: "source-product-problem", inputId: "input-product-problem", inputType: "narrative",
      excerpt: problem, start: 0, end: problem.length, actor: "clinician", recordedAt: "2026-09-10T00:00:00.000Z",
    };
    let current = applyCaseCommand(createSemanticCase("case-product-problem"), {
      type: "attach-grounded-proposals", commandId: "attach-product-problem", expectedRevision: 0,
      products: [{ id: "product-tablets", groupId: "product-tablets" }], sources: [source],
      proposals: [
        { proposalId: "problem", groupId: "event", intent: "fact", target: { entity: "event", entityId: "event", field: "problemDescription" }, value: { kind: "known", value: problem }, sourceIds: [source.id] },
        { proposalId: "name", groupId: "product-tablets", intent: "fact", target: { entity: "product", entityId: "product-tablets", field: "name" }, value: { kind: "known", value: "Test tablets" }, sourceIds: [source.id] },
        { proposalId: "type", groupId: "product-tablets", intent: "fact", target: { entity: "product", entityId: "product-tablets", field: "productType" }, value: { kind: "known", value: "drug-or-biologic" }, sourceIds: [source.id] },
        { proposalId: "role", groupId: "product-tablets", intent: "fact", target: { entity: "product", entityId: "product-tablets", field: "role" }, value: { kind: "known", value: "suspect" }, sourceIds: [source.id] },
      ],
    }).case;
    const selection = "Product problem";
    current = applyCaseCommand(current, {
      type: "record-clinician-facts", commandId: "select-product-problem", expectedRevision: current.revision,
      source: { id: "source-product-problem-type", inputId: "input-product-problem-type", inputType: "selection", excerpt: selection, start: 0, end: selection.length, actor: "clinician", recordedAt: "2026-09-10T00:00:00.000Z" },
      facts: [{ id: "product-problem-type", target: { entity: "event", entityId: "event", field: "reportType" }, intent: "fact", value: { kind: "known", value: "product-problem" } }],
    }).case;
    current = applyCaseCommand(current, {
      type: "review-proposal-groups", commandId: "review-product-problem", expectedRevision: current.revision,
      decisions: [{ groupId: "patient", action: "accept" }, { groupId: "event", action: "accept" }, { groupId: "product-tablets", action: "accept" }],
    }).case;

    expect(nextCompletionQuestion(current)).toMatchObject({ key: "reporter-details", kind: "reporter" });
  });
});

function answerOutcomes(caseState: SemanticCase, selected: EventFactKey[]): SemanticCase {
  const question = nextCompletionQuestion(caseState);
  if (question?.key !== "serious-outcomes") throw new Error("Expected serious outcomes");
  return answerCurrent(caseState, "serious-outcomes", question.targetIds.map((target) => {
    const field = target.split(":")[2] as EventFactKey;
    return { target: { entity: "event" as const, entityId: "event" as const, field }, value: { kind: "known" as const, value: selected.includes(field) } };
  }));
}

function answerCurrent(
  caseState: SemanticCase,
  key: "serious-outcomes" | "death-date" | "relevant-clinical-context",
  facts: Array<{ target: import("../../src/domain/case/types").FactTarget; value: CaseValue<unknown> }>,
): SemanticCase {
  const question = nextCompletionQuestion(caseState);
  if (question?.key !== key) throw new Error(`Expected ${key}`);
  const asked = applyCaseCommand(caseState, {
    type: "record-asked-need", commandId: `ask-${key}`, expectedRevision: caseState.revision, key, targetIds: question.targetIds,
  }).case;
  const text = `Answer ${key}.`;
  const source: Source = { id: `source-${key}`, inputId: `input-${key}`, inputType: "answer", excerpt: text, start: 0, end: text.length, actor: "clinician", recordedAt: "2026-09-10T00:00:00.000Z" };
  return applyCaseCommand(asked, {
    type: "record-clinician-facts", commandId: `answer-${key}`, expectedRevision: asked.revision, source, answersNeed: key,
    facts: facts.map((fact, index) => ({ id: `value-${key}-${index}`, intent: "fact", ...fact })),
  }).case;
}
