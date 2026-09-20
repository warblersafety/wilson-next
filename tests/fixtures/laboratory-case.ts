import { parseModelProposalEnvelope, type ModelProposalOutput } from "../../src/domain/case/model-boundary";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
const recordedAt = "2026-09-20T12:00:00.000Z";
const identities = (kind: string, reference: string) => `${kind}-${reference}`;

export function laboratoryOpening(observations: Record<string, string | null>[], text: string) {
  const output: ModelProposalOutput = {
    products: [], tests: observations.map((_, index) => ({ testReference: `t${index}`, groupReference: `g${index}` })),
    proposals: observations.flatMap((observation, index) => Object.entries(observation).map(([field, value]) => ({
      proposalReference: `p${index}-${field}`, groupReference: `g${index}`, intent: "fact" as const,
      target: { entity: "test" as const, testReference: `t${index}`, field: field as "testName" | "testResult" | "lowRange" | "highRange" | "date" },
      value: value === null ? { kind: "unknown" as const } : { kind: "known" as const, value }, evidenceQuote: text,
    }))),
  };
  return parseModelProposalEnvelope({ turn: "opening", input: { id: "input", type: "narrative", text, recordedAt }, output }, identities);
}

export function reviewedLaboratoryCase(observations: Record<string, string | null>[], text: string) {
  const envelope = laboratoryOpening(observations, text);
  const { unrepresented: _, ...facts } = envelope;
  let state = applyCaseCommand(createSemanticCase("case-00000000-0000-4000-8000-000000000091"), { type: "attach-grounded-proposals", commandId: "opening", expectedRevision: 0, ...facts }).case;
  state = applyCaseCommand(state, { type: "review-proposal-groups", commandId: "review", expectedRevision: state.revision, decisions: envelope.relevantTests.map(({ groupId }) => ({ groupId, action: "accept" })) }).case;
  return state;
}

