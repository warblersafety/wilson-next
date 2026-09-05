import {
  addSources,
  assertCaseInvariants,
  cloneCase,
  emptyProductFacts,
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
  CaseValue,
  Change,
  Fact,
  FactTarget,
  GroundedProposal,
  GroundedValue,
  ProposalGroupDecision,
  SemanticCase,
  Source,
} from "./types";

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
      attachGroundedProposals(next, command.products, command.sources, command.proposals, change);
      break;
    case "review-proposal-groups":
      reviewProposalGroups(next, command.decisions, change);
      break;
    case "record-clinician-facts":
      if (command.facts.length === 0) throw new Error("A clinician fact command requires facts");
      addSource(next, command.source);
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
        const need = next.askedNeeds.find(({ key }) => key === command.answersNeed);
        if (!need || need.status !== "open") {
          throw new Error(`No open semantic need ${command.answersNeed}`);
        }
        need.status = command.facts.every(({ value }) => value.kind === "declined")
          ? "declined"
          : "answered";
        change.affectedTargets.push(`need:${need.key}`);
      }
      break;
    case "record-asked-need":
      recordAskedNeed(next, command.key, command.productIds, change);
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
  key: "suspect-product-indications",
  productIds: string[],
  change: Change,
): void {
  if (caseState.askedNeeds.some((need) => need.key === key)) {
    throw new Error(`Semantic need ${key} was already recorded`);
  }
  const uniqueProductIds = unique(productIds);
  if (uniqueProductIds.length === 0) throw new Error("A semantic need requires products");
  for (const productId of uniqueProductIds) {
    const product = caseState.products.find(({ id, state }) => id === productId && state === "resolved");
    if (!product) throw new Error(`Unknown resolved product ${productId}`);
    if (product.facts.role.resolvedValue?.value.kind !== "known" || product.facts.role.resolvedValue.value.value !== "suspect") {
      throw new Error(`Indication need may only target suspect product ${productId}`);
    }
    if (product.facts.indication.state !== "empty") {
      throw new Error(`Product ${productId} does not have an empty indication`);
    }
  }
  caseState.askedNeeds.push({ key, productIds: uniqueProductIds, status: "open" });
  change.affectedTargets.push(`need:${key}`);
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
  if (!["narrative", "answer", "correction", "resolution"].includes(source.inputType)) {
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
  return facts;
}

function assertValueMatchesTarget(target: FactTarget, value: CaseValue<unknown>): void {
  if (!value || typeof value !== "object") throw new Error(`${targetKey(target)} requires a case value`);
  const raw = value as unknown as Record<string, unknown>;
  const kind = raw.kind;
  if (!["known", "unknown", "explicitly-absent", "inapplicable", "declined"].includes(kind as string)) {
    throw new Error(`${targetKey(target)} has an unsupported resolved meaning`);
  }
  if (kind !== "known") {
    if ("value" in raw || "qualifier" in raw) {
      throw new Error(`${targetKey(target)} mixes mutually exclusive resolved meanings`);
    }
    return;
  }
  if (!("value" in raw)) throw new Error(`${targetKey(target)} requires a known value`);
  const actual = raw.value;
  const stringFields = new Set([
    "identifier", "onsetDate", "hemoglobin", "outcome", "dischargeDate",
    "name", "dose", "frequency", "route", "startDate", "indication",
  ]);
  if (stringFields.has(target.field) && typeof actual !== "string") {
    throw new Error(`${targetKey(target)} requires a string value`);
  }
  if (["onsetDate", "dischargeDate", "startDate"].includes(target.field)
    && (typeof actual !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(actual))) {
    throw new Error(`${targetKey(target)} requires an ISO calendar date`);
  }
  if (target.field === "ageYears" && (!Number.isInteger(actual) || (actual as number) < 0 || (actual as number) > 150)) {
    throw new Error(`${targetKey(target)} requires a valid age`);
  }
  if (target.field === "sex" && !["female", "male", "intersex"].includes(actual as string)) {
    throw new Error(`${targetKey(target)} requires a supported sex value`);
  }
  if (["symptoms", "treatments"].includes(target.field) && (!Array.isArray(actual) || actual.some((item) => typeof item !== "string"))) {
    throw new Error(`${targetKey(target)} requires a string array`);
  }
  if (["hospitalized", "stopped"].includes(target.field) && typeof actual !== "boolean") {
    throw new Error(`${targetKey(target)} requires a boolean value`);
  }
  if (target.field === "role" && !["suspect", "concomitant"].includes(actual as string)) {
    throw new Error(`${targetKey(target)} requires a supported role`);
  }
}
