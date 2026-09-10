import type {
  CaseValue,
  Fact,
  GroundedValue,
  ProductEntity,
  RelevantTestEntity,
  SemanticCase,
  SemanticNeedKey,
} from "./types";
import { nextCompletionQuestion, type CompletionQuestion } from "./completion-policy";

export interface FactView {
  state: Fact<unknown>["state"];
  resolved?: CaseValue<unknown>;
  proposals: Array<{ id: string; groupId: string; intent: GroundedValue<unknown>["intent"]; value: CaseValue<unknown>; evidence: string[] }>;
  conflicts: Array<{ id: string; value: CaseValue<unknown>; evidence: string[] }>;
  history: Array<{ value: CaseValue<unknown>; evidence: string[] }>;
  evidence: string[];
}

export interface ProductView {
  id: string;
  proposalGroupId: string;
  state: ProductEntity["state"];
  facts: Record<string, FactView>;
}

export interface UnderstandingView {
  revision: number;
  patient: Record<string, FactView>;
  event: Record<string, FactView>;
  products: ProductView[];
  relevantTests: ProductView[];
  reporter: Record<string, FactView>;
}

export interface ReviewAttentionItem {
  target: string;
  groupId?: string;
  kind: "proposal" | "correction" | "conflict";
  values: Array<{ id: string; value: CaseValue<unknown>; evidence: string[] }>;
}

export type ClarificationView = CompletionQuestion;

export function createUnderstandingView(caseState: SemanticCase): UnderstandingView {
  const sourceExcerpts = new Map(caseState.sources.map(({ id, excerpt }) => [id, excerpt]));
  return {
    revision: caseState.revision,
    patient: mapFacts(caseState.patient.facts, sourceExcerpts),
    event: mapFacts(caseState.event.facts, sourceExcerpts),
    products: caseState.products
      .filter(({ state }) => state !== "rejected")
      .map((product) => ({
        id: product.id,
        proposalGroupId: product.proposalGroupId,
        state: product.state,
        facts: mapFacts(product.facts, sourceExcerpts),
      })),
    relevantTests: caseState.relevantTests
      .filter(({ state }) => state !== "rejected")
      .map((test) => ({ id: test.id, proposalGroupId: test.proposalGroupId, state: test.state, facts: mapFacts(test.facts, sourceExcerpts) })),
    reporter: mapFacts(caseState.reporter.facts, sourceExcerpts),
  };
}

export function createReviewView(caseState: SemanticCase): { revision: number; attention: ReviewAttentionItem[] } {
  const understanding = createUnderstandingView(caseState);
  const attention: ReviewAttentionItem[] = [];

  for (const [prefix, facts] of [
    ["patient:patient", understanding.patient] as const,
    ["event:event", understanding.event] as const,
    ...understanding.products.map((product) => [`product:${product.id}`, product.facts] as const),
    ...understanding.relevantTests.map((test) => [`test:${test.id}`, test.facts] as const),
    ["reporter:reporter", understanding.reporter] as const,
  ]) {
    for (const [field, fact] of Object.entries(facts)) {
      if (fact.conflicts.length > 0) {
        attention.push({ target: `${prefix}:${field}`, kind: "conflict", values: fact.conflicts });
      }
      for (const proposal of fact.proposals) {
        attention.push({
          target: `${prefix}:${field}`,
          groupId: proposal.groupId,
          kind: proposal.intent === "correction" ? "correction" : "proposal",
          values: [{ id: proposal.id, value: proposal.value, evidence: proposal.evidence }],
        });
      }
    }
  }

  return { revision: caseState.revision, attention };
}

export function createClarificationView(caseState: SemanticCase): ClarificationView | null {
  return nextCompletionQuestion(caseState);
}

function mapFacts(
  facts: Record<string, Fact<unknown>> | object,
  sourceExcerpts: Map<string, string>,
): Record<string, FactView> {
  return Object.fromEntries(
    Object.entries(facts).map(([field, fact]) => [field, factView(fact as Fact<unknown>, sourceExcerpts)]),
  );
}

function factView(fact: Fact<unknown>, sourceExcerpts: Map<string, string>): FactView {
  const evidence = (sourceIds: string[]) => sourceIds.map((id) => sourceExcerpts.get(id)).filter(isString);
  return {
    state: fact.state,
    resolved: fact.resolvedValue?.value,
    proposals: fact.proposedValues.map((proposal) => ({
      id: proposal.id,
      groupId: proposal.groupId,
      intent: proposal.intent,
      value: proposal.value,
      evidence: evidence(proposal.sourceIds),
    })),
    conflicts: fact.conflictingValues.map((value) => ({ id: value.id, value: value.value, evidence: evidence(value.sourceIds) })),
    history: fact.supersededValues.map((value) => ({ value: value.value, evidence: evidence(value.sourceIds) })),
    evidence: evidence(fact.sourceIds),
  };
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}
