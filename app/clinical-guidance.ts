import type { JourneySnapshot } from "../src/server/journey/service";
import { factControl } from "./fact-controls";

/** Presentation only: proposals describe work awaiting review, never settle needs. */
export function clinicalNeedParts(snapshot: JourneySnapshot) {
  const proposed = new Set(snapshot.review.attention.filter(({ kind }) => kind !== "conflict").map(({ target }) => target));
  const proposedTests = snapshot.understanding.relevantTests.some(({ state }) => state === "proposed");
  return snapshot.clinicalNeeds.map((need) => {
    const targets = need.kind === "medication-history"
      ? [...new Set([...need.targetIds, ...["stopped", "doseReduced", "stopDate", "improvedAfterChange", "restarted", "recurred"].map((field) => `product:${need.productId}:${field}`).filter((target) => proposed.has(target))])]
      : need.targetIds;
    const isPending = (target: string) => proposed.has(target) || (target === "event:event:relevantTestsAvailable" && proposedTests);
    const pending = targets.filter(isPending);
    // A proposed stopping/restart answer may change which follow-ups apply.
    // Wait for policy to recalculate after acceptance; do not ask a conditional
    // question as though the proposal were already accepted or rejected.
    const recheckAfterReview = need.kind === "medication-history" && ["stopped", "doseReduced", "restarted"]
      .some((field) => proposed.has(`product:${need.productId}:${field}`));
    return { need, pending, missing: targets.filter((target) => !isPending(target)), recheckAfterReview };
  });
}

export function needFieldLabel(target: string): string {
  const [entity, , field] = target.split(":");
  if (target === "event:event:relevantTestsAvailable") return "Relevant tests or laboratory results";
  return factControl(entity as "event" | "product", field)?.label ?? field;
}

/** Mirrors the existing UI/server saving gate; it does not grant new authority. */
export function canSaveReporter(snapshot: JourneySnapshot): boolean {
  const previouslySaved = Object.values(snapshot.understanding.reporter).some(({ resolved }) => resolved);
  return (snapshot.stage === "clarify" && (snapshot.clarification?.kind === "reporter" || previouslySaved)) || snapshot.stage === "output";
}

/** A navigation hint, not a new completion or action-permission rule. */
export function nextClinicalAction(snapshot: JourneySnapshot) {
  if (snapshot.stage === "review-update") return { kind: "updates", label: "Review proposed changes" } as const;
  if (snapshot.stage === "understanding") return { kind: "proposals", label: "Review remaining details" } as const;
  if (snapshot.stage === "clarify" && snapshot.clarification?.kind !== "reporter") {
    return { kind: "questions", label: "Answer clinical questions" } as const;
  }
  return undefined;
}

/** Shorten only within one stable entity, never by matching display names. */
export function singleEntityGroup(targets: string[]): boolean {
  return targets.length > 0 && new Set(targets.map((target) => target.split(":").slice(0, 2).join(":"))).size === 1;
}
