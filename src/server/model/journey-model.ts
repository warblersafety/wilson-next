import type { ParsedModelProposalEnvelope } from "../../domain/case/model-boundary";

export type ModelTurn = "opening" | "correction";

export interface ModelCallMetrics {
  model: string;
  promptRevision: string;
  schemaRevision: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface ModelProposalResult {
  envelope: ParsedModelProposalEnvelope;
  metrics?: ModelCallMetrics;
}

export class ModelCallFailure extends Error {
  constructor(message: string, readonly metrics?: ModelCallMetrics) {
    super(message);
    this.name = "ModelCallFailure";
  }
}

export interface JourneyModel {
  propose(turn: ModelTurn, text: string): Promise<ModelProposalResult>;
}
