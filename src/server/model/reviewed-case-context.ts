import type { Fact, SemanticCase } from "../../domain/case/types";
import type { ReviewedCaseModelContext, ReviewedFactContext } from "./journey-model";

export function createReviewedCaseModelContext(
  caseState: SemanticCase,
): ReviewedCaseModelContext {
  return {
    patient: resolvedFacts(caseState.patient.facts),
    event: resolvedFacts(caseState.event.facts),
    products: caseState.products
      .filter(({ state }) => state === "resolved")
      .map((product) => ({
        id: product.id,
        name: resolvedName(product.facts.name),
        facts: resolvedFacts(product.facts),
      })),
    relevantTests: caseState.relevantTests
      .filter(({ state }) => state === "resolved")
      .map((test) => ({ id: test.id, facts: resolvedFacts(test.facts) })),
  };
}

function resolvedFacts(
  facts: Record<string, Fact<unknown>> | object,
): ReviewedFactContext[] {
  return Object.entries(facts).flatMap(([field, candidate]) => {
    const fact = candidate as Fact<unknown>;
    return fact.resolvedValue ? [{ field, value: fact.resolvedValue.value }] : [];
  });
}

function resolvedName(fact: Fact<string>): string | null {
  const value = fact.resolvedValue?.value;
  return value?.kind === "known" ? value.value : null;
}
