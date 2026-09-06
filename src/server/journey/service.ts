import { createSemanticCase } from "../../domain/case/create";
import { projectForm3500 } from "../../domain/case/projection";
import type { SemanticCase, Source } from "../../domain/case/types";
import {
  createClarificationView,
  createReviewView,
  createUnderstandingView,
} from "../../domain/case/views";
import {
  correctionAccount,
  fixedRecordedAt,
  indicationAnswer,
  openingAccount,
  resolutionStatement as fixedResolutionStatement,
} from "../../experiment/fixed-inputs";
import { applyCaseCommandToRepository } from "../case/apply-command";
import type { CaseRepository } from "../case/repository";
import {
  caughtErrorDetails,
  silentDiagnosticLogger,
  type RuntimeDiagnosticLogger,
} from "../diagnostics/runtime-log";
import { fixedJourneyModel } from "../model/fixed-journey";
import type { JourneyModel } from "../model/journey-model";

export type JourneyStage =
  | "describe"
  | "understanding"
  | "clarify"
  | "update"
  | "correct"
  | "output-unresolved"
  | "output-resolved";

export type JourneyAction =
  | { action: "submit-opening"; text: string; reportType: "adverse-event" }
  | { action: "accept-understanding" }
  | { action: "answer-indications"; text: string }
  | { action: "submit-correction"; text: string }
  | { action: "accept-dose-correction" }
  | { action: "leave-date-unresolved" }
  | { action: "resolve-date"; chosenValueId: "apixaban-start" | "apixaban-date-alternative" };

export interface JourneySnapshot {
  stage: JourneyStage;
  revision: number;
  understanding: ReturnType<typeof createUnderstandingView>;
  review: ReturnType<typeof createReviewView>;
  clarification: ReturnType<typeof createClarificationView>;
  projection: ReturnType<typeof projectForm3500>;
  downloadReady: boolean;
}

export async function ensureJourneyCase(repository: CaseRepository, caseId: string): Promise<SemanticCase> {
  const existing = await repository.load(caseId);
  if (existing) return existing;
  const created = createSemanticCase(caseId);
  await repository.create(created);
  return created;
}

export async function getJourneySnapshot(repository: CaseRepository, caseId: string): Promise<JourneySnapshot> {
  const caseState = await ensureJourneyCase(repository, caseId);
  const stage = stageFor(caseState);
  return {
    stage,
    revision: caseState.revision,
    understanding: createUnderstandingView(caseState),
    review: createReviewView(caseState),
    clarification: createClarificationView(caseState),
    projection: projectForm3500(caseState),
    downloadReady: stage === "output-resolved",
  };
}

export async function performJourneyAction(
  repository: CaseRepository,
  caseId: string,
  action: JourneyAction,
  model: JourneyModel = fixedJourneyModel,
  diagnostics: RuntimeDiagnosticLogger = silentDiagnosticLogger,
): Promise<JourneySnapshot> {
  let current = await ensureJourneyCase(repository, caseId);
  const expectedStage = stageFor(current);
  diagnostics.event("state-transition", "action-dispatch", "start", {
    action: diagnosticAction(action),
    current: { stage: expectedStage, revision: current.revision },
  });

  const applyCommand = async (command: Parameters<typeof applyCaseCommandToRepository>[2]) => {
    const before = { stage: stageFor(current), revision: current.revision };
    diagnostics.event("case-command", command.type, "start", { command, before });
    try {
      current = await applyCaseCommandToRepository(repository, caseId, command);
    } catch (error) {
      diagnostics.event("case-command", command.type, "failure", {
        command,
        before,
        error: caughtErrorDetails(error),
      });
      throw error;
    }
    diagnostics.event("case-command", command.type, "success", {
      commandId: command.commandId,
      after: { stage: stageFor(current), revision: current.revision },
      caseState: diagnosticCaseState(current),
    });
    diagnostics.event("state-transition", command.commandId, "success", {
      before,
      after: { stage: stageFor(current), revision: current.revision },
    });
  };

  try {
    switch (action.action) {
    case "submit-opening":
      requireStage(expectedStage, "describe");
      const opening = await proposeWithDiagnostics(model, "opening", action.text, diagnostics);
      await applyCommand({
        type: "attach-grounded-proposals",
        commandId: "command-attach-opening",
        expectedRevision: current.revision,
        ...opening.envelope,
      });
      await applyCommand({
        type: "record-clinician-facts",
        commandId: "command-record-report-type",
        expectedRevision: current.revision,
        source: fullSource("source-report-type", "input-report-type", "selection", "Adverse event"),
        facts: [{
          id: "report-type-adverse-event",
          target: { entity: "event", entityId: "event", field: "reportType" },
          intent: "fact",
          value: { kind: "known", value: action.reportType },
        }],
      });
      break;
    case "accept-understanding":
      requireStage(expectedStage, "understanding");
      await applyCommand({
        type: "review-proposal-groups",
        commandId: "command-review-opening",
        expectedRevision: current.revision,
        decisions: [
          { groupId: "patient", action: "accept" },
          { groupId: "event", action: "accept" },
          { groupId: "product-apixaban", action: "accept" },
          { groupId: "product-naproxen", action: "accept" },
          { groupId: "product-lisinopril", action: "accept" },
        ],
      });
      await applyCommand({
        type: "record-asked-need",
        commandId: "command-ask-indications",
        expectedRevision: current.revision,
        key: "suspect-product-indications",
        productIds: ["product-apixaban", "product-naproxen"],
      });
      break;
    case "answer-indications": {
      requireStage(expectedStage, "clarify");
      if (action.text !== indicationAnswer) throw new Error("Use the displayed fictional indication answer");
      const source = fullSource("source-indication-answer", "input-indication-answer", "answer", action.text);
      await applyCommand({
        type: "record-clinician-facts",
        commandId: "command-answer-indications",
        expectedRevision: current.revision,
        source,
        answersNeed: "suspect-product-indications",
        facts: [
          {
            id: "answer-apixaban-indication",
            target: { entity: "product", entityId: "product-apixaban", field: "indication" },
            intent: "fact",
            value: { kind: "known", value: "postoperative VTE prophylaxis after knee replacement" },
          },
          {
            id: "answer-naproxen-indication",
            target: { entity: "product", entityId: "product-naproxen", field: "indication" },
            intent: "fact",
            value: { kind: "known", value: "postoperative pain" },
          },
        ],
      });
      break;
    }
    case "submit-correction":
      requireStage(expectedStage, "update");
      const correction = await proposeWithDiagnostics(model, "correction", action.text, diagnostics);
      await applyCommand({
        type: "attach-grounded-proposals",
        commandId: "command-attach-correction",
        expectedRevision: current.revision,
        ...correction.envelope,
      });
      break;
    case "accept-dose-correction":
      requireStage(expectedStage, "correct");
      await applyCommand({
        type: "review-proposal-groups",
        commandId: "command-review-dose-correction",
        expectedRevision: current.revision,
        decisions: [{ groupId: "naproxen-dose-correction", action: "accept" }],
      });
      break;
    case "leave-date-unresolved":
      requireStage(expectedStage, "correct");
      if (hasPendingDoseCorrection(current)) {
        throw new Error("Accept or reject the dose correction before continuing");
      }
      await applyCommand({
        type: "review-proposal-groups",
        commandId: "command-record-date-conflict",
        expectedRevision: current.revision,
        decisions: [{ groupId: "apixaban-date-conflict", action: "accept" }],
      });
      break;
    case "resolve-date":
      if (expectedStage === "correct") {
        if (hasPendingDoseCorrection(current)) {
          throw new Error("Accept or reject the dose correction before resolving the date");
        }
        await applyCommand({
          type: "review-proposal-groups",
          commandId: "command-record-date-conflict",
          expectedRevision: current.revision,
          decisions: [{ groupId: "apixaban-date-conflict", action: "accept" }],
        });
      } else {
        requireStage(expectedStage, "output-unresolved");
      }
      const resolutionStatement = action.chosenValueId === "apixaban-date-alternative"
        ? fixedResolutionStatement
        : "Use 12-Aug-2026 as the apixaban start date.";
      await applyCommand({
        type: "resolve-conflict",
        commandId: "command-resolve-apixaban-date",
        expectedRevision: current.revision,
        target: { entity: "product", entityId: "product-apixaban", field: "startDate" },
        chosenValueId: action.chosenValueId,
        source: fullSource("source-date-resolution", "input-date-resolution", "resolution", resolutionStatement),
      });
      break;
    }
  } catch (error) {
    diagnostics.event("state-transition", "action-dispatch", "failure", {
      action: diagnosticAction(action),
      retained: { stage: stageFor(current), revision: current.revision },
      error: caughtErrorDetails(error),
    });
    throw error;
  }

  const snapshot = await getJourneySnapshot(repository, caseId);
  diagnostics.event("state-transition", "action-complete", "success", {
    action: action.action,
    result: snapshot,
  });
  return snapshot;
}

async function proposeWithDiagnostics(
  model: JourneyModel,
  turn: "opening" | "correction",
  text: string,
  diagnostics: RuntimeDiagnosticLogger,
) {
  diagnostics.event("model", "request", "start", { turn, input: diagnosticInput(text) });
  try {
    const result = await model.propose(turn, text);
    diagnostics.event("model", "response", "success", { turn, output: result });
    diagnostics.event("schema-domain", "proposal-envelope", "success", {
      turn,
      products: result.envelope.products,
      proposals: result.envelope.proposals,
      sources: result.envelope.sources,
    });
    return result;
  } catch (error) {
    diagnostics.event("schema-domain", "proposal-envelope", "rejected", {
      turn,
      error: caughtErrorDetails(error),
    });
    diagnostics.event("model", "response", "failure", {
      turn,
      error: caughtErrorDetails(error),
    });
    throw error;
  }
}

function diagnosticAction(action: JourneyAction): unknown {
  if (!("text" in action)) return action;
  const fixedText = action.text === openingAccount
    || action.text === indicationAnswer
    || action.text === correctionAccount;
  return fixedText ? action : { ...action, text: "[NOT LOGGED: outside fixed synthetic fixture]" };
}

function diagnosticInput(text: string): string {
  return text === openingAccount || text === indicationAnswer || text === correctionAccount
    ? text
    : "[NOT LOGGED: outside fixed synthetic fixture]";
}

function diagnosticCaseState(caseState: SemanticCase): Omit<SemanticCase, "id"> {
  const { id: _cookieDerivedCaseId, ...diagnosticState } = caseState;
  return diagnosticState;
}

function stageFor(caseState: SemanticCase): JourneyStage {
  if (caseState.revision === 0) return "describe";
  if (caseState.patient.state === "proposed") return "understanding";
  const indicationNeed = caseState.askedNeeds.find(({ key }) => key === "suspect-product-indications");
  if (!indicationNeed || indicationNeed.status === "open") return "clarify";
  if (!caseState.sources.some(({ inputId }) => inputId === "input-correction")) return "update";
  if (caseState.products.some(({ facts }) => facts.dose.proposedValues.length > 0 || facts.startDate.proposedValues.length > 0)) {
    return "correct";
  }
  const apixaban = caseState.products.find(({ id }) => id === "product-apixaban");
  return apixaban?.facts.startDate.state === "conflicted" ? "output-unresolved" : "output-resolved";
}

function hasPendingDoseCorrection(caseState: SemanticCase): boolean {
  return caseState.products.some(({ facts }) => facts.dose.proposedValues.some(({ intent }) => intent === "correction"));
}

function requireStage(actual: JourneyStage, expected: JourneyStage): void {
  if (actual !== expected) throw new Error(`This action is not available during ${actual}`);
}

function fullSource(
  id: string,
  inputId: string,
  inputType: Source["inputType"],
  excerpt: string,
): Source {
  return {
    id,
    inputId,
    inputType,
    excerpt,
    start: 0,
    end: excerpt.length,
    actor: "clinician",
    recordedAt: fixedRecordedAt,
  };
}

export const fixedJourneyInputs = {
  openingAccount,
  indicationAnswer,
  correctionAccount,
};
