import { createHash, randomUUID } from "node:crypto";
import { createSemanticCase } from "../../domain/case/create";
import { projectForm3500 } from "../../domain/case/projection";
import type { CaseValue, EventFactKey, Fact, FactTarget, ReporterFactKey, SemanticCase, Source } from "../../domain/case/types";
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
  | { action: "answer-serious-outcomes"; selected: EventFactKey[]; disposition: "known" | "unknown" | "declined" }
  | { action: "answer-death-date"; value: CaseValue<string> }
  | {
      action: "answer-clinical-context";
      test?: { kind: "known"; testResult: string; lowRange?: string; highRange?: string; date?: string }
        | { kind: "explicitly-absent" | "unknown" | "declined" };
      history?: CaseValue<string>;
    }
  | {
      action: "answer-reporter";
      reporter: { kind: "declined" } | {
        kind: "provided";
        lastName: string; firstName: string; address?: string; city?: string; state?: string;
        postalCode?: string; country?: string; phone?: string; email?: string;
        healthProfessional: boolean; occupation: string;
        reportedTo: Array<"manufacturer" | "user-facility" | "distributor-importer" | "packer">;
        doNotDiscloseIdentity: boolean;
      };
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

  const ensureOpenCompletionNeed = async () => {
    const clarification = createClarificationView(current);
    if (clarification?.status !== "new") return;
    await applyCommand({
      type: "record-asked-need",
      commandId: commandId(`ask-${clarification.key}`),
      expectedRevision: current.revision,
      key: clarification.key,
      targetIds: clarification.targetIds,
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
        break;
      }
      case "answer-indications": {
        requireStage(expectedStage, "clarify");
        await ensureOpenCompletionNeed();
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
      case "answer-serious-outcomes": {
        requireStage(expectedStage, "clarify");
        if (createClarificationView(current)?.key !== "serious-outcomes") throw new Error("The serious-outcome question is no longer open");
        await ensureOpenCompletionNeed();
        const need = openNeed(current, "serious-outcomes");
        const selected = new Set(action.selected);
        const allowed = new Set(need.targetIds.map((target) => target.split(":")[2]));
        if (action.selected.some((field) => !allowed.has(field))) {
          throw new Error("A serious-outcome answer may include only the outcomes in the current question");
        }
        const answerText = action.disposition === "known"
          ? selected.size > 0 ? `Additional serious outcomes selected: ${[...selected].join(", ")}.` : "No additional serious outcomes applied."
          : action.disposition === "unknown" ? "Additional serious outcomes are unknown." : "The clinician declined to answer about additional serious outcomes.";
        await applyCommand({
          type: "record-clinician-facts",
          commandId: commandId("answer-serious-outcomes"),
          expectedRevision: current.revision,
          source: fullSource("answer", answerText),
          answersNeed: "serious-outcomes",
          facts: need.targetIds.map((target, index) => {
            const field = target.split(":")[2] as EventFactKey;
            return {
              id: valueId(`serious-outcome-${index}`),
              target: { entity: "event" as const, entityId: "event" as const, field },
              intent: "fact" as const,
              value: action.disposition === "known"
                ? { kind: "known" as const, value: selected.has(field) }
                : { kind: action.disposition as "unknown" | "declined" },
            };
          }),
        });
        break;
      }
      case "answer-death-date": {
        requireStage(expectedStage, "clarify");
        if (createClarificationView(current)?.key !== "death-date") throw new Error("The death-date question is no longer open");
        await ensureOpenCompletionNeed();
        await applyCommand({
          type: "record-clinician-facts",
          commandId: commandId("answer-death-date"),
          expectedRevision: current.revision,
          source: fullSource("answer", `Death date: ${displayValue(action.value)}.`),
          answersNeed: "death-date",
          facts: [{ id: valueId("death-date"), target: { entity: "event", entityId: "event", field: "deathDate" }, intent: "fact", value: action.value }],
        });
        break;
      }
      case "answer-clinical-context": {
        requireStage(expectedStage, "clarify");
        const question = createClarificationView(current);
        if (question?.key !== "relevant-clinical-context") throw new Error("The clinical-context question is no longer open");
        await ensureOpenCompletionNeed();
        const sourceText = clinicalContextSource(action);
        const source = fullSource("answer", sourceText);
        const facts: Array<{ id: string; target: FactTarget; intent: "fact"; value: CaseValue<unknown> }> = [];
        const relevantTests: Array<{ id: string; groupId: string }> = [];
        if (question.askTests) {
          if (!action.test) throw new Error("The relevant-test answer is required");
          if (action.test.kind === "known") {
            const testId = `test-${randomUUID()}`;
            relevantTests.push({ id: testId, groupId: `group-${testId}` });
            facts.push(
              { id: valueId("tests-available"), target: { entity: "event", entityId: "event", field: "relevantTestsAvailable" }, intent: "fact", value: { kind: "known", value: true } },
              { id: valueId("test-result"), target: { entity: "test", entityId: testId, field: "testResult" }, intent: "fact", value: { kind: "known", value: action.test.testResult } },
            );
            for (const field of ["lowRange", "highRange", "date"] as const) {
              const value = action.test[field];
              if (value) facts.push({ id: valueId(`test-${field}`), target: { entity: "test", entityId: testId, field }, intent: "fact", value: { kind: "known", value } });
            }
          } else {
            facts.push({ id: valueId("tests-availability"), target: { entity: "event", entityId: "event", field: "relevantTestsAvailable" }, intent: "fact", value: { kind: action.test.kind } });
          }
        }
        if (question.askHistory) {
          if (!action.history) throw new Error("The relevant-history answer is required");
          facts.push({ id: valueId("relevant-history"), target: { entity: "event", entityId: "event", field: "relevantHistory" }, intent: "fact", value: action.history });
        }
        await applyCommand({
          type: "record-clinician-facts",
          commandId: commandId("answer-clinical-context"), expectedRevision: current.revision,
          source, relevantTests, answersNeed: "relevant-clinical-context", facts,
        });
        break;
      }
      case "answer-reporter": {
        requireStage(expectedStage, "clarify");
        if (createClarificationView(current)?.key !== "reporter-details") throw new Error("The reporter question is no longer open");
        await ensureOpenCompletionNeed();
        const source = fullSource("reporter-entry", reporterSource(action.reporter));
        const facts = reporterFacts(action.reporter);
        await applyCommand({
          type: "record-clinician-facts", commandId: commandId("answer-reporter"), expectedRevision: current.revision,
          source, answersNeed: "reporter-details", facts,
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
    || caseState.products.some(({ state }) => state === "proposed")
    || caseState.relevantTests.some(({ state }) => state === "proposed")) return "understanding";
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
    ...caseState.relevantTests.filter(({ state }) => state === "proposed").map(({ proposalGroupId }) => proposalGroupId),
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
  for (const test of caseState.relevantTests) {
    for (const field of Object.keys(test.facts) as Array<keyof typeof test.facts>) {
      result.push({ target: { entity: "test", entityId: test.id, field }, fact: test.facts[field] });
    }
  }
  for (const field of Object.keys(caseState.reporter.facts) as Array<keyof typeof caseState.reporter.facts>) {
    result.push({ target: { entity: "reporter", entityId: "reporter", field }, fact: caseState.reporter.facts[field] });
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
  if (target.entity === "reporter") return `the reporter ${target.field}`;
  if (target.entity === "test") return `the relevant test ${target.field}`;
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

function openNeed(caseState: SemanticCase, key: import("../../domain/case/types").SemanticNeedKey) {
  const need = caseState.askedNeeds.find((candidate) => candidate.key === key && candidate.status === "open");
  if (!need) throw new Error(`The ${key} question is no longer open`);
  return need;
}

function clinicalContextSource(action: Extract<JourneyAction, { action: "answer-clinical-context" }>): string {
  const parts: string[] = [];
  if (action.test) {
    parts.push(action.test.kind === "known"
      ? `Relevant test: ${action.test.testResult}${action.test.lowRange ? `; low range ${action.test.lowRange}` : ""}${action.test.highRange ? `; high range ${action.test.highRange}` : ""}${action.test.date ? `; date ${action.test.date}` : ""}.`
      : `Relevant tests: ${action.test.kind.replaceAll("-", " ")}.`);
  }
  if (action.history) parts.push(`Relevant history: ${displayValue(action.history)}.`);
  if (parts.length === 0) throw new Error("A clinical-context answer is required");
  return parts.join(" ");
}

function reporterSource(reporter: Extract<JourneyAction, { action: "answer-reporter" }>["reporter"]): string {
  if (reporter.kind === "declined") return "The clinician declined to provide reporter details.";
  return [
    `Reporter: ${reporter.firstName} ${reporter.lastName}.`,
    reporter.address ? `Address: ${reporter.address}.` : "Address not provided.",
    reporter.city ? `City: ${reporter.city}.` : "City not provided.",
    reporter.state ? `State or region: ${reporter.state}.` : "State or region not provided.",
    reporter.postalCode ? `Postal code: ${reporter.postalCode}.` : "Postal code not provided.",
    reporter.country ? `Country: ${reporter.country}.` : "Country not provided.",
    reporter.phone ? `Phone: ${reporter.phone}.` : "Phone not provided.",
    reporter.email ? `Email: ${reporter.email}.` : "Email not provided.",
    `Health professional: ${reporter.healthProfessional ? "yes" : "no"}.`,
    `Occupation: ${reporter.occupation}.`,
    `Also reported to: ${reporter.reportedTo.length > 0 ? reporter.reportedTo.join(", ") : "none"}.`,
    `Do not disclose identity: ${reporter.doNotDiscloseIdentity ? "yes" : "no"}.`,
  ].join(" ");
}

function reporterFacts(reporter: Extract<JourneyAction, { action: "answer-reporter" }>["reporter"]): Array<{
  id: string;
  target: { entity: "reporter"; entityId: "reporter"; field: ReporterFactKey };
  intent: "fact";
  value: CaseValue<unknown>;
}> {
  const fact = (field: ReporterFactKey, value: CaseValue<unknown>) => ({
    id: valueId(`reporter-${field}`),
    target: { entity: "reporter" as const, entityId: "reporter" as const, field },
    intent: "fact" as const,
    value,
  });
  if (reporter.kind === "declined") {
    return (["lastName", "firstName", "address", "city", "state", "postalCode", "country", "phone", "email", "healthProfessional", "occupation", "reportedTo", "doNotDiscloseIdentity"] as ReporterFactKey[])
      .map((field) => fact(field, { kind: "declined" }));
  }
  if (!reporter.firstName.trim() || !reporter.lastName.trim() || !reporter.occupation.trim()
    || (!reporter.phone?.trim() && !reporter.email?.trim())) {
    throw new Error("Reporter details require a name, occupation, and either phone or email");
  }
  const facts = [
    fact("lastName", { kind: "known", value: reporter.lastName }),
    fact("firstName", { kind: "known", value: reporter.firstName }),
    fact("phone", reporter.phone ? { kind: "known", value: reporter.phone } : { kind: "explicitly-absent" }),
    fact("email", reporter.email ? { kind: "known", value: reporter.email } : { kind: "explicitly-absent" }),
    fact("healthProfessional", { kind: "known", value: reporter.healthProfessional }),
    fact("occupation", { kind: "known", value: reporter.occupation }),
    fact("reportedTo", { kind: "known", value: reporter.reportedTo }),
    fact("doNotDiscloseIdentity", { kind: "known", value: reporter.doNotDiscloseIdentity }),
  ];
  for (const field of ["address", "city", "state", "postalCode", "country"] as const) {
    facts.push(fact(field, reporter[field]?.trim()
      ? { kind: "known", value: reporter[field].trim() }
      : { kind: "explicitly-absent" }));
  }
  return facts;
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
