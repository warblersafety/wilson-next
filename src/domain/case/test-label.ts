import {isPartialDate} from "./date-precision";
import type { FactView, RelevantTestView } from "./views";

function knownValue(test: RelevantTestView | undefined, fact: FactView | undefined): unknown {
  if (fact?.conflicts.length) return undefined;
  // Only a proposed entity owns unaccepted values on its card. Later updates
  // belong to their separate review panel, even when an accepted fact is empty.
  const value = fact?.resolved ?? (test?.state === "proposed"
    ? fact?.proposals.find(proposal => proposal.groupId === test.proposalGroupId)?.value : undefined);
  return value?.kind === "known" ? value.value : undefined;
}

function displayDate(value: unknown): string | undefined {
  if(isPartialDate(value))return value.precision==="month"?`${value.year}-${value.month} (month and year only)`:`${value.year} (year only)`;
  if(typeof value!=="string"||!value.trim())return undefined;
  const [year, month, day] = value.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${Number(day)}-${name}-${year}`;
}

/** Presentation only: names never replace stable entity/group identifiers.
 * Keep an ordinal even for identical names/dates; no missing date is inferred.
 * A pending update cannot silently rename an already accepted observation. */
export function testDisplayLabel(test: RelevantTestView | undefined, ordinal: number): string {
  const suppliedName=knownValue(test,test?.facts.testName);
  const name=typeof suppliedName==="string"?suppliedName.trim():undefined;
  if (!name) return `Relevant test ${ordinal}`;
  const date = displayDate(knownValue(test, test?.facts.date));
  return `${name}${date ? ` — ${date}` : ""} (test ${ordinal})`;
}
