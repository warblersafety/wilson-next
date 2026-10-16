import { readFileSync } from "node:fs";
import type { ModelProposalOutput } from "../../src/domain/case/model-boundary";
import { fixtureReferences } from "./source-references";
export const timeOpening = readFileSync(new URL("../../evidence/issue-192/synthetic-input.txt", import.meta.url), "utf8");
/** Exact captured provider text JSON, NOT a newly generated or repaired response. */
export const omittedTimeOutput: ModelProposalOutput = JSON.parse(readFileSync(new URL("../../evidence/issue-192/actual-model-output.json", import.meta.url), "utf8"));
export const timeContext = "The INR collection time was not recorded.";
export const correctedTimeContext = "The INR collection time is unavailable in the source record.";
export const timeCorrection = `Correction: keep the INR collection date 03 September 2026 and replace only its collection-time context with: ${correctedTimeContext} The ALT observation is unchanged.`;
/** Authored expected response tests the supported path; not evidence of live prompt efficacy. */
export function expectedTimeOutput(): ModelProposalOutput {
 const output = structuredClone(omittedTimeOutput);
 const date = output.proposals.find(p => p.target.entity === "test" && p.target.testReference === "test1" && p.target.field === "date")!;
 date.value = { kind: "known", value: "2026-09-03", qualifier: timeContext };
 date.evidenceReferences.push(...fixtureReferences(timeOpening, timeContext));
 return output;
}
export function expectedTimeCorrection(testId: string): ModelProposalOutput {
 return { products: [], proposals: [{ proposalReference: "inr-context-correction", groupReference: "inr-context", intent: "correction", target: { entity: "test", testReference: testId, field: "date" }, value: { kind: "known", value: "2026-09-03", qualifier: correctedTimeContext }, evidenceReferences: fixtureReferences(timeCorrection, timeCorrection) }] };
}
export const timeScenario = [
 { identityScope: "test-time", turn: "opening" as const, output: expectedTimeOutput() },
 { identityScope: "test-time-update", turn: "correction" as const, output: expectedTimeCorrection("test-test-time-test1") },
];
