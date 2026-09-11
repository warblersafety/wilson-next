import type {
  Fact,
  FactTarget,
  SemanticCase,
} from "./types";

export interface LocatedFact {
  target: FactTarget;
  fact: Fact<unknown>;
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
  if (!product) throw new Error(`Unknown product target ${target.entityId}`);
  return product.facts[target.field] as Fact<unknown>;
}

export function allFacts(caseState: SemanticCase): LocatedFact[] {
  const facts: LocatedFact[] = [];
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

export function targetKey(target: FactTarget): string {
  return `${target.entity}:${target.entityId}:${target.field}`;
}

export function targetFromKey(caseState: SemanticCase, key: string): FactTarget {
  const found = allFacts(caseState).find(({ target }) => targetKey(target) === key);
  if (!found) throw new Error("The selected case fact is unavailable");
  return found.target;
}
