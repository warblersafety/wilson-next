import { isDeepStrictEqual } from "node:util";
import type {
  CaseValue,
  EventFacts,
  Fact,
  FactTarget,
  GroundedValue,
  PatientFacts,
  ProductFacts,
  SemanticCase,
} from "./types";

export function emptyFact<T>(): Fact<T> {
  return {
    state: "empty",
    proposedValues: [],
    conflictingValues: [],
    sourceIds: [],
    supersededValues: [],
  };
}

export function emptyPatientFacts(): PatientFacts {
  return {
    identifier: emptyFact(),
    ageYears: emptyFact(),
    sex: emptyFact(),
  };
}

export function emptyEventFacts(): EventFacts {
  return {
    symptoms: emptyFact(),
    onsetDate: emptyFact(),
    hospitalized: emptyFact(),
    hemoglobin: emptyFact(),
    treatments: emptyFact(),
    outcome: emptyFact(),
    dischargeDate: emptyFact(),
  };
}

export function emptyProductFacts(): ProductFacts {
  return {
    name: emptyFact(),
    role: emptyFact(),
    dose: emptyFact(),
    frequency: emptyFact(),
    route: emptyFact(),
    startDate: emptyFact(),
    stopDate: emptyFact(),
    indication: emptyFact(),
    stopped: emptyFact(),
  };
}

export function cloneCase(value: SemanticCase): SemanticCase {
  return structuredClone(value);
}

export function freezeCase(value: SemanticCase): SemanticCase {
  return deepFreeze(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function getFact(caseState: SemanticCase, target: FactTarget): Fact<unknown> {
  if (target.entity === "patient") {
    return caseState.patient.facts[target.field] as Fact<unknown>;
  }
  if (target.entity === "event") {
    return caseState.event.facts[target.field] as Fact<unknown>;
  }

  const product = caseState.products.find(({ id }) => id === target.entityId);
  if (!product) {
    throw new Error(`Unknown product target ${target.entityId}`);
  }
  return product.facts[target.field] as Fact<unknown>;
}

export function targetKey(target: FactTarget): string {
  return `${target.entity}:${target.entityId}:${target.field}`;
}

export function valuesEqual(
  left: CaseValue<unknown>,
  right: CaseValue<unknown>,
): boolean {
  return isDeepStrictEqual(left, right);
}

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function addSources(fact: Fact<unknown>, sourceIds: string[]): void {
  fact.sourceIds = unique([...fact.sourceIds, ...sourceIds]);
}

export function removeProposal(
  fact: Fact<unknown>,
  proposalId: string,
): GroundedValue<unknown> | undefined {
  const index = fact.proposedValues.findIndex(({ id }) => id === proposalId);
  if (index === -1) return undefined;
  return fact.proposedValues.splice(index, 1)[0];
}

export function refreshFactState(fact: Fact<unknown>): void {
  if (fact.conflictingValues.length > 0) {
    fact.state = "conflicted";
  } else if (fact.resolvedValue) {
    fact.state = "resolved";
  } else if (fact.proposedValues.length > 0) {
    fact.state = "proposed";
  } else {
    fact.state = "empty";
  }
}

export function assertCaseInvariants(caseState: SemanticCase): void {
  const sourceIds = new Set(caseState.sources.map(({ id }) => id));
  if (sourceIds.size !== caseState.sources.length) {
    throw new Error("Source IDs must be unique");
  }
  if (new Set(caseState.changes.map(({ commandId }) => commandId)).size !== caseState.changes.length) {
    throw new Error("Command IDs must be unique");
  }
  if (new Set(caseState.products.map(({ id }) => id)).size !== caseState.products.length) {
    throw new Error("Product IDs must be unique");
  }

  const facts: Fact<unknown>[] = [
    ...Object.values(caseState.patient.facts),
    ...Object.values(caseState.event.facts),
    ...caseState.products.flatMap((product) => Object.values(product.facts)),
  ] as Fact<unknown>[];

  for (const fact of facts) {
    const values = [
      ...fact.proposedValues,
      ...(fact.resolvedValue ? [fact.resolvedValue] : []),
      ...fact.conflictingValues,
      ...fact.supersededValues,
    ];
    for (const sourceId of [...fact.sourceIds, ...values.flatMap(({ sourceIds: ids }) => ids)]) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`Fact refers to unknown source ${sourceId}`);
      }
    }
    if (fact.state === "empty" && (fact.proposedValues.length > 0 || fact.resolvedValue || fact.conflictingValues.length > 0)) {
      throw new Error("Empty fact contains an active value");
    }
    if (fact.state === "proposed" && (fact.proposedValues.length === 0 || fact.resolvedValue || fact.conflictingValues.length > 0)) {
      throw new Error("Proposed fact has an invalid active value combination");
    }
    if (fact.state === "resolved" && (!fact.resolvedValue || fact.conflictingValues.length > 0)) {
      throw new Error("Resolved fact must have exactly one resolved value");
    }
    if (fact.state === "conflicted" && (fact.resolvedValue || fact.conflictingValues.length < 2)) {
      throw new Error("Conflicted fact must have alternatives and no resolved value");
    }
  }
}
