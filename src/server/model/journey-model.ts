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
  responseArtifact?: string;
}

export type ModelFailurePhase =
  | "provider-request"
  | "response-capture"
  | "provider-stop"
  | "structured-json"
  | "structured-schema"
  | "domain-boundary"
  | "metrics"
  | "spend-cap"
  | "semantic-oracle"
  | "case-replay";

export interface ModelDiagnosticIssue {
  path: string;
  code: string;
  message: string;
}

export interface ModelFailureDiagnostic {
  phase: ModelFailurePhase;
  providerStatus?: number;
  providerType?: string;
  requestId?: string;
  stopReason?: string;
  errorName?: string;
  responseArtifact?: string;
  issues?: ModelDiagnosticIssue[];
}

export class ModelCallFailure extends Error {
  constructor(
    message: string,
    readonly diagnostic: ModelFailureDiagnostic,
    readonly metrics?: ModelCallMetrics,
  ) {
    super(message);
    this.name = "ModelCallFailure";
  }
}

export interface JourneyModel {
  propose(turn: ModelTurn, text: string): Promise<ModelProposalResult>;
}
