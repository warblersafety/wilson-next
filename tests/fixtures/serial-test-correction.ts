import { applyCaseCommand } from "../../src/domain/case/commands";
import type { SemanticCase } from "../../src/domain/case/types";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { performJourneyAction } from "../../src/server/journey/service";
import { completeResolvedCase } from "../domain/fixture";
import { referenceFixture, type QuotedFixtureOutput } from "./source-references";

export const firstSerialTestId = "test-hemoglobin";
export const secondSerialTestId = "test-serial-second";
export const serialCorrectionText = "Correction: the hemoglobin result on 12 September 2026 was 9.6 g/dL, not 9.4 g/dL. The 11 September result remains 8.9 g/dL. Both dates and reference ranges are unchanged.";
export const mixedSerialText = `${serialCorrectionText} A separate platelet count on 13 September 2026 was 120 x10^9/L.`;
const at = "2026-09-20T12:00:00.000Z";

/** Constructed synthetic baseline; never claimed to be the missing original request. */
export async function serialTestCase(): Promise<SemanticCase> {
  let current = structuredClone(completeResolvedCase());
  current.id = "case-00000000-0000-4000-8000-000000000105";
  const text = "Hemoglobin was 8.9 g/dL on 11 September 2026 and 9.4 g/dL on 12 September 2026. Both reference ranges were 12 to 16 g/dL.";
  const source = { id: "serial-source", inputId: "serial-input", inputType: "correction" as const, actor: "clinician" as const, excerpt: text, start: 0, end: text.length, recordedAt: at };
  const values = { testName: "hemoglobin", testResult: "8.9 g/dL", lowRange: "12", highRange: "16", date: "2026-09-11" };
  current = applyCaseCommand(current, { type: "record-clinician-facts", commandId: "serial-first", expectedRevision: current.revision, source,
    facts: Object.entries(values).map(([field, value]) => ({ id: `serial-first-${field}`, intent: "correction" as const, target: { entity: "test" as const, entityId: firstSerialTestId, field: field as keyof typeof values }, value: { kind: "known" as const, value } })),
  }).case;
  current = applyCaseCommand(current, { type: "attach-grounded-proposals", commandId: "serial-second", expectedRevision: current.revision, products: [], relevantTests: [{ id: secondSerialTestId, groupId: "serial-second" }], sources: [],
    proposals: Object.entries({ ...values, testResult: "9.4 g/dL", date: "2026-09-12" }).map(([field, value]) => ({ proposalId: `serial-second-${field}`, groupId: "serial-second", intent: "fact" as const, target: { entity: "test" as const, entityId: secondSerialTestId, field: field as keyof typeof values }, value: { kind: "known" as const, value }, sourceIds: [source.id] })),
  }).case;
  current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "serial-review", expectedRevision: current.revision, decisions: [{ groupId: "serial-second", action: "accept" }] }).case;
  const repository = new InMemoryCaseRepository({ initialCase: current });
  await performJourneyAction(repository, current.id, { action: "answer-reporter", reportDate: "2026-09-20", reporter: { kind: "provided", firstName: "Casey", lastName: "Reed", email: "casey.reed@example.test", healthProfessional: true, occupation: "Physician", country: "UNITED STATES", reportedTo: [], doNotDiscloseIdentity: true } }, { propose: async () => { throw new Error("Unexpected fixture model call"); } });
  return (await repository.load(current.id))!;
}

export function serialOutput(text = serialCorrectionText, reference = secondSerialTestId, add = false) {
  const output: QuotedFixtureOutput = { products: [], tests: [], proposals: [{ proposalReference: "serial-correction", groupReference: "serial-correction", intent: "correction", target: { entity: "test", testReference: reference, field: "testResult" }, value: { kind: "known", value: "9.6 g/dL" }, evidenceQuote: text }] };
  if (![firstSerialTestId, secondSerialTestId].includes(reference)) output.tests!.push({ testReference: reference, groupReference: "serial-correction" });
  if (add) {
    output.tests!.push({ testReference: "additional", groupReference: "additional" });
    for (const [field, value] of Object.entries({ testName: "platelet count", testResult: "120 x10^9/L", date: "2026-09-13" })) output.proposals.push({ proposalReference: `add-${field}`, groupReference: "additional", intent: "fact", target: { entity: "test", testReference: "additional", field: field as "testName" | "testResult" | "date" }, value: { kind: "known", value }, evidenceQuote: text });
  }
  return referenceFixture(text, output);
}
