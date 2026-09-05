import type {
  CaseValue,
  Fact,
  GroundedValue,
  ProductEntity,
  SemanticCase,
  SemanticNeedKey,
} from "./types";

export interface FactView {
  state: Fact<unknown>["state"];
  resolved?: CaseValue<unknown>;
  proposals: Array<{ id: string; intent: GroundedValue<unknown>["intent"]; value: CaseValue<unknown>; evidence: string[] }>;
  conflicts: Array<{ id: string; value: CaseValue<unknown>; evidence: string[] }>;
  history: Array<{ value: CaseValue<unknown>; evidence: string[] }>;
  evidence: string[];
}

export interface ProductView {
  id: string;
  state: ProductEntity["state"];
  facts: Record<string, FactView>;
}

export interface UnderstandingView {
  revision: number;
  patient: Record<string, FactView>;
  event: Record<string, FactView>;
  products: ProductView[];
}

export interface ReviewAttentionItem {
  target: string;
  kind: "proposal" | "correction" | "conflict";
  values: Array<{ value: CaseValue<unknown>; evidence: string[] }>;
}

export interface ClarificationView {
  key: SemanticNeedKey;
  status: "new" | "open";
  productIds: string[];
  question: string;
}

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
        state: product.state,
        facts: mapFacts(product.facts, sourceExcerpts),
      })),
  };
}

export function createReviewView(caseState: SemanticCase): { revision: number; attention: ReviewAttentionItem[] } {
  const understanding = createUnderstandingView(caseState);
  const attention: ReviewAttentionItem[] = [];

  for (const [prefix, facts] of [
    ["patient:patient", understanding.patient] as const,
    ["event:event", understanding.event] as const,
    ...understanding.products.map((product) => [`product:${product.id}`, product.facts] as const),
  ]) {
    for (const [field, fact] of Object.entries(facts)) {
      if (fact.conflicts.length > 0) {
        attention.push({ target: `${prefix}:${field}`, kind: "conflict", values: fact.conflicts });
      }
      for (const proposal of fact.proposals) {
        attention.push({
          target: `${prefix}:${field}`,
          kind: proposal.intent === "correction" ? "correction" : "proposal",
          values: [{ value: proposal.value, evidence: proposal.evidence }],
        });
      }
    }
  }

  return { revision: caseState.revision, attention };
}

export function createClarificationView(caseState: SemanticCase): ClarificationView | null {
  const existing = caseState.askedNeeds.find(({ key }) => key === "suspect-product-indications");
  if (existing && existing.status !== "open") return null;

  const products = existing
    ? existing.productIds.map((id) => caseState.products.find((product) => product.id === id)).filter(isProduct)
    : caseState.products.filter((product) => isResolvedSuspectWithEmptyIndication(product));
  if (products.length === 0) return null;

  const names = products.map((product) => knownString(product.facts.name) ?? product.id);
  return {
    key: "suspect-product-indications",
    status: existing ? "open" : "new",
    productIds: products.map(({ id }) => id),
    question: indicationQuestion(names),
  };
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
      intent: proposal.intent,
      value: proposal.value,
      evidence: evidence(proposal.sourceIds),
    })),
    conflicts: fact.conflictingValues.map((value) => ({ id: value.id, value: value.value, evidence: evidence(value.sourceIds) })),
    history: fact.supersededValues.map((value) => ({ value: value.value, evidence: evidence(value.sourceIds) })),
    evidence: evidence(fact.sourceIds),
  };
}

function isResolvedSuspectWithEmptyIndication(product: ProductEntity): boolean {
  return product.state === "resolved"
    && product.facts.role.resolvedValue?.value.kind === "known"
    && product.facts.role.resolvedValue.value.value === "suspect"
    && product.facts.indication.state === "empty";
}

function knownString(fact: Fact<string>): string | undefined {
  return fact.resolvedValue?.value.kind === "known" ? fact.resolvedValue.value.value : undefined;
}

function indicationQuestion(names: string[]): string {
  if (names.length === 1) return `What was ${names[0]} being used for?`;
  const last = names.at(-1);
  return `What was ${names.slice(0, -1).join(", ")} being used for, and what was ${last} being used for?`;
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

function isProduct(value: ProductEntity | undefined): value is ProductEntity {
  return value !== undefined;
}
