import { sourcePassages } from "../../src/domain/case/source-passages.ts";
import { parseModelProposalEnvelope as parse, type ModelProposalOutput, type ParseModelProposalEnvelopeInput, type ModelBoundaryIdentityFactory } from "../../src/domain/case/model-boundary.ts";

/** Author historical deterministic fixtures by source wording; runtime sees references only. */
export type QuotedFixtureOutput = Omit<ModelProposalOutput, "proposals"> & {
  proposals: Array<Omit<ModelProposalOutput["proposals"][number], "evidenceReferences"> & { evidenceQuote: string }>;
};

export function fixtureReferences(text: string, excerpt: string): string[] {
  const start = text.indexOf(excerpt);
  if (start < 0) return ["missing-fixture-passage"];
  if (!excerpt.trim()) return [];
  if (text.indexOf(excerpt, start + 1) !== -1) return ["ambiguous-fixture-passage"];
  return sourcePassages(text).filter((passage) => passage.start < start + excerpt.length && passage.end > start).map(({ reference }) => reference);
}

export function referenceFixture(text: string, output: unknown): ModelProposalOutput {
  const fixture = output as QuotedFixtureOutput;
  return { ...fixture, proposals: fixture.proposals.map(({ evidenceQuote, ...proposal }) => ({
    ...proposal, ...(evidenceQuote === undefined ? {} : { evidenceReferences: fixtureReferences(text, evidenceQuote) }),
  })) } as ModelProposalOutput;
}

export function parseQuotedFixture(candidate: ParseModelProposalEnvelopeInput, identities: ModelBoundaryIdentityFactory) {
  return parse({ ...candidate, output: referenceFixture(candidate.input.text, candidate.output) }, identities);
}
