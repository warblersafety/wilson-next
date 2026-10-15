import type { FactView, RelevantTestView } from "./views";

function knownLabel(test: RelevantTestView | undefined, fact: FactView | undefined): string | undefined {
  if (fact?.conflicts.length) return undefined;
  // Only a proposed entity owns unaccepted values on its card. Later updates
  // belong to their separate review panel, even when an accepted fact is empty.
  const value = fact?.resolved ?? (test?.state === "proposed"
    ? fact?.proposals.find(proposal => proposal.groupId === test.proposalGroupId)?.value : undefined);
  return value?.kind === "known" && typeof value.value === "string" ? value.value.trim() || undefined : undefined;
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${Number(day)}-${name}-${year}`;
}

/** Presentation only: names never replace stable entity/group identifiers.
 * Keep an ordinal even for identical names/dates; no missing date is inferred.
 * A pending update cannot silently rename an already accepted observation. */
export function testDisplayLabel(test: RelevantTestView | undefined, ordinal: number): string {
  const name = knownLabel(test, test?.facts.testName);
  if (!name) return `Relevant test ${ordinal}`;
  const date = knownLabel(test, test?.facts.date);
  return `${name}${date ? ` — ${displayDate(date)}` : ""} (test ${ordinal})`;
}
