import type { Fact, SemanticCase } from "../../domain/case/types";
import type { ReviewedCaseModelContext, ReviewedFactContext } from "./journey-model";

export function createReviewedCaseModelContext(
  caseState: SemanticCase,
  includePending = false,
): ReviewedCaseModelContext {
  return {
    totalTestCount: caseState.relevantTests.length,
    patient: resolvedFacts(caseState.patient.facts, includePending),
    event: resolvedFacts(caseState.event.facts, includePending),
    products: caseState.products
      .filter(({ state }) => state === "resolved" || (includePending && state === "proposed"))
      .map((product) => ({
        id: product.id,
        name: resolvedName(product.facts.name),
        facts: resolvedFacts(product.facts, includePending),
      })),
    relevantTests: caseState.relevantTests
      .filter(({ state }) => state === "resolved" || (includePending && state === "proposed"))
      .map((test) => ({ id: test.id, facts: resolvedFacts(test.facts, includePending) })),
  };
}

function resolvedFacts(
  facts: Record<string, Fact<unknown>> | object,
  includePending = false,
): ReviewedFactContext[] {
  return Object.entries(facts).flatMap(([field, candidate]) => {
    const fact = candidate as Fact<unknown>;
    return [
      ...(fact.resolvedValue ? [{ field, value: fact.resolvedValue.value }] : []),
      ...(includePending ? fact.proposedValues.map(({ value }) => ({ field, value, status: "proposed" as const })) : []),
    ];
  });
}

function resolvedName(fact: Fact<string>): string | null {
  const value = fact.resolvedValue?.value;
  return value?.kind === "known" ? value.value : null;
}
