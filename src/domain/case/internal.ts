import { isDeepStrictEqual } from "node:util";
import type {
  CaseValue,
  EventFacts,
  Fact,
  FactTarget,
  GroundedValue,
  PatientFacts,
  ProductFacts,
  RelevantTestFacts,
  ReporterFacts,
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
    weight: emptyFact(),
  };
}

export function emptyEventFacts(): EventFacts {
  return {
    reportType: emptyFact(),
    problemDescription: emptyFact(),
    symptoms: emptyFact(),
    onsetDate: emptyFact(),
    death: emptyFact(),
    deathDate: emptyFact(),
    lifeThreatening: emptyFact(),
    hospitalized: emptyFact(),
    disability: emptyFact(),
    requiredIntervention: emptyFact(),
    congenitalAnomaly: emptyFact(),
    otherSerious: emptyFact(),
    relevantTestsAvailable: emptyFact(),
    relevantHistory: emptyFact(),
    treatments: emptyFact(),
    outcome: emptyFact(),
    dischargeDate: emptyFact(),
    productAvailability: emptyFact(),
    productReturnDate: emptyFact(),
  };
}

export function emptyRelevantTestFacts(): RelevantTestFacts {
  return {
    testResult: emptyFact(),
    lowRange: emptyFact(),
    highRange: emptyFact(),
    date: emptyFact(),
  };
}

export function emptyReporterFacts(): ReporterFacts {
  return {
    lastName: emptyFact(), firstName: emptyFact(), address: emptyFact(), city: emptyFact(),
    state: emptyFact(), postalCode: emptyFact(), country: emptyFact(), phone: emptyFact(),
    email: emptyFact(), healthProfessional: emptyFact(), occupation: emptyFact(),
    reportedTo: emptyFact(), doNotDiscloseIdentity: emptyFact(),
  };
}

export function emptyProductFacts(): ProductFacts {
  return {
    name: emptyFact(),
    productType: emptyFact(),
    role: emptyFact(),
    manufacturer: emptyFact(),
    lotNumber: emptyFact(),
    dose: emptyFact(),
    frequency: emptyFact(),
    route: emptyFact(),
    startDate: emptyFact(),
    stopDate: emptyFact(),
    indication: emptyFact(),
    stopped: emptyFact(),
    commonName: emptyFact(),
    procode: emptyFact(),
    modelNumber: emptyFact(),
    catalogNumber: emptyFact(),
    expirationDate: emptyFact(),
    serialNumber: emptyFact(),
    udi: emptyFact(),
    deviceOperator: emptyFact(),
    implanted: emptyFact(),
    implantDate: emptyFact(),
    explantDate: emptyFact(),
    reprocessedSingleUse: emptyFact(),
    reprocessor: emptyFact(),
    servicedByThirdParty: emptyFact(),
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
  if (target.entity === "reporter") {
    return caseState.reporter.facts[target.field] as Fact<unknown>;
  }
  if (target.entity === "test") {
    const test = caseState.relevantTests.find(({ id }) => id === target.entityId);
    if (!test) throw new Error(`Unknown relevant-test target ${target.entityId}`);
    return test.facts[target.field] as Fact<unknown>;
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
  if (new Set(caseState.relevantTests.map(({ id }) => id)).size !== caseState.relevantTests.length) {
    throw new Error("Relevant-test IDs must be unique");
  }
  for (const test of caseState.relevantTests) {
    if (test.state !== "rejected" && test.facts.testResult.state === "empty") {
      throw new Error(`Relevant test ${test.id} requires test and result text`);
    }
  }

  const facts: Fact<unknown>[] = [
    ...Object.values(caseState.patient.facts),
    ...Object.values(caseState.event.facts),
    ...caseState.products.flatMap((product) => Object.values(product.facts)),
    ...caseState.relevantTests.flatMap((test) => Object.values(test.facts)),
    ...Object.values(caseState.reporter.facts),
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
