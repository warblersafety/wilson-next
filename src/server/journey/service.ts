import {d2TextIssues} from "../pdf/d2-continuation";
import {isEventDateField,eventDateLabels,isProductDateField,productDateLabels,suppliedDateText} from "../../domain/case/date-precision";
import {isPartialExpiration,expirationText} from "../../domain/case/expiration";
import {productDateTextIssues} from "../pdf/product-date-continuation";
import {isCalendarDateTarget,knownValueMismatch} from "../../domain/case/value-contract";
import {sexTextLimitation} from "../pdf/patient-sex";
import {reporterTextIssues,reporterTextLabels} from "../pdf/reporter-text";
import {concomitantTextIssues,concomitantFieldLabel} from "../pdf/concomitant";
import {deviceTextFields, deviceTextLimitation} from "../pdf/device-text";
import { narrativeGlyphLimitation } from "../pdf/narrative-continuation";
import { seriousOutcomeLabels } from "../../domain/case/serious-outcomes";
import { hasReservedNoPatientIdentifier, noPatientConflictingTargets, noPatientOutcomeConflictingTargets } from "../../domain/case/patient-involvement";
import {purchaseDetailFields,purchaseDetailLabels} from "../../domain/case/purchase-details";
import {purchaseDetailLimitation} from "../pdf/purchase-details";
import { d3ChoiceIssue, d3Eligible, isTreatmentDuration } from "../../domain/case/duration";
import { durationLimitation } from "../pdf/duration";
import { raceEthnicityOptions } from "../../domain/case/race-ethnicity";
import { patientA2ChoiceIssue } from "../../domain/case/birth-date";
import { isPatientAge, patientAgeParts } from "../../domain/case/age";
import { patientAgeLimitation } from "../pdf/patient-age";
import { createHash, randomUUID } from "node:crypto";
import { testHistoryLimitations } from "../pdf/test-history";
import { productTextLimitation } from "../pdf/product-text";
import { quantityLimitation, eventNarrativeLimitation, narrativeTextLimitation } from "../pdf/quantity";
import type { UnrepresentedModelProposal } from "../../domain/case/model-boundary";
import { maximumForm3500ConcomitantProducts, maximumForm3500SuspectProducts, form3500SuspectSlot } from "../../domain/case/limits";
import { completionQuestions } from "../../domain/case/completion-policy";
import { createSemanticCase } from "../../domain/case/create";
import { allFacts, getFact, targetFromKey, targetKey } from "../../domain/case/facts";
import { productDisplayLabel } from "../../domain/case/product-label";
import { projectForm3500, quantityContextEntries, hasBaseEventDescription, baseEventDescription, baseEventDescriptionTargets, additionalCommentsEntries, d5OtherTypeContextEntries, deviceContextEntries, eventDateContextEntries } from "../../domain/case/projection";
import type { CaseValue, Fact, FactTarget, ProductFactKey, ReporterFactKey, SemanticCase, Source } from "../../domain/case/types";
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
import {
  ModelCallFailure,
  type JourneyModel,
  type ReviewedCaseModelContext,
} from "../model/journey-model";
import { createReviewedCaseModelContext } from "../model/reviewed-case-context";
import {
  seriousOutcomeFields,
  type JourneyAction,
  type SeriousOutcomeField,
} from "./action-contract";

export type { JourneyAction } from "./action-contract";

export type JourneyStage = "describe" | "understanding" | "clarify" | "review-update" | "output";

export interface JourneySnapshot {
  stage: JourneyStage;
  revision: number;
  understanding: ReturnType<typeof createUnderstandingView>;
  review: ReturnType<typeof createReviewView>;
  clarification: ReturnType<typeof createClarificationView>;
  projection: ReturnType<typeof projectForm3500>;
  downloadReady: boolean;
  clinicalNeeds: ReturnType<typeof completionQuestions>;
  reportContentKey: string;
  outputIssues: OutputReadinessIssue[];
  transitionNotice?: string;
  unrepresented: UnrepresentedModelProposal[];
  openingGroups: string[];
}

export type OutputReadinessIssueCode =
  | "invalid-calendar-date"
  | "product-d3-choice-required" | "unsupported-treatment-duration" | "unsupported-purchase-detail"
  | "pending-proposal-review"
  | "open-clarification"
  | "incomplete-product"
  | "no-retained-product"
  | "no-complete-suspect-product"
  | "missing-report-type"
  | "missing-event-description"
  | "too-many-suspect-products"
  | "too-many-concomitant-products"
  | "multiple-suspect-devices"
  | "no-patient-report-type-conflict"
  | "reserved-no-patient-identifier"
  | "no-patient-outcomes-conflict"
  | "no-patient-demographics-conflict"
  | "patient-a2-choice-required"
  | "unsupported-patient-age"
  | "unsupported-patient-sex"
  | "unsupported-product-route"
  | "unsupported-product-text"
  | "unsupported-event-narrative"
  | "unsupported-test-history";

export interface OutputReadinessIssue {
  code: OutputReadinessIssueCode;
  message: string;
  targets: string[];
  entityIds: string[];
}

export async function ensureJourneyCase(repository: CaseRepository, caseId: string): Promise<SemanticCase> {
  const existing = await repository.load(caseId);
  if (existing) return existing;
  const created = createSemanticCase(caseId);
  await repository.create(created);
  return created;
}

export async function getJourneySnapshot(
  repository: CaseRepository,
  caseId: string,
  unrepresented: UnrepresentedModelProposal[] = [],
): Promise<JourneySnapshot> {
  const caseState = await ensureJourneyCase(repository, caseId);
  const projection = projectForm3500(caseState);
  const outputIssues = outputReadinessIssues(caseState, projection);
  for(const problem of await productDateTextIssues(projection)) outputIssues.push({code:"unsupported-product-text",message:`The reviewed ${problem.field === "expirationDate" ? "expiration wording" : productDateLabels[problem.field]} ${problem.limitation}. It is retained; no new PDF is generated.`,targets:[`product:${problem.productId}:${problem.field}`],entityIds:[problem.productId]});
  const sexLimit = await sexTextLimitation(projection);
  if (sexLimit) outputIssues.push({code:"unsupported-patient-sex",message:`The reviewed patient sex context ${sexLimit}. It is retained; no new PDF is generated.`,targets:["patient:patient:sex"],entityIds:["patient"]});
  for (const device of projection.sections.E.suspectDevices) for (const field of deviceTextFields) {
    const value = device[field.projected];
    if (value === undefined) continue;
    const limitation = await deviceTextLimitation(field.projected,value);
    if (limitation) outputIssues.push({code:"unsupported-product-text",message:`${productLabel(caseState,device.productId)}: the reviewed Section E ${field.label} ${limitation}. The wording is retained; no new PDF is generated.`,targets:[`product:${device.productId}:${field.fact}`],entityIds:[device.productId]});
  }
  for (const problem of await d2TextIssues(projection)) outputIssues.push({code:"unsupported-product-text",message:`${productLabel(caseState,problem.productId)}: the reviewed D2 ${problem.field} ${problem.limitation}. The wording is retained; no new PDF is generated.`,targets:[`product:${problem.productId}:${problem.field}`],entityIds:[problem.productId]});
  for (const problem of await concomitantTextIssues(projection)) outputIssues.push({code:"unsupported-product-text", message:`${productLabel(caseState,problem.productId)}: the reviewed Section F ${concomitantFieldLabel(problem.field)} ${problem.limitation}. The wording is retained; no new PDF is generated.`, targets:[`product:${problem.productId}:${problem.field}`], entityIds:[problem.productId]});
  for (const problem of await reporterTextIssues(projection)) outputIssues.push({code:"unsupported-product-text",message:`The reviewed reporter ${reporterTextLabels[problem.field]} ${problem.limitation}. The wording is retained; no new PDF is generated.`,targets:[`reporter:reporter:${problem.field}`],entityIds:["reporter"]});
  const baseLimitation = await narrativeTextLimitation(baseEventDescription(caseState));
  const narrativeLimitation = baseLimitation ?? await eventNarrativeLimitation(projection);
  if (narrativeLimitation) {
    const contextEntries = [...quantityContextEntries(projection.sections.D.suspectProducts), ...d5OtherTypeContextEntries(caseState, projection), ...deviceContextEntries(caseState, projection),...eventDateContextEntries(caseState)];
    const unsupportedContext = (await Promise.all(contextEntries.map(async entry => ({ entry, unsupported: await narrativeGlyphLimitation(entry.text, "B5 context") })))).filter(item => item.unsupported).map(item => item.entry);
    const targets = baseLimitation ? baseEventDescriptionTargets(caseState) : (unsupportedContext.length ? unsupportedContext : contextEntries).map(entry => entry.target);
    outputIssues.push({
      code: "unsupported-event-narrative",
      message: `The reviewed B5 event description ${narrativeLimitation}. The wording is retained, but no new PDF is generated. Review the contributing narrative details.`,
      targets,
      entityIds: [...new Set(targets.map(target => target.split(":")[1]))],
    });
  }
  for (const { field, limitation } of await testHistoryLimitations(projection)) {
    const entries = additionalCommentsEntries(caseState);
    const unsupportedEntries = field === "relevantTestContext"
      ? (await Promise.all(entries.map(async entry => ({ entry, unsupported: await narrativeGlyphLimitation(entry.text, "B6 additional comments") })))).filter(item => item.unsupported).map(item => item.entry)
      : [];
    const targets = field === "relevantHistory" ? ["event:event:relevantHistory"] : (unsupportedEntries.length ? unsupportedEntries : entries).map(entry => entry.target);
    outputIssues.push({ code: "unsupported-test-history", message: `The reviewed ${field === "relevantHistory" ? "B7 history" : "B6 additional comments"} ${limitation}. The wording is retained, but no new PDF is generated.`, targets, entityIds: [...new Set(targets.map(target => targetFromKey(caseState, target).entityId))] });
  }
  return {
    stage: stageFor(caseState),
    revision: caseState.revision,
    understanding: createUnderstandingView(caseState),
    review: createReviewView(caseState),
    clarification: createClarificationView(caseState),
    projection,
    downloadReady: outputIssues.length === 0,
    clinicalNeeds: completionQuestions(caseState).filter(({ kind }) => kind !== "reporter"),
    reportContentKey: createHash("sha256").update(JSON.stringify({sections:projection.sections,productDateNotes:projection.productDateNotes?.map(({field,block,ordinal,text})=>({field,block,ordinal,text})),expirationNotes:projection.expirationNotes?.map(({block,ordinal,text})=>({block,ordinal,text}))}, (key, value) =>
      ["productId", "testId"].includes(key) ? undefined
        : ["reportedTo", "medicationType"].includes(key) && Array.isArray(value) ? [...value].sort() : value)).digest("hex"),
    outputIssues,
    unrepresented,
    openingGroups: pendingOpeningGroups(caseState),
  };
}

export async function performJourneyAction(
  repository: CaseRepository,
  caseId: string,
  action: JourneyAction,
  model: JourneyModel,
  diagnostics: RuntimeDiagnosticLogger = silentDiagnosticLogger,
  retainedUnrepresented: UnrepresentedModelProposal[] = [],
): Promise<JourneySnapshot> {
  let current = await ensureJourneyCase(repository, caseId);
  let unrepresented = [...retainedUnrepresented];
  const expectedStage = stageFor(current);
  const expectedClarification = createClarificationView(current)?.key;
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
        const { unrepresented: openingUnrepresented, ...openingEnvelope } = opening.envelope;
        unrepresented = [...unrepresented, ...openingUnrepresented];
        await applyCommand({
          type: "attach-grounded-proposals",
          commandId: commandId("attach-opening"),
          expectedRevision: current.revision,
          ...openingEnvelope,
        });
        const reportTypeText = action.reportType === "adverse-event" ? "Adverse event"
          : action.reportType === "product-problem" ? "Product problem" : "Adverse event and product problem";
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
      case "review-opening-group": {
        requireStage(expectedStage, "understanding");
        for (const correction of action.corrections) {
          const located = findProposal(current, action.groupId, correction.proposalId);
          if (!located) {
            throw new Error("A proposed value is no longer available");
          }
        }
        await applyCommand({
          type: "review-proposal-groups",
          commandId: commandId("review-opening-group"),
          expectedRevision: current.revision,
          decisions: [{
            groupId: action.groupId,
            action: "accept",
            corrections: action.corrections.map((correction) => ({
              proposalId: correction.proposalId,
              replacementId: valueId("corrected"),
              value: correction.value,
              source: fullSource("correction", "Clinician corrected this value during opening review."),
            })),
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
      case "set-fact": {
        requireOneOfStages(expectedStage, ["clarify", "output"]);
        const target = targetFromKey(current, action.target);
        assertDirectlyEditableTarget(current, target);
        const fact = getFact(current, target);
        if (fact.state === "proposed" || fact.state === "conflicted") {
          throw new Error("Resolve the pending review before editing this fact directly");
        }
        if (expectedStage === "clarify") await ensureOpenCompletionNeed();
        const intent = fact.resolvedValue ? "correction" as const : "fact" as const;
        await applyCommand({
          type: "record-clinician-facts",
          commandId: commandId("set-fact"),
          expectedRevision: current.revision,
          source: fullSource(
            intent === "correction" ? "correction" : "answer",
            ((target.entity === "patient" && target.field === "dateOfBirth") || (target.entity === "event" && isEventDateField(target.field)) || (target.entity === "test" && target.field === "date") || (target.entity === "product" && (target.field === "expirationDate" || isProductDateField(target.field))))
              ? `Clinician supplied ${target.entity === "patient" && target.field === "dateOfBirth" ? "date of birth" : target.entity === "event" && isEventDateField(target.field) ? eventDateLabels[target.field].toLowerCase() : target.entity === "test" ? "test date" : target.field === "expirationDate" ? "expiration" : isProductDateField(target.field) ? productDateLabels[target.field].toLowerCase() : "date"} information: ${displayValue(action.value, target)}${action.value.kind === "known" && !isPartialExpiration(action.value.value) && action.value.qualifier ? `; context: ${action.value.qualifier}` : ""}.`
              : target.entity === "patient" && target.field === "raceEthnicity"
              ? `Clinician supplied the patient race and/or ethnicity: ${displayValue(action.value, target)}${action.value.kind === "known" && action.value.qualifier ? `; context: ${action.value.qualifier}` : ""}.`
              : `Clinician ${intent === "correction" ? "corrected this value directly" : "added this value directly"}.`,
          ),
          facts: [{ id: valueId("direct-fact"), target, intent, value: action.value }],
        });
        break;
      }
      case "withdraw-entity": {
        requireStage(expectedStage, "output");
        await applyCommand({
          type: "withdraw-case-entity",
          commandId: commandId("withdraw-entity"),
          expectedRevision: current.revision,
          target: { entity: action.entity, entityId: action.entityId },
          source: fullSource("correction", withdrawalStatement(current, action.entity, action.entityId)),
        });
        break;
      }
      case "answer-indications": {
        requireStage(expectedStage, "clarify");
        await ensureOpenCompletionNeed();
        const need = current.askedNeeds.find(({ key, status }) => key === "suspect-product-indications" && status === "open");
        if (!need) throw new Error("The indication question is no longer open");
        const answerText = action.answers.map(({ productId, value }) => {
          const product = current.products.find(({ id }) => id === productId);
          const name = knownValue(product?.facts.name) ?? "the selected product";
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
        const outcomeFields = need.targetIds.map((key): SeriousOutcomeField => {
          const target = targetFromKey(current, key);
          if (target.entity !== "event" || !seriousOutcomeFields.includes(target.field as SeriousOutcomeField)) {
            throw new Error("The serious-outcome question contains an unsupported target");
          }
          return target.field as SeriousOutcomeField;
        });
        const allowed = new Set(outcomeFields);
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
          facts: outcomeFields.map((field, index) => {
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
          source: fullSource("answer", `Death date: ${displayValue(action.value,{entity:"event",entityId:"event",field:"deathDate"})}${action.value.kind === "known" && !isPartialExpiration(action.value.value) && action.value.qualifier ? `; context: ${action.value.qualifier}` : ""}.`),
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
            );
            for (const field of ["testName", "testResult", "lowRange", "highRange", "date"] as const) {
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
      case "answer-medication-history": {
        requireStage(expectedStage, "clarify");
        const question = createClarificationView(current);
        if (question?.kind !== "medication-history" || question.productId !== action.productId) throw new Error("The medication question is no longer open");
        await ensureOpenCompletionNeed();
        const product = current.products.find(({ id }) => id === action.productId)!;
        const entries = Object.entries(action.answers).filter((entry) => entry[1] !== undefined) as Array<[ProductFactKey, CaseValue<unknown>]>;
        if (entries.length === 0 || entries.some(([field]) => product.facts[field].state !== "empty")) throw new Error("Answer only the missing medication details; use a correction to change reviewed information");
        const labels: Record<string, string> = { stopped: "stopped", doseReduced: "dose reduced", stopDate: "stop date", improvedAfterChange: "improved after stopping or reducing", restarted: "restarted", recurred: "event returned after restarting" };
        await applyCommand({
          type: "record-clinician-facts", commandId: commandId("answer-medication-history"), expectedRevision: current.revision,
          source: fullSource("answer", `${knownValue(product.facts.name) ?? "Suspect medication"}: ${entries.map(([field, value]) => `${labels[field]}: ${displayValue(value,{entity:"product",entityId:action.productId,field})}`).join("; ")}.`),
          answersNeed: "medication-history",
          facts: entries.map(([field, value]) => ({ id: valueId(`medication-${field}`), target: { entity: "product" as const, entityId: action.productId, field }, intent: "fact" as const, value })),
        });
        break;
      }
      case "answer-device-details": {
        requireStage(expectedStage, "clarify");
        const question = createClarificationView(current);
        if (question?.kind !== "device-details") throw new Error("The device-details question is no longer open");
        await ensureOpenCompletionNeed();
        const values = {
          implantDate: action.implantDate,
          explantDate: action.explantDate,
          reprocessor: action.reprocessor,
        };
        const fields = question.targetIds.map((key) => {
          const target = targetFromKey(current, key);
          if (target.entity !== "product"
            || target.entityId !== question.deviceId
            || !["implantDate", "explantDate", "reprocessor"].includes(target.field)) {
            throw new Error("The device-details question contains an unsupported target");
          }
          return target.field as "implantDate" | "explantDate" | "reprocessor";
        });
        if (fields.some((field) => !values[field])) throw new Error("Every applicable device detail requires an answer");
        const device = current.products.find(({ id }) => id === question.deviceId);
        const name = knownValue(device?.facts.name) ?? "suspect device";
        const labels = { implantDate: "implant date", explantDate: "explant date", reprocessor: "reprocessor" } as const;
        const sourceText = fields.map((field) => `${labels[field]}: ${displayValue(values[field]!, {entity:"product",entityId:question.deviceId,field})}.`).join(" ");
        await applyCommand({
          type: "record-clinician-facts",
          commandId: commandId("answer-device-details"),
          expectedRevision: current.revision,
          source: fullSource("answer", `${name} ${sourceText}`),
          answersNeed: "device-details",
          facts: fields.map((field) => ({
            id: valueId(`device-${field}`),
            target: { entity: "product" as const, entityId: question.deviceId, field: field as ProductFactKey },
            intent: "fact" as const,
            value: values[field]!,
          })),
        });
        break;
      }
      case "answer-reporter": {
        requireOneOfStages(expectedStage, ["clarify", "output"]);
        const reporterNeed = createClarificationView(current)?.key === "reporter-details";
        const previouslyAnswered = current.askedNeeds.some(({ key, status }) => key === "reporter-details" && status !== "open");
        if (!reporterNeed && !previouslyAnswered) throw new Error("Complete the clinical questions before adding reporter details");
        if (reporterNeed) await ensureOpenCompletionNeed();
        const source = fullSource("reporter-entry", reporterSource(action.reporter));
        const facts = reporterFacts(action.reporter).flatMap((entry) => {
          const fact = getFact(current, entry.target);
          if (fact.state === "conflicted" || fact.proposedValues.length > 0) throw new Error("Resolve reporter changes before saving details");
          // The panel edits base values. Preserve existing context when that base
          // is unchanged. This base-value panel has no reporter context editor.
          const currentValue = fact.resolvedValue?.value;
          if (currentValue?.kind === "known" && entry.value.kind === "known"
            && JSON.stringify(currentValue.value) === JSON.stringify(entry.value.value)) return [];
          if (JSON.stringify(currentValue) === JSON.stringify(entry.value)) return [];
          return [{ ...entry, intent: fact.resolvedValue ? "correction" as const : "fact" as const }];
        });
        if (facts.length > 0) await applyCommand({
          type: "record-clinician-facts", commandId: commandId("answer-reporter"), expectedRevision: current.revision,
          source, ...(reporterNeed ? { answersNeed: "reporter-details" as const } : {}), facts,
        });
        if (action.reportDate !== undefined && JSON.stringify(current.event.facts.reportDate.resolvedValue?.value) !== JSON.stringify(action.reportDate === null ? { kind: "explicitly-absent" } : { kind: "known", value: action.reportDate })) await applyCommand({
          type: "record-clinician-facts", commandId: commandId("record-report-date"), expectedRevision: current.revision,
          source: fullSource("selection", action.reportDate === null ? "Date of this report not provided." : `Date of this report: ${action.reportDate}.`),
          facts: [{
            id: valueId("report-date"), target: { entity: "event", entityId: "event", field: "reportDate" },
            intent: current.event.facts.reportDate.resolvedValue ? "correction" : "fact",
            value: action.reportDate === null ? { kind: "explicitly-absent" } : { kind: "known", value: action.reportDate },
          }],
        });
        break;
      }
      case "submit-update": {
        requireOneOfStages(expectedStage, ["understanding", "clarify", "output"]);
        const context = createReviewedCaseModelContext(current, true);
        const update = await proposeWithDiagnostics(model, "correction", action.text, diagnostics, context);
        if (expectedStage === "clarify") await ensureOpenCompletionNeed();
        const { unrepresented: updateUnrepresented, ...updateEnvelope } = update.envelope;
        unrepresented = [...unrepresented, ...updateUnrepresented];
        await applyCommand({
          type: "attach-grounded-proposals",
          commandId: commandId("attach-update"),
          expectedRevision: current.revision,
          ...updateEnvelope,
        });
        break;
      }
      case "review-update-group": {
        requireStage(expectedStage, "review-update");
        const dateCorrections = action.dateCorrections ?? [];
        for (const correction of dateCorrections) {
          const entry = allFacts(current).find(({fact}) => fact.proposedValues.some(p => p.id === correction.proposalId && p.groupId === action.groupId));
          const proposal = entry?.fact.proposedValues.find(p => p.id === correction.proposalId);
          if (!entry || !proposal || !isCalendarDateTarget(entry.target) || !knownValueMismatch(entry.target,proposal.value)) throw new Error("Only retained invalid date proposals can be corrected in this review");
        }
        await applyCommand({
          type: "review-proposal-groups",
          commandId: commandId("review-update"),
          expectedRevision: current.revision,
          decisions: [action.decision === "reject" ? {groupId:action.groupId,action:"reject"} : {groupId:action.groupId,action:"accept",corrections:dateCorrections.map(c => ({...c,replacementId:valueId("corrected-date"),source:fullSource("correction","Clinician supplied this date correction during legacy update review.")}))}],
        });
        break;
      }
      case "resolve-conflict": {
        requireStage(expectedStage, "output");
        const target = targetFromKey(current, action.target);
        const fact = getFact(current, target);
        const chosen = fact.conflictingValues.find(({ id }) => id === action.chosenValueId);
        if (!chosen) throw new Error("The selected conflict alternative is unavailable");
        await applyCommand({
          type: "resolve-conflict",
          commandId: commandId("resolve-conflict"),
          expectedRevision: current.revision,
          target,
          chosenValueId: action.chosenValueId,
          dateCorrection: action.dateCorrection,
          source: fullSource("resolution", action.dateCorrection !== undefined ? `Clinician supplied ${displayValue(action.dateCorrection,target)} to correct this retained invalid date conflict.` : `Use ${displayValue(chosen.value, target)} as ${targetStatement(current, target)}.`),
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

  const snapshot = await getJourneySnapshot(repository, caseId, unrepresented);
  if (action.action === "set-fact"
    && action.target.startsWith("product:")
    && ["name", "productType", "role"].includes(action.target.split(":")[2] ?? "")
    && snapshot.stage === "clarify"
    && (expectedStage === "output" || snapshot.clarification?.key !== expectedClarification)) {
    const productId = action.target.split(":")[1];
    const product = current.products.find(({ id }) => id === productId);
    if (product) {
      snapshot.transitionNotice = `${productLabel(current, product.id)} now makes another report detail applicable. Complete this clarification before returning to output.`;
    }
  }
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
      unrepresented: result.envelope.unrepresented,
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
  const openingGroups = new Set(pendingOpeningGroups(caseState));
  if (allFacts(caseState).some(({ fact }) => fact.proposedValues.some(({ groupId }) => !openingGroups.has(groupId)))) return "review-update";
  if (caseState.patient.state === "proposed"
    || caseState.event.state === "proposed"
    || caseState.products.some(({ state }) => state === "proposed")
    || caseState.relevantTests.some(({ state }) => state === "proposed")) return "understanding";
  if (hasPendingProposals(caseState)) return "review-update";
  if (createClarificationView(caseState)) return "clarify";
  return "output";
}

export function outputReadinessIssues(
  caseState: SemanticCase,
  projection: ReturnType<typeof projectForm3500>,
): OutputReadinessIssue[] {
  const issues: OutputReadinessIssue[] = [];
  const issue = (code: OutputReadinessIssueCode, message: string, targets: string[] = [], entityIds: string[] = []) => {
    issues.push({ code, message, targets, entityIds });
  };
  for (const {target, value} of projection.invalidCalendarDates ?? []) {
    issue("invalid-calendar-date", `The retained date ${value} is not a valid complete calendar date. It has not been changed. Correct this date in Review details using the supplied date, or explicitly record Unknown, Declined, or another supplied status; Wilson does not repair or infer components. No new PDF is generated.`, [target], [targetFromKey(caseState, target).entityId]);
  }
  if (hasPendingProposals(caseState)) {
    issue(
      "pending-proposal-review",
      "Review every pending proposal before opening the form.",
      allFacts(caseState).filter(({ fact }) => fact.proposedValues.length > 0).map(({ target }) => targetKey(target)),
    );
  }
  const clarification = createClarificationView(caseState);
  if (clarification) {
    issue("open-clarification", "Answer or decline the open consequential question before opening the form.", clarification.targetIds);
  }

  const retainedProducts = caseState.products.filter(({ state }) => state === "resolved");
  const completeSuspects = retainedProducts.filter((product) =>
    knownValue(product.facts.role) === "suspect"
    && Boolean(knownValue(product.facts.name))
    && Boolean(knownValue(product.facts.productType)));

  if (retainedProducts.length === 0) {
    issue(
      "no-retained-product",
      "No reviewed product remains in this bounded case. Use New case to begin again with a product Wilson can retain.",
    );
  } else {
    const incomplete = retainedProducts.flatMap((product) => {
      const role = knownValue(product.facts.role);
      const missing = [
        ...(!knownValue(product.facts.name) ? ["name" as const] : []),
        ...(!role ? ["role" as const] : []),
        ...(!knownValue(product.facts.productType) ? ["productType" as const] : []),
      ];
      return missing.length > 0 ? [{ product, missing }] : [];
    });
    for (const { product, missing } of incomplete) {
      const labels = missing.map((field) => ({ name: "Name", productType: "Product type", role: "Role" })[field]);
      issue(
        "incomplete-product",
        `${productLabel(caseState, product.id)} needs ${joinList(labels)} before Wilson can classify and include it truthfully.`,
        missing.map((field) => `product:${product.id}:${field}`),
        [product.id],
      );
    }
    if (completeSuspects.length === 0 && incomplete.length === 0) {
      issue(
        "no-complete-suspect-product",
        "At least one retained product must have Role set to Suspect before output.",
        retainedProducts.map(({ id }) => `product:${id}:role`),
        retainedProducts.map(({ id }) => id),
      );
    }
  }

  const reportType = knownValue(caseState.event.facts.reportType);
  if (!reportType) issue("missing-report-type", "Accept the selected report type.", ["event:event:reportType"], ["event"]);
  if (!hasBaseEventDescription(caseState)) {
    issue(
      "missing-event-description",
      "Accept at least one event or product-problem fact that contributes to the report description.",
      ["event:event:problemDescription", "event:event:symptoms", "event:event:treatments", "event:event:outcome"],
      ["event"],
    );
  }
  if (hasReservedNoPatientIdentifier(caseState)) issue("reserved-no-patient-identifier", "FDA reserves A1 none for no patient involvement. The retained identifier text has not been reinterpreted. Explicitly correct the identifier and Patient involvement before export.", ["patient:patient:identifier", "patient:patient:involvement"], ["patient"]);
  if (knownValue(caseState.patient.facts.involvement) === "none" && (reportType === "adverse-event" || reportType === "adverse-event-and-product-problem")) issue("no-patient-report-type-conflict", "No patient involved conflicts with a report type that includes an adverse event. Review Patient involvement and Report type; neither has been changed automatically.", ["patient:patient:involvement", "event:event:reportType"], ["patient", "event"]);
  const noPatientConflicts = noPatientConflictingTargets(caseState);
  if (noPatientConflicts.length) issue("no-patient-demographics-conflict", "No patient involved conflicts with retained known patient details. Correct Patient involvement or explicitly correct those details before export. Nothing has been cleared automatically.", ["patient:patient:involvement", ...noPatientConflicts], ["patient"]);
  const noPatientOutcomes = noPatientOutcomeConflictingTargets(caseState);
  if (noPatientOutcomes.length) issue("no-patient-outcomes-conflict", `No patient involved conflicts with explicitly reported serious outcomes: ${seriousOutcomeFields.filter(field => noPatientOutcomes.includes(`event:event:${field}`)).map(field => seriousOutcomeLabels[field]).join(", ")}. Correct Patient involvement or these outcomes before export. Nothing has been cleared automatically.`, ["patient:patient:involvement", ...noPatientOutcomes], ["patient", "event"]);
  const a2Issue = patientA2ChoiceIssue(caseState);
  if (a2Issue) issue("patient-a2-choice-required", a2Issue, ["patient:patient:a2Value", "patient:patient:dateOfBirth", "patient:patient:ageYears"], ["patient"]);
  for (const product of caseState.products.filter(p => p.state === "resolved" && d3Eligible(p.facts))) {
    const d3Issue = d3ChoiceIssue(product.facts);
    if (d3Issue) issue("product-d3-choice-required", `${productLabel(caseState,product.id)}: ${d3Issue}`, ["d3Value","treatmentDuration","startDate","stopDate","doseReductionDate"].map(f=>`product:${product.id}:${f}`), [product.id]);
  }
  for (const product of projection.sections.D.suspectProducts) {
    const limit = durationLimitation(product.treatmentDuration);
    if (limit) issue("unsupported-treatment-duration",`${productLabel(caseState,product.productId)}: the reviewed duration ${limit}; no new PDF is generated.`,[`product:${product.productId}:treatmentDuration`],[product.productId]);
  }
  for(const [index,product] of projection.sections.D.suspectProducts.slice(0,maximumForm3500SuspectProducts).entries())for(const field of purchaseDetailFields){
    const value=product[field];if(value===undefined)continue;const limit=purchaseDetailLimitation(field,value,form3500SuspectSlot(index));
    if(limit)issue("unsupported-purchase-detail",`${productLabel(caseState,product.productId)}: the reviewed ${purchaseDetailLabels[field]} ${limit}. It is retained; no new PDF is generated.`,[`product:${product.productId}:${field}`],[product.productId]);
  }
  const ageLimit = patientAgeLimitation(projection.sections.A.ageYears);
  if (ageLimit) issue("unsupported-patient-age", `The reviewed age ${ageLimit}. It is retained, but the PDF cannot represent it; no new PDF is generated.`, ["patient:patient:ageYears"], ["patient"]);
  for (const product of projection.sections.D.suspectProducts) {
    for (const field of ["route", "frequency", "dose", "strength", "ndcOrUniqueId"] as const) {
      const limitation = field === "dose" || field === "strength" ? quantityLimitation(field, product[field])
        : product[field] !== undefined ? productTextLimitation(field, product[field]!) : undefined;
      if (limitation) issue(
        field === "route" ? "unsupported-product-route" : "unsupported-product-text",
        `${productLabel(caseState, product.productId)}: the reviewed ${field === "ndcOrUniqueId" ? "NDC number or Unique ID" : field} ${limitation}. It is retained, but the PDF cannot represent it; no new PDF is generated.`,
        [`product:${product.productId}:${field}`], [product.productId],
      );
    }
  }
  // Count the actual semantic output slots. Never prune retained knowledge to
  // make this bounded PDF fit; the adapter keeps the same guards as defense in depth.
  for (const [products, maximum, code, label] of [
    [projection.sections.D.suspectProducts, maximumForm3500SuspectProducts, "too-many-suspect-products", "suspect medicines or other non-device products"],
    [projection.sections.F.concomitantProducts, maximumForm3500ConcomitantProducts, "too-many-concomitant-products", "concomitant products"],
  ] as const) {
    if (products.length > maximum) {
      const ids = products.map(({ productId }) => productId);
      const limitLabel = label;
      issue(
        code,
        `This preview can include at most ${maximum} ${limitLabel} in the PDF. All ${products.length} reviewed ${label} are retained, but this case exceeds the supported PDF capacity.`,
        ids.map((id) => `product:${id}:role`),
        ids,
      );
    }
  }
  return issues;
}

function productLabel(caseState: SemanticCase, productId: string): string {
  const index = caseState.products.findIndex(({ id }) => id === productId);
  const product = caseState.products[index];
  return productDisplayLabel(knownValue(product?.facts.name), index + 1);
}

function joinList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "required identity details";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
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

function targetStatement(caseState: SemanticCase, target: FactTarget): string {
  if (target.entity === "patient") return `the patient ${target.field === "ageYears" ? "age" : target.field === "raceEthnicity" ? "race and/or ethnicity" : target.field === "dateOfBirth" ? "date of birth" : target.field === "a2Value" ? "A2 value to print" : target.field}`;
  if (target.entity === "event") return `the event ${target.field}`;
  if (target.entity === "reporter") return `the reporter ${target.field}`;
  if (target.entity === "test") return `the relevant test ${target.field}`;
  const product = caseState.products.find(({ id }) => id === target.entityId);
  const name = knownValue(product?.facts.name) ?? "the selected product";
  return `the ${target.field} for ${name}`;
}

function withdrawalStatement(caseState: SemanticCase, entity: "product" | "test", entityId: string): string {
  if (entity === "product") {
    const product = caseState.products.find(({ id }) => id === entityId);
    return `${knownValue(product?.facts.name) ?? "The selected product"} withdrawn from this report.`;
  }
  const index = caseState.relevantTests.findIndex(({ id }) => id === entityId);
  return `${index < 0 ? "The selected relevant test" : `Relevant test ${index + 1}`} withdrawn from this report.`;
}

function knownValue<T>(fact: Fact<T> | undefined): T | undefined {
  const value = fact?.resolvedValue?.value;
  return value?.kind === "known" ? value.value : undefined;
}

function displayValue(value: CaseValue<unknown>, target?: FactTarget): string {
  if (target?.entity === "product" && target.field === "d3Value" && value.kind !== "known") return "no print preference";
  if (target?.field === "treatmentDuration" && value.kind === "known" && isTreatmentDuration(value.value)) return `${value.value.value} ${value.value.unit}`;
  if (target?.entity === "patient" && target.field === "a2Value" && value.kind !== "known") return "no print preference";
  if (target?.entity === "patient" && target.field === "raceEthnicity" && value.kind === "explicitly-absent") return "none of the listed categories explicitly reported";
  if (value.kind !== "known") return value.kind.replaceAll("-", " ");
  if (target?.entity === "patient" && target.field === "ageYears" && isPatientAge(value.value)) { const age = patientAgeParts(value.value); return `${age.value} ${age.unit}`; }
  if (target?.entity === "patient" && target.field === "a2Value" && value.value === "date-of-birth") return "date of birth";
  if (target?.entity === "patient" && target.field === "raceEthnicity" && Array.isArray(value.value)) return value.value.map(item => raceEthnicityOptions.find(option => option.value === item)?.label ?? String(item)).join(" and ");
  if (isPartialExpiration(value.value) && target?.entity === "patient" && target.field === "dateOfBirth")return suppliedDateText(value.value,"date of birth",value.qualifier);
  if (isPartialExpiration(value.value) && target?.entity === "event" && isEventDateField(target.field))return suppliedDateText(value.value,eventDateLabels[target.field].toLowerCase(),value.qualifier);
  if (isPartialExpiration(value.value) && target?.entity === "test" && target.field === "date") return suppliedDateText(value.value,"test date",value.qualifier);
  if (isPartialExpiration(value.value)) return target?.entity === "product" && isProductDateField(target.field) ? suppliedDateText(value.value,productDateLabels[target.field].toLowerCase(),value.qualifier) : expirationText(value.value,value.qualifier);
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
      ? `Relevant test: ${action.test.testName ?? "identity not provided"}; result: ${action.test.testResult ?? "not provided"}${action.test.lowRange ? `; low range ${action.test.lowRange}` : ""}${action.test.highRange ? `; high range ${action.test.highRange}` : ""}${action.test.date ? `; date ${displayValue({kind:"known",value:action.test.date},{entity:"test",entityId:"new-test",field:"date"})}` : ""}.`
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

function requireOneOfStages(actual: JourneyStage, expected: JourneyStage[]): void {
  if (!expected.includes(actual)) throw new Error(`This action is not available during ${actual}`);
}

function assertDirectlyEditableTarget(caseState: SemanticCase, target: FactTarget): void {
  if (target.entity === "patient" && caseState.patient.state !== "resolved") {
    throw new Error("The patient group must be reviewed before direct editing");
  }
  if (target.entity === "event" && caseState.event.state !== "resolved") {
    throw new Error("The event group must be reviewed before direct editing");
  }
  if (target.entity === "product") {
    const product = caseState.products.find(({ id }) => id === target.entityId);
    if (product?.state !== "resolved") throw new Error("The product must be active and reviewed before direct editing");
  }
  if (target.entity === "test") {
    const test = caseState.relevantTests.find(({ id }) => id === target.entityId);
    if (test?.state !== "resolved") throw new Error("The relevant test must be active and reviewed before direct editing");
  }
}

function diagnosticAction(action: JourneyAction): unknown {
  const sanitized = { ...action } as Record<string, unknown>;
  if (typeof sanitized.text === "string") sanitized.text = diagnosticInput(sanitized.text);
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
