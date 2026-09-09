import { createHash, randomUUID } from "node:crypto";
import { createSemanticCase } from "../../domain/case/create";
import { projectForm3500 } from "../../domain/case/projection";
import type { CaseValue, Fact, FactTarget, SemanticCase, Source } from "../../domain/case/types";
import {
  createClarificationView,
  createReviewView,
  createUnderstandingView,
} from "../../domain/case/views";
import { applyCaseCommandToRepository } from "../case/apply-command";
import type { CaseRepository } from "../case/repository";
import {
  caughtErrorDetails,
  silentDiagnosticLogger,
  type RuntimeDiagnosticLogger,
} from "../diagnostics/runtime-log";
import { createAnthropicJourneyModel } from "../model/anthropic-journey";
import {
  ModelCallFailure,
  type JourneyModel,
  type ReviewedCaseModelContext,
} from "../model/journey-model";
import { createReviewedCaseModelContext } from "../model/reviewed-case-context";

export type JourneyStage = "describe" | "understanding" | "clarify" | "review-update" | "output";

export type JourneyAction =
  | { action: "submit-opening"; text: string; reportType: "adverse-event" }
  | {
      action: "change-proposal";
      groupId: string;
      proposalId: string;
      value: CaseValue<unknown>;
      statement: string;
    }
  | { action: "reject-group"; groupId: string }
  | { action: "accept-understanding" }
  | {
      action: "answer-indications";
      answers: Array<{ productId: string; value: CaseValue<string> }>;
    }
  | { action: "submit-update"; text: string }
  | { action: "review-update-group"; groupId: string; decision: "accept" | "reject" }
  | { action: "resolve-conflict"; target: string; chosenValueId: string };

export interface JourneySnapshot {
  stage: JourneyStage;
  revision: number;
  understanding: ReturnType<typeof createUnderstandingView>;
  review: ReturnType<typeof createReviewView>;
  clarification: ReturnType<typeof createClarificationView>;
  projection: ReturnType<typeof projectForm3500>;
  downloadReady: boolean;
  outputIssues: string[];
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
  const projection = projectForm3500(caseState);
  const outputIssues = outputReadinessIssues(caseState, projection);
  return {
    stage: stageFor(caseState),
    revision: caseState.revision,
    understanding: createUnderstandingView(caseState),
    review: createReviewView(caseState),
    clarification: createClarificationView(caseState),
    projection,
    downloadReady: outputIssues.length === 0,
    outputIssues,
  };
}

export async function performJourneyAction(
  repository: CaseRepository,
  caseId: string,
  action: JourneyAction,
  model: JourneyModel = createAnthropicJourneyModel(),
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

  const ensureOpenIndicationNeed = async () => {
    const clarification = createClarificationView(current);
    if (clarification?.status !== "new") return;
    await applyCommand({
      type: "record-asked-need",
      commandId: commandId("ask-indications"),
      expectedRevision: current.revision,
      key: clarification.key,
      productIds: clarification.productIds,
    });
  };

  try {
    switch (action.action) {
      case "submit-opening": {
        requireStage(expectedStage, "describe");
        const opening = await proposeWithDiagnostics(model, "opening", action.text, diagnostics);
        await applyCommand({
          type: "attach-grounded-proposals",
          commandId: commandId("attach-opening"),
          expectedRevision: current.revision,
          ...opening.envelope,
        });
        const reportTypeText = "Adverse event";
        await applyCommand({
          type: "record-clinician-facts",
          commandId: commandId("record-report-type"),
          expectedRevision: current.revision,
          source: fullSource("selection", reportTypeText),
          facts: [{
            id: valueId("report-type"),
            target: { entity: "event", entityId: "event", field: "reportType" },
            intent: "fact",
            value: { kind: "known", value: action.reportType },
          }],
        });
        break;
      }
      case "change-proposal": {
        requireStage(expectedStage, "understanding");
        if (!findProposal(current, action.groupId, action.proposalId)) {
          throw new Error("The proposed value is no longer available");
        }
        if (!action.statement.trim()) throw new Error("A correction statement is required");
        await applyCommand({
          type: "review-proposal-groups",
          commandId: commandId("change-proposal"),
          expectedRevision: current.revision,
          decisions: [{
            groupId: action.groupId,
            action: "accept",
            corrections: [{
              proposalId: action.proposalId,
              replacementId: valueId("corrected"),
              value: action.value,
              source: fullSource("correction", action.statement),
            }],
          }],
        });
        break;
      }
      case "reject-group":
        requireStage(expectedStage, "understanding");
        await applyCommand({
          type: "review-proposal-groups",
          commandId: commandId("reject-group"),
          expectedRevision: current.revision,
          decisions: [{ groupId: action.groupId, action: "reject" }],
        });
        break;
      case "accept-understanding": {
        requireStage(expectedStage, "understanding");
        const groups = pendingOpeningGroups(current);
        if (groups.length > 0) {
          await applyCommand({
            type: "review-proposal-groups",
            commandId: commandId("review-opening"),
            expectedRevision: current.revision,
            decisions: groups.map((groupId) => ({ groupId, action: "accept" as const })),
          });
        }
        await ensureOpenIndicationNeed();
        break;
      }
      case "answer-indications": {
        requireStage(expectedStage, "clarify");
        await ensureOpenIndicationNeed();
        const need = current.askedNeeds.find(({ key, status }) => key === "suspect-product-indications" && status === "open");
        if (!need) throw new Error("The indication question is no longer open");
        const answerText = action.answers.map(({ productId, value }) => {
          const product = current.products.find(({ id }) => id === productId);
          const name = knownValue(product?.facts.name) ?? productId;
          return `${name} indication: ${displayValue(value)}.`;
        }).join(" ");
        const source = fullSource("answer", answerText);
        await applyCommand({
          type: "record-clinician-facts",
          commandId: commandId("answer-indications"),
          expectedRevision: current.revision,
          source,
          answersNeed: "suspect-product-indications",
          facts: action.answers.map(({ productId, value }) => ({
            id: valueId("indication-answer"),
            target: { entity: "product" as const, entityId: productId, field: "indication" as const },
            intent: "fact" as const,
            value,
          })),
        });
        break;
      }
      case "submit-update": {
        requireStage(expectedStage, "output");
        const context = createReviewedCaseModelContext(current);
        const update = await proposeWithDiagnostics(model, "correction", action.text, diagnostics, context);
        await applyCommand({
          type: "attach-grounded-proposals",
          commandId: commandId("attach-update"),
          expectedRevision: current.revision,
          ...update.envelope,
        });
        break;
      }
      case "review-update-group":
        requireStage(expectedStage, "review-update");
        await applyCommand({
          type: "review-proposal-groups",
          commandId: commandId("review-update"),
          expectedRevision: current.revision,
          decisions: [{ groupId: action.groupId, action: action.decision }],
        });
        break;
      case "resolve-conflict": {
        requireStage(expectedStage, "output");
        const target = targetFromKey(current, action.target);
        const fact = factFor(current, target);
        const chosen = fact.conflictingValues.find(({ id }) => id === action.chosenValueId);
        if (!chosen) throw new Error("The selected conflict alternative is unavailable");
        await applyCommand({
          type: "resolve-conflict",
          commandId: commandId("resolve-conflict"),
          expectedRevision: current.revision,
          target,
          chosenValueId: action.chosenValueId,
          source: fullSource("resolution", `Use ${displayValue(chosen.value)} as ${targetStatement(current, target)}.`),
        });
        break;
      }
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
  correctionContext?: ReviewedCaseModelContext,
) {
  diagnostics.event("model", "request", "start", {
    turn,
    input: diagnosticInput(text),
    ...(correctionContext ? { reviewedContext: correctionContext } : {}),
  });
  try {
    const result = await model.propose(turn, text, correctionContext);
    diagnostics.event("model", "response", "success", {
      turn,
      ...(result.diagnosticResponse === undefined ? {} : { response: result.diagnosticResponse }),
      output: { envelope: result.envelope, metrics: result.metrics, responseArtifact: result.responseArtifact },
    });
    diagnostics.event("schema-domain", "proposal-envelope", "success", {
      turn,
      products: result.envelope.products,
      proposals: result.envelope.proposals,
      sources: result.envelope.sources,
    });
    return result;
  } catch (error) {
    if (error instanceof ModelCallFailure) {
      if (error.returnedResponse === undefined) {
        diagnostics.event("model", "response", "failure", { turn, phase: error.diagnostic.phase, error: caughtErrorDetails(error) });
      } else {
        diagnostics.event("model", "response", "success", { turn, response: error.returnedResponse, metrics: error.metrics });
        const source = error.diagnostic.phase === "provider-stop" || error.diagnostic.phase === "response-capture"
          ? "model"
          : "schema-domain";
        diagnostics.event(source, error.diagnostic.phase, "rejected", { turn, error: caughtErrorDetails(error) });
      }
    } else {
      diagnostics.event("schema-domain", "model-request-input", "rejected", { turn, error: caughtErrorDetails(error) });
    }
    throw error;
  }
}

export function stageFor(caseState: SemanticCase): JourneyStage {
  if (caseState.revision === 0) return "describe";
  if (caseState.patient.state === "proposed"
    || caseState.event.state === "proposed"
    || caseState.products.some(({ state }) => state === "proposed")) return "understanding";
  if (hasPendingProposals(caseState)) return "review-update";
  if (createClarificationView(caseState)) return "clarify";
  return "output";
}

function outputReadinessIssues(
  caseState: SemanticCase,
  projection: ReturnType<typeof projectForm3500>,
): string[] {
  const issues: string[] = [];
  if (hasPendingProposals(caseState)) issues.push("Review every pending proposal before opening the form.");
  if (createClarificationView(caseState)) issues.push("Answer or decline the open consequential question before opening the form.");
  const hasSuspect = caseState.products.some((product) => product.state === "resolved"
    && knownValue(product.facts.role) === "suspect"
    && Boolean(knownValue(product.facts.name)));
  if (!hasSuspect) issues.push("Accept at least one named suspect product.");
  if (knownValue(caseState.event.facts.reportType) !== "adverse-event") issues.push("Accept the adverse-event report type.");
  if (!projection.sections.B.eventDescription) issues.push("Accept at least one event fact that contributes to the event description.");
  return issues;
}

function pendingOpeningGroups(caseState: SemanticCase): string[] {
  return [
    ...(caseState.patient.state === "proposed" ? ["patient"] : []),
    ...(caseState.event.state === "proposed" ? ["event"] : []),
    ...caseState.products.filter(({ state }) => state === "proposed").map(({ proposalGroupId }) => proposalGroupId),
  ];
}

function hasPendingProposals(caseState: SemanticCase): boolean {
  return allFacts(caseState).some(({ fact }) => fact.proposedValues.length > 0);
}

function findProposal(caseState: SemanticCase, groupId: string, proposalId: string) {
  return allFacts(caseState).find(({ fact }) => fact.proposedValues.some((value) => value.groupId === groupId && value.id === proposalId));
}

function targetFromKey(caseState: SemanticCase, key: string): FactTarget {
  const found = allFacts(caseState).find(({ target }) => targetKey(target) === key);
  if (!found) throw new Error("The selected case fact is unavailable");
  return found.target;
}

function allFacts(caseState: SemanticCase): Array<{ target: FactTarget; fact: Fact<unknown> }> {
  const result: Array<{ target: FactTarget; fact: Fact<unknown> }> = [];
  for (const field of Object.keys(caseState.patient.facts) as Array<keyof typeof caseState.patient.facts>) {
    result.push({ target: { entity: "patient", entityId: "patient", field }, fact: caseState.patient.facts[field] });
  }
  for (const field of Object.keys(caseState.event.facts) as Array<keyof typeof caseState.event.facts>) {
    result.push({ target: { entity: "event", entityId: "event", field }, fact: caseState.event.facts[field] });
  }
  for (const product of caseState.products) {
    for (const field of Object.keys(product.facts) as Array<keyof typeof product.facts>) {
      result.push({ target: { entity: "product", entityId: product.id, field }, fact: product.facts[field] });
    }
  }
  return result;
}

function factFor(caseState: SemanticCase, target: FactTarget): Fact<unknown> {
  const found = allFacts(caseState).find(({ target: candidate }) => targetKey(candidate) === targetKey(target));
  if (!found) throw new Error("The selected case fact is unavailable");
  return found.fact;
}

function targetKey(target: FactTarget): string {
  return `${target.entity}:${target.entityId}:${target.field}`;
}

function targetStatement(caseState: SemanticCase, target: FactTarget): string {
  if (target.entity === "patient") return `the patient ${target.field}`;
  if (target.entity === "event") return `the event ${target.field}`;
  const product = caseState.products.find(({ id }) => id === target.entityId);
  const name = knownValue(product?.facts.name) ?? "the selected product";
  return `the ${target.field} for ${name}`;
}

function knownValue<T>(fact: Fact<T> | undefined): T | undefined {
  const value = fact?.resolvedValue?.value;
  return value?.kind === "known" ? value.value : undefined;
}

function displayValue(value: CaseValue<unknown>): string {
  if (value.kind !== "known") return value.kind.replaceAll("-", " ");
  if (Array.isArray(value.value)) return value.value.join(" and ");
  return String(value.value);
}

function commandId(label: string): string {
  return `command-${label}-${randomUUID()}`;
}

function valueId(label: string): string {
  return `value-${label}-${randomUUID()}`;
}

function fullSource(inputType: Source["inputType"], excerpt: string): Source {
  if (!excerpt.trim()) throw new Error("Clinician input is required");
  return {
    id: `source-${randomUUID()}`,
    inputId: `input-${randomUUID()}`,
    inputType,
    excerpt,
    start: 0,
    end: excerpt.length,
    actor: "clinician",
    recordedAt: new Date().toISOString(),
  };
}

function requireStage(actual: JourneyStage, expected: JourneyStage): void {
  if (actual !== expected) throw new Error(`This action is not available during ${actual}`);
}

function diagnosticAction(action: JourneyAction): unknown {
  const sanitized = { ...action } as Record<string, unknown>;
  for (const key of ["text", "statement"]) {
    if (typeof sanitized[key] === "string") sanitized[key] = diagnosticInput(sanitized[key]);
  }
  return sanitized;
}

function diagnosticInput(text: string): string {
  const configured = new Set((process.env.WILSON_SYNTHETIC_INPUT_SHA256 ?? "").split(",").filter(Boolean));
  const digest = createHash("sha256").update(text).digest("hex");
  return configured.has(digest) ? text : "[NOT LOGGED: outside configured synthetic fixtures]";
}

function diagnosticCaseState(caseState: SemanticCase): Omit<SemanticCase, "id"> {
  const { id: _caseId, ...diagnosticState } = caseState;
  return diagnosticState;
}
