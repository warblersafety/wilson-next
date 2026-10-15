import type { FactView, RelevantTestView } from "./views";

function knownLabel(fact: FactView | undefined): string | undefined {
  if (fact?.conflicts.length) return undefined;
  const value = fact?.resolved ?? fact?.proposals[0]?.value;
  return value?.kind === "known" && typeof value.value === "string" ? value.value.trim() || undefined : undefined;
}

/** Presentation only: names never replace stable entity/group identifiers.
 * Keep an ordinal even for identical names/dates; no missing date is inferred.
 * A pending correction cannot silently rename an already accepted observation. */
export function testDisplayLabel(test: RelevantTestView | undefined, ordinal: number): string {
  const name = knownLabel(test?.facts.testName);
  if (!name) return `Relevant test ${ordinal}`;
  const date = knownLabel(test?.facts.date);
  return `${name}${date ? ` — ${date}` : ""} (test ${ordinal})`;
}
