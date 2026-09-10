import {
  addSources,
  assertCaseInvariants,
  cloneCase,
  emptyProductFacts,
  emptyRelevantTestFacts,
  freezeCase,
  getFact,
  refreshFactState,
  removeProposal,
  targetKey,
  unique,
  valuesEqual,
} from "./internal";
import type {
  ApplyCaseCommandResult,
  CaseCommand,
  Change,
  Fact,
  FactTarget,
  GroundedProposal,
  GroundedValue,
  ProposalGroupDecision,
  ProposedRelevantTest,
  SemanticCase,
  Source,
} from "./types";
import { nextCompletionQuestion } from "./completion-policy";
import { assertCaseValueMatchesTarget as assertValueMatchesTarget } from "./value-contract";

export class StaleCaseRevisionError extends Error {}

export function applyCaseCommand(
  current: SemanticCase,
  command: CaseCommand,
): ApplyCaseCommandResult {
  if (!command.commandId.trim()) throw new Error("Command ID is required");
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new Error("Expected revision must be a non-negative integer");
  }
  if (current.changes.some(({ commandId }) => commandId === command.commandId)) {
    return { case: current, applied: false };
  }
  if (command.expectedRevision !== current.revision) {
    throw new StaleCaseRevisionError(
      `Expected case revision ${command.expectedRevision}, received ${current.revision}`,
    );
  }

  const next = cloneCase(current);
  const change: Change = {
    commandId: command.commandId,
    type: command.type,
    affectedTargets: [],
    sourceIds: [],
    priorRevision: current.revision,
    resultingRevision: current.revision + 1,
    supersessions: [],
    resolutions: [],
  };

  switch (command.type) {
    case "attach-grounded-proposals":
      attachGroundedProposals(next, command.products, command.relevantTests ?? [], command.sources, command.proposals, change);
      break;
    case "review-proposal-groups":
      reviewProposalGroups(next, command.decisions, change);
      break;
    case "record-clinician-facts":
      if (command.facts.length === 0) throw new Error("A clinician fact command requires facts");
      addSource(next, command.source);
      addRelevantTests(next, command.relevantTests ?? [], "resolved", change);
      change.sourceIds.push(command.source.id);
      for (const item of command.facts) {
        const grounded: GroundedValue<unknown> = {
          id: item.id,
          groupId: command.commandId,
          intent: item.intent,
          value: item.value,
          sourceIds: [command.source.id],
        };
        applyAcceptedValue(getFact(next, item.target), grounded, item.target, change);
      }
      if (command.answersNeed) {
        const need = [...next.askedNeeds].reverse().find(({ key, status }) => key === command.answersNeed && status === "open");
        if (!need || need.status !== "open") {
          throw new Error(`No open semantic need ${command.answersNeed}`);
        }
        const answeredTargets = new Set(command.facts.map(({ target }) => targetKey(target)));
        if (need.targetIds.some((target) => !answeredTargets.has(target))) {
          throw new Error(`Answer must address every target in semantic need ${command.answersNeed}`);
        }
        assertNeedAnswerTargets(command.answersNeed, command.facts.map(({ target }) => targetKey(target)), (command.relevantTests ?? []).map(({ id }) => id), need.targetIds);
        need.status = command.facts.every(({ value }) => value.kind === "declined")
          ? "declined"
          : "answered";
        change.affectedTargets.push(`need:${need.key}`);
      }
      break;
    case "record-asked-need":
      recordAskedNeed(next, command.key, command.targetIds, change);
      break;
    case "resolve-conflict":
      addSource(next, command.source);
      resolveConflict(next, command.target, command.chosenValueId, command.source, change);
      break;
    default:
      throw new Error(`Unsupported case command ${String((command as { type?: unknown }).type)}`);
  }

  next.revision += 1;
  change.affectedTargets = unique(change.affectedTargets);
  change.sourceIds = unique(change.sourceIds);
  next.changes.push(change);
  assertCaseInvariants(next);
  return { case: freezeCase(next), applied: true };
}

function attachGroundedProposals(
  caseState: SemanticCase,
  products: Array<{ id: string; groupId: string }>,
  relevantTests: ProposedRelevantTest[],
  sources: Source[],
  proposals: GroundedProposal[],
  change: Change,
): void {
  if (proposals.length === 0) throw new Error("A proposal command requires proposals");
  for (const source of sources) addSource(caseState, source);
  change.sourceIds.push(...sources.map(({ id }) => id));

  for (const product of products) {
    if (!product.id.trim() || !product.groupId.trim()) throw new Error("Proposed product identity is required");
    if (caseState.products.some(({ id }) => id === product.id)) {
      throw new Error(`Product ${product.id} already exists`);
    }
    caseState.products.push({
      id: product.id,
      proposalGroupId: product.groupId,
      state: "proposed",
      facts: emptyProductFacts(),
    });
    change.affectedTargets.push(`product:${product.id}`);
  }
  addRelevantTests(caseState, relevantTests, "proposed", change);

  for (const proposal of proposals) {
    if (!proposal.proposalId.trim() || !proposal.groupId.trim()) throw new Error("Proposal identity is required");
    const fact = getFact(caseState, proposal.target);
    if (allFactValues(fact).some(({ id }) => id === proposal.proposalId)) {
      throw new Error(`Proposal ${proposal.proposalId} already exists`);
    }
    requireSources(caseState, proposal.sourceIds);
    assertValueMatchesTarget(proposal.target, proposal.value);
    fact.proposedValues.push({
      id: proposal.proposalId,
      groupId: proposal.groupId,
      intent: proposal.intent,
      value: proposal.value,
      sourceIds: proposal.sourceIds,
    });
    addSources(fact, proposal.sourceIds);
    refreshFactState(fact);
    change.affectedTargets.push(targetKey(proposal.target));
  }
}

function reviewProposalGroups(
  caseState: SemanticCase,
  decisions: ProposalGroupDecision[],
  change: Change,
): void {
  if (decisions.length === 0) throw new Error("A review command requires decisions");
  if (new Set(decisions.map(({ groupId }) => groupId)).size !== decisions.length) {
    throw new Error("Each proposal group may be reviewed only once per command");
  }

  for (const decision of decisions) {
    let found = false;
    const appliedCorrections = new Set<string>();
    for (const { target, fact } of everyFact(caseState)) {
      const matching = fact.proposedValues.filter(({ groupId }) => groupId === decision.groupId);
      for (const proposal of matching) {
        found = true;
        removeProposal(fact, proposal.id);
        if (decision.action === "accept") {
          const correction = decision.corrections?.find(({ proposalId }) => proposalId === proposal.id);
          if (correction) {
            if (!correction.replacementId.trim()) throw new Error("Correction replacement identity is required");
            addSource(caseState, correction.source);
            change.sourceIds.push(correction.source.id);
            appliedCorrections.add(correction.proposalId);
            applyAcceptedValue(fact, {
              id: correction.replacementId,
              groupId: decision.groupId,
              intent: "correction",
              value: correction.value,
              sourceIds: [correction.source.id],
            }, target, change);
          } else {
            applyAcceptedValue(fact, proposal, target, change);
          }
        } else {
          refreshFactState(fact);
          change.affectedTargets.push(targetKey(target));
        }
      }
    }

    if (caseState.patient.state === "proposed" && decision.groupId === "patient") {
      caseState.patient.state = decision.action === "accept" ? "resolved" : "rejected";
      found = true;
    }
    if (caseState.event.state === "proposed" && decision.groupId === "event") {
      caseState.event.state = decision.action === "accept" ? "resolved" : "rejected";
      found = true;
    }
    const product = caseState.products.find(
      ({ proposalGroupId, state }) => proposalGroupId === decision.groupId && state === "proposed",
    );
    if (product) {
      product.state = decision.action === "accept" ? "resolved" : "rejected";
      found = true;
    }
    const relevantTest = caseState.relevantTests.find(
      ({ proposalGroupId, state }) => proposalGroupId === decision.groupId && state === "proposed",
    );
    if (relevantTest) {
      relevantTest.state = decision.action === "accept" ? "resolved" : "rejected";
      found = true;
    }
    if (decision.action === "accept" && appliedCorrections.size !== (decision.corrections?.length ?? 0)) {
      throw new Error(`A correction did not match a proposal in group ${decision.groupId}`);
    }
    if (!found) throw new Error(`Unknown or already reviewed proposal group ${decision.groupId}`);
  }
}

function applyAcceptedValue(
  fact: Fact<unknown>,
  accepted: GroundedValue<unknown>,
  target: FactTarget,
  change: Change,
): void {
  assertValueMatchesTarget(target, accepted.value);
  addSources(fact, accepted.sourceIds);
  change.sourceIds.push(...accepted.sourceIds);
  change.affectedTargets.push(targetKey(target));

  if (fact.state === "conflicted") {
    if (!fact.conflictingValues.some(({ value }) => valuesEqual(value, accepted.value))) {
      fact.conflictingValues.push(accepted);
    }
    refreshFactState(fact);
    return;
  }

  if (!fact.resolvedValue) {
    fact.resolvedValue = accepted;
    refreshFactState(fact);
    return;
  }

  if (valuesEqual(fact.resolvedValue.value, accepted.value)) {
    fact.resolvedValue.sourceIds = unique([
      ...fact.resolvedValue.sourceIds,
      ...accepted.sourceIds,
    ]);
    refreshFactState(fact);
    return;
  }

  if (accepted.intent === "correction") {
    fact.supersededValues.push(fact.resolvedValue);
    change.supersessions.push(targetKey(target));
    fact.resolvedValue = accepted;
    refreshFactState(fact);
    return;
  }

  fact.conflictingValues = [fact.resolvedValue, accepted];
  fact.resolvedValue = undefined;
  refreshFactState(fact);
}

function recordAskedNeed(
  caseState: SemanticCase,
  key: import("./types").SemanticNeedKey,
  targetIds: string[],
  change: Change,
): void {
  const uniqueTargets = unique(targetIds);
  if (uniqueTargets.length === 0) throw new Error("A semantic need requires targets");
  if (caseState.askedNeeds.some((need) => need.key === key
    && need.targetIds.length === uniqueTargets.length
    && need.targetIds.every((target, index) => target === uniqueTargets[index]))) {
    throw new Error(`Semantic need ${key} was already recorded for these targets`);
  }
  const expected = nextCompletionQuestion(caseState);
  if (!expected || expected.key !== key || expected.targetIds.join("\u0000") !== uniqueTargets.join("\u0000")) {
    throw new Error(`Semantic need ${key} is not the next applicable question`);
  }
  for (const target of uniqueTargets) {
    const fact = everyFact(caseState).find(({ target: candidate }) => targetKey(candidate) === target)?.fact;
    if (!fact) throw new Error(`Unknown semantic need target ${target}`);
    if (fact.state !== "empty") throw new Error(`Semantic need target ${target} is not empty`);
  }
  caseState.askedNeeds.push({ key, targetIds: uniqueTargets, status: "open" });
  change.affectedTargets.push(`need:${key}`);
}

function assertNeedAnswerTargets(key: import("./types").SemanticNeedKey, targets: string[], createdTestIds: string[], requiredTargets: string[]): void {
  if (key === "device-details" && (targets.length !== requiredTargets.length
    || targets.some((target) => !requiredTargets.includes(target)))) {
    throw new Error(`Answer contains a target outside semantic need ${key}`);
  }
  const allowed = (target: string) => {
    if (key === "relevant-clinical-context") {
      return target === "event:event:relevantTestsAvailable" || target === "event:event:relevantHistory"
        || createdTestIds.some((id) => target.startsWith(`test:${id}:`));
    }
    if (key === "reporter-details") return target.startsWith("reporter:reporter:");
    if (key === "device-details") return /^product:[^:]+:(implantDate|explantDate|reprocessor)$/.test(target);
    if (key === "suspect-product-indications") return /^product:[^:]+:indication$/.test(target);
    if (key === "serious-outcomes") return /^event:event:(death|lifeThreatening|hospitalized|disability|requiredIntervention|congenitalAnomaly|otherSerious)$/.test(target);
    return target === "event:event:deathDate";
  };
  if (targets.some((target) => !allowed(target))) throw new Error(`Answer contains a target outside semantic need ${key}`);
}

function addRelevantTests(
  caseState: SemanticCase,
  relevantTests: ProposedRelevantTest[],
  state: "proposed" | "resolved",
  change: Change,
): void {
  if (caseState.relevantTests.length + relevantTests.length > 8) throw new Error("The supported case accepts at most eight relevant tests");
  for (const test of relevantTests) {
    if (!test.id.trim() || !test.groupId.trim()) throw new Error("Relevant-test identity is required");
    if (caseState.relevantTests.some(({ id }) => id === test.id)) throw new Error(`Relevant test ${test.id} already exists`);
    caseState.relevantTests.push({
      id: test.id,
      proposalGroupId: test.groupId,
      state,
      facts: emptyRelevantTestFacts(),
    });
    change.affectedTargets.push(`test:${test.id}`);
  }
}

function resolveConflict(
  caseState: SemanticCase,
  target: FactTarget,
  chosenValueId: string,
  resolutionSource: Source,
  change: Change,
): void {
  if (!chosenValueId.trim()) throw new Error("Conflict resolution choice is required");
  const fact = getFact(caseState, target);
  if (fact.state !== "conflicted") throw new Error(`${targetKey(target)} is not conflicted`);
  const chosen = fact.conflictingValues.find(({ id }) => id === chosenValueId);
  if (!chosen) throw new Error(`Conflict has no alternative ${chosenValueId}`);

  const inactive = fact.conflictingValues.filter(({ id }) => id !== chosen.id);
  fact.supersededValues.push(...inactive);
  fact.resolvedValue = {
    ...chosen,
    id: `${chosen.id}:resolved`,
    groupId: resolutionSource.inputId,
    sourceIds: unique([...chosen.sourceIds, resolutionSource.id]),
  };
  fact.conflictingValues = [];
  addSources(fact, [resolutionSource.id]);
  refreshFactState(fact);
  change.sourceIds.push(resolutionSource.id, ...chosen.sourceIds);
  change.affectedTargets.push(targetKey(target));
  change.resolutions.push(targetKey(target));
}

function addSource(caseState: SemanticCase, source: Source): void {
  const existing = caseState.sources.find(({ id }) => id === source.id);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(source)) {
      throw new Error(`Source ${source.id} was reused with different content`);
    }
    return;
  }
  if (source.start < 0 || source.end <= source.start || source.end - source.start !== source.excerpt.length) {
    throw new Error(`Source ${source.id} has invalid excerpt offsets`);
  }
  if (!source.id.trim() || !source.inputId.trim() || !source.excerpt.trim()) {
    throw new Error("Source identity and excerpt are required");
  }
  if (source.actor !== "clinician") throw new Error("Only clinician input may establish case evidence");
  if (!["narrative", "selection", "answer", "correction", "resolution", "reporter-entry"].includes(source.inputType)) {
    throw new Error(`Unsupported source input type ${String(source.inputType)}`);
  }
  if (Number.isNaN(Date.parse(source.recordedAt))) throw new Error("Source recordedAt must be an ISO date-time");
  caseState.sources.push(source);
}

function requireSources(caseState: SemanticCase, sourceIds: string[]): void {
  if (sourceIds.length === 0) throw new Error("A material value requires a source");
  for (const sourceId of sourceIds) {
    if (!caseState.sources.some(({ id }) => id === sourceId)) {
      throw new Error(`Unknown source ${sourceId}`);
    }
  }
}

function allFactValues(fact: Fact<unknown>): GroundedValue<unknown>[] {
  return [
    ...fact.proposedValues,
    ...(fact.resolvedValue ? [fact.resolvedValue] : []),
    ...fact.conflictingValues,
    ...fact.supersededValues,
  ];
}

function everyFact(caseState: SemanticCase): Array<{ target: FactTarget; fact: Fact<unknown> }> {
  const facts: Array<{ target: FactTarget; fact: Fact<unknown> }> = [];
  for (const field of Object.keys(caseState.patient.facts) as Array<keyof typeof caseState.patient.facts>) {
    const target: FactTarget = { entity: "patient", entityId: "patient", field };
    facts.push({ target, fact: getFact(caseState, target) });
  }
  for (const field of Object.keys(caseState.event.facts) as Array<keyof typeof caseState.event.facts>) {
    const target: FactTarget = { entity: "event", entityId: "event", field };
    facts.push({ target, fact: getFact(caseState, target) });
  }
  for (const product of caseState.products) {
    for (const field of Object.keys(product.facts) as Array<keyof typeof product.facts>) {
      const target: FactTarget = { entity: "product", entityId: product.id, field };
      facts.push({ target, fact: getFact(caseState, target) });
    }
  }
  for (const test of caseState.relevantTests) {
    for (const field of Object.keys(test.facts) as Array<keyof typeof test.facts>) {
      const target: FactTarget = { entity: "test", entityId: test.id, field };
      facts.push({ target, fact: getFact(caseState, target) });
    }
  }
  for (const field of Object.keys(caseState.reporter.facts) as Array<keyof typeof caseState.reporter.facts>) {
    const target: FactTarget = { entity: "reporter", entityId: "reporter", field };
    facts.push({ target, fact: getFact(caseState, target) });
  }
  return facts;
}
