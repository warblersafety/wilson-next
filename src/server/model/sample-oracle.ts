import type { ParsedModelProposalEnvelope } from "../../domain/case/model-boundary";
import type { GroundedProposal } from "../../domain/case/types";
import { correctionAccount, openingAccount } from "../../experiment/fixed-inputs";
import {
  parseFixedCorrectionResponse,
  parseFixedOpeningResponse,
} from "./fixed-journey";
import type { ModelTurn } from "./journey-model";

export interface ProposalReviewRow {
  proposalId: string;
  target: string;
  expectedValue: string;
  proposedValue: string;
  excerpt: string;
  automaticPass: boolean;
}

export interface SampleAssessment {
  automaticPass: boolean;
  issues: string[];
  proposals: ProposalReviewRow[];
}

export function assessModelProposals(
  turn: ModelTurn,
  actual: ParsedModelProposalEnvelope,
): SampleAssessment {
  const expected = turn === "opening"
    ? parseFixedOpeningResponse(openingAccount)
    : parseFixedCorrectionResponse(correctionAccount);
  const issues: string[] = [];

  if (JSON.stringify(actual.products) !== JSON.stringify(expected.products)) {
    issues.push("Product declarations did not match the fixed oracle in identity and order.");
  }

  const expectedById = new Map(expected.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const actualById = new Map(actual.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const sourceById = new Map(actual.sources.map((source) => [source.id, source]));
  const rows: ProposalReviewRow[] = [];

  for (const expectedProposal of expected.proposals) {
    const actualProposal = actualById.get(expectedProposal.proposalId);
    if (!actualProposal) {
      issues.push(`Missing proposal ${expectedProposal.proposalId}.`);
      rows.push(rowForMissing(expectedProposal));
      continue;
    }
    const structuralPass = sameProposalMeaning(actualProposal, expectedProposal);
    if (!structuralPass) issues.push(`Proposal ${expectedProposal.proposalId} did not match the semantic oracle.`);
    const excerpt = actualProposal.sourceIds
      .map((sourceId) => sourceById.get(sourceId)?.excerpt ?? "[missing source]")
      .join(" | ");
    rows.push({
      proposalId: expectedProposal.proposalId,
      target: targetName(expectedProposal),
      expectedValue: valueText(expectedProposal),
      proposedValue: valueText(actualProposal),
      excerpt,
      automaticPass: structuralPass && !excerpt.includes("[missing source]"),
    });
  }

  for (const actualProposal of actual.proposals) {
    if (!expectedById.has(actualProposal.proposalId)) {
      issues.push(`Unexpected proposal ${actualProposal.proposalId}.`);
    }
  }

  return {
    automaticPass: issues.length === 0 && rows.every((row) => row.automaticPass),
    issues,
    proposals: rows,
  };
}

function sameProposalMeaning(actual: GroundedProposal, expected: GroundedProposal): boolean {
  return actual.groupId === expected.groupId
    && actual.intent === expected.intent
    && JSON.stringify(actual.target) === JSON.stringify(expected.target)
    && JSON.stringify(actual.value) === JSON.stringify(expected.value);
}

function rowForMissing(expected: GroundedProposal): ProposalReviewRow {
  return {
    proposalId: expected.proposalId,
    target: targetName(expected),
    expectedValue: valueText(expected),
    proposedValue: "[missing]",
    excerpt: "[missing source]",
    automaticPass: false,
  };
}

function targetName(proposal: GroundedProposal): string {
  return `${proposal.target.entity}:${proposal.target.entityId}:${proposal.target.field}`;
}

function valueText(proposal: GroundedProposal): string {
  return JSON.stringify(proposal.value);
}

