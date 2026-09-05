import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import type {
  CaseValue,
  SemanticCase,
  Source,
} from "../../src/domain/case/types";
import { correctionAccount, openingAccount } from "../../src/experiment/fixed-inputs";
import { parseFixedCorrectionResponse, parseFixedOpeningResponse } from "../../src/server/model/fixed-journey";

export { correctionAccount, openingAccount };

const at = "2026-09-05T20:00:00.000Z";

function known<T>(value: T): CaseValue<T> {
  return { kind: "known", value };
}

export function createOpeningCase(): SemanticCase {
  return applyCaseCommand(createSemanticCase("case-test-57"), {
    type: "attach-grounded-proposals",
    commandId: "command-attach-opening",
    expectedRevision: 0,
    ...parseFixedOpeningResponse(openingAccount),
  }).case;
}

export function acceptOpeningCase(caseState = createOpeningCase()): SemanticCase {
  const reportTypeText = "Adverse event";
  const withReportType = applyCaseCommand(caseState, {
    type: "record-clinician-facts",
    commandId: "command-record-report-type",
    expectedRevision: caseState.revision,
    source: {
      id: "source-report-type",
      inputId: "input-report-type",
      inputType: "selection",
      excerpt: reportTypeText,
      start: 0,
      end: reportTypeText.length,
      actor: "clinician",
      recordedAt: at,
    },
    facts: [{
      id: "report-type-adverse-event",
      target: { entity: "event", entityId: "event", field: "reportType" },
      intent: "fact",
      value: known("adverse-event"),
    }],
  }).case;
  return applyCaseCommand(withReportType, {
    type: "review-proposal-groups",
    commandId: "command-review-opening",
    expectedRevision: withReportType.revision,
    decisions: [
      { groupId: "patient", action: "accept" },
      { groupId: "event", action: "accept" },
      { groupId: "product-apixaban", action: "accept" },
      { groupId: "product-naproxen", action: "accept" },
      { groupId: "product-lisinopril", action: "accept" },
    ],
  }).case;
}

export function answerIndications(caseState: SemanticCase): SemanticCase {
  const question = applyCaseCommand(caseState, {
    type: "record-asked-need",
    commandId: "command-ask-indications",
    expectedRevision: caseState.revision,
    key: "suspect-product-indications",
    productIds: ["product-apixaban", "product-naproxen"],
  }).case;
  const text = "Apixaban was for postoperative VTE prophylaxis after knee replacement. Naproxen was for postoperative pain.";
  const source: Source = {
    id: "source-indication-answer",
    inputId: "input-indication-answer",
    inputType: "answer",
    excerpt: text,
    start: 0,
    end: text.length,
    actor: "clinician",
    recordedAt: at,
  };
  return applyCaseCommand(question, {
    type: "record-clinician-facts",
    commandId: "command-answer-indications",
    expectedRevision: question.revision,
    source,
    answersNeed: "suspect-product-indications",
    facts: [
      {
        id: "answer-apixaban-indication",
        target: { entity: "product", entityId: "product-apixaban", field: "indication" },
        intent: "fact",
        value: known("postoperative VTE prophylaxis after knee replacement"),
      },
      {
        id: "answer-naproxen-indication",
        target: { entity: "product", entityId: "product-naproxen", field: "indication" },
        intent: "fact",
        value: known("postoperative pain"),
      },
    ],
  }).case;
}

export function attachCorrectionAndContradiction(caseState: SemanticCase): SemanticCase {
  return applyCaseCommand(caseState, {
    type: "attach-grounded-proposals",
    commandId: "command-attach-correction",
    expectedRevision: caseState.revision,
    ...parseFixedCorrectionResponse(correctionAccount),
  }).case;
}

export function acceptCorrectionAndConflict(caseState: SemanticCase): SemanticCase {
  return applyCaseCommand(caseState, {
    type: "review-proposal-groups",
    commandId: "command-review-correction",
    expectedRevision: caseState.revision,
    decisions: [
      { groupId: "naproxen-dose-correction", action: "accept" },
      { groupId: "apixaban-date-conflict", action: "accept" },
    ],
  }).case;
}

export function resolveApixabanDate(caseState: SemanticCase): SemanticCase {
  const text = "Use 13-Aug-2026 as the apixaban start date.";
  return applyCaseCommand(caseState, {
    type: "resolve-conflict",
    commandId: "command-resolve-apixaban-date",
    expectedRevision: caseState.revision,
    target: { entity: "product", entityId: "product-apixaban", field: "startDate" },
    chosenValueId: "apixaban-date-alternative",
    source: {
      id: "source-date-resolution",
      inputId: "input-date-resolution",
      inputType: "resolution",
      excerpt: text,
      start: 0,
      end: text.length,
      actor: "clinician",
      recordedAt: at,
    },
  }).case;
}

export function completeResolvedCase(): SemanticCase {
  return resolveApixabanDate(
    acceptCorrectionAndConflict(
      attachCorrectionAndContradiction(
        answerIndications(acceptOpeningCase()),
      ),
    ),
  );
}
