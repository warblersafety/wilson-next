import type { Fact, ProductEntity, SemanticCase, SemanticNeedKey } from "./types";
import { productDisplayLabel } from "./product-label";

export type CompletionQuestion =
  | BaseQuestion<"suspect-product-indications"> & { kind: "indications"; productIds: string[] }
  | BaseQuestion<"serious-outcomes"> & { kind: "serious-outcomes" }
  | BaseQuestion<"death-date"> & { kind: "death-date" }
  | BaseQuestion<"relevant-clinical-context"> & { kind: "clinical-context"; askTests: boolean; askHistory: boolean }
  | BaseQuestion<"device-details"> & {
      kind: "device-details";
      deviceId: string;
      askImplantDate: boolean;
      askExplantDate: boolean;
      askReprocessor: boolean;
    }
  | BaseQuestion<"reporter-details"> & { kind: "reporter" };

interface BaseQuestion<K extends SemanticNeedKey> {
  key: K;
  status: "new" | "open";
  targetIds: string[];
  question: string;
  reason: string;
}

const seriousOutcomeFields = [
  "death",
  "lifeThreatening",
  "hospitalized",
  "disability",
  "requiredIntervention",
  "congenitalAnomaly",
  "otherSerious",
] as const;

const reporterCompletionFields = [
  "lastName",
  "firstName",
  "phone",
  "email",
  "healthProfessional",
  "occupation",
  "reportedTo",
  "doNotDiscloseIdentity",
] as const;

export function nextCompletionQuestion(caseState: SemanticCase): CompletionQuestion | null {
  if (caseState.revision === 0 || caseState.patient.state !== "resolved" || caseState.event.state !== "resolved"
    || caseState.products.some(({ state }) => state === "proposed")
    || caseState.relevantTests.some(({ state }) => state === "proposed")) return null;
  const reportType = knownString(caseState.event.facts.reportType);
  if (reportType === "adverse-event" || reportType === "adverse-event-and-product-problem") {
    const indications = indicationQuestion(caseState);
    if (indications) return indications;

    const outcomes = ordinaryQuestion(caseState, "serious-outcomes", () => {
    const targetIds = seriousOutcomeFields
      .filter((field) => caseState.event.facts[field].state === "empty")
      .map((field) => `event:event:${field}`);
    return targetIds.length === 0 ? null : {
      kind: "serious-outcomes" as const,
      targetIds,
      question: knownBoolean(caseState.event.facts.hospitalized) === true
        ? "Hospitalization is already recorded. Did any other serious outcomes apply?"
        : "Which serious outcomes applied to this event?",
      reason: "Serious outcomes are a concise, material summary used directly in the supported report.",
    };
    });
    if (outcomes) return outcomes;

    const deathDate = ordinaryQuestion(caseState, "death-date", () => {
    if (knownBoolean(caseState.event.facts.death) !== true || caseState.event.facts.deathDate.state !== "empty") return null;
    return {
      kind: "death-date" as const,
      targetIds: ["event:event:deathDate"],
      question: "What was the date of death?",
      reason: "The form asks for a date only when death is an applicable outcome.",
    };
    });
    if (deathDate) return deathDate;

    const context = ordinaryQuestion(caseState, "relevant-clinical-context", () => {
    const askTests = caseState.relevantTests.every(({ state }) => state === "rejected" || state === "withdrawn")
      && caseState.event.facts.relevantTestsAvailable.state === "empty";
    const askHistory = caseState.event.facts.relevantHistory.state === "empty";
    const targetIds = [
      ...(askTests ? ["event:event:relevantTestsAvailable"] : []),
      ...(askHistory ? ["event:event:relevantHistory"] : []),
    ];
    if (targetIds.length === 0) return null;
    return {
      kind: "clinical-context" as const,
      targetIds,
      askTests,
      askHistory,
      question: askTests && askHistory
        ? "Are there relevant tests or medical history to add?"
        : askTests ? "Are there relevant tests or laboratory results to add?" : "Is there relevant medical history to add?",
      reason: "Relevant tests and history can make the event understandable without asking for unrelated clinical detail.",
    };
    });
    if (context) return context;
  }

  const deviceDetails = ordinaryQuestion(caseState, "device-details", () => {
    const device = caseState.products.find((product) => product.state === "resolved"
      && knownString(product.facts.productType) === "device"
      && knownString(product.facts.role) === "suspect");
    if (!device) return null;
    const askImplantDate = knownBoolean(device.facts.implanted) === true && device.facts.implantDate.state === "empty";
    const askExplantDate = knownBoolean(device.facts.implanted) === true && device.facts.explantDate.state === "empty";
    const askReprocessor = knownBoolean(device.facts.reprocessedSingleUse) === true && device.facts.reprocessor.state === "empty";
    const targetIds = [
      ...(askImplantDate ? [`product:${device.id}:implantDate`] : []),
      ...(askExplantDate ? [`product:${device.id}:explantDate`] : []),
      ...(askReprocessor ? [`product:${device.id}:reprocessor`] : []),
    ];
    if (targetIds.length === 0) return null;
    const name = displayLabel(caseState, device);
    return {
      kind: "device-details" as const,
      deviceId: device.id,
      targetIds,
      askImplantDate,
      askExplantDate,
      askReprocessor,
      question: `Add the applicable device details for ${name}`,
      reason: "Implant timing and reprocessor identity are asked only when accepted device facts make them applicable to Section E.",
    };
  });
  if (deviceDetails) return deviceDetails;

  return ordinaryQuestion(caseState, "reporter-details", () => ({
    kind: "reporter" as const,
    targetIds: reporterCompletionFields.map((field) => `reporter:reporter:${field}`),
    question: "Add the reporter details for this report",
    reason: "Reporter information must come directly from you and cannot be inferred from the clinical account.",
  }));
}

function indicationQuestion(caseState: SemanticCase): CompletionQuestion | null {
  const indicationNeeds = caseState.askedNeeds.filter(({ key }) => key === "suspect-product-indications");
  const existing = [...indicationNeeds].reverse().find(({ status }) => status === "open");
  const coveredTargets = new Set(
    indicationNeeds.filter(({ status }) => status !== "open").flatMap(({ targetIds }) => targetIds),
  );
  const products = existing
    ? existing.targetIds.map((target) => target.split(":")[1]).map((id) => caseState.products.find((product) => product.id === id)).filter(isProduct)
    : caseState.products.filter((product) => isResolvedSuspectWithEmptyIndication(product)
      && !coveredTargets.has(`product:${product.id}:indication`));
  if (products.length === 0) return null;
  const names = products.map((product) => displayLabel(caseState, product));
  return {
    key: "suspect-product-indications",
    kind: "indications",
    status: existing ? "open" : "new",
    targetIds: products.map(({ id }) => `product:${id}:indication`),
    productIds: products.map(({ id }) => id),
    question: names.length === 1
      ? `What was ${names[0]} being used for?`
      : `What was ${names.slice(0, -1).join(", ")} being used for, and what was ${names.at(-1)} being used for?`,
    reason: "The indication explains why each suspect product was used and maps directly to the supported report.",
  };
}

function ordinaryQuestion<K extends Exclude<SemanticNeedKey, "suspect-product-indications">>(
  caseState: SemanticCase,
  key: K,
  create: () => Omit<Extract<CompletionQuestion, { key: K }>, "key" | "status"> | null,
): CompletionQuestion | null {
  const existing = caseState.askedNeeds.find((need) => need.key === key);
  if (existing && existing.status !== "open") return null;
  const value = create();
  if (!value) return null;
  return { ...value, key, status: existing ? "open" : "new" } as CompletionQuestion;
}

function isResolvedSuspectWithEmptyIndication(product: ProductEntity): boolean {
  return product.state === "resolved"
    && knownString(product.facts.productType) !== undefined
    && knownString(product.facts.productType) !== "device"
    && product.facts.role.resolvedValue?.value.kind === "known"
    && product.facts.role.resolvedValue.value.value === "suspect"
    && product.facts.indication.state === "empty";
}

function displayLabel(caseState: SemanticCase, product: ProductEntity): string {
  return productDisplayLabel(
    knownString(product.facts.name),
    caseState.products.findIndex(({ id }) => id === product.id) + 1,
  );
}

function knownString<T extends string>(fact: Fact<T>): T | undefined {
  return fact.resolvedValue?.value.kind === "known" ? fact.resolvedValue.value.value : undefined;
}

function knownBoolean(fact: Fact<boolean>): boolean | undefined {
  return fact.resolvedValue?.value.kind === "known" ? fact.resolvedValue.value.value : undefined;
}

function isProduct(value: ProductEntity | undefined): value is ProductEntity {
  return value !== undefined;
}

export { reporterCompletionFields, seriousOutcomeFields };
