import type { ParsedModelProposalEnvelope } from "../../domain/case/model-boundary";
import type { CaseValue } from "../../domain/case/types";

export type ModelTurn = "opening" | "correction";

export interface ReviewedFactContext {
  field: string;
  value: CaseValue<unknown>;
}

export interface ReviewedCaseModelContext {
  patient: ReviewedFactContext[];
  event: ReviewedFactContext[];
  products: Array<{
    id: string;
    name: string | null;
    facts: ReviewedFactContext[];
  }>;
}

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
  diagnosticResponse?: unknown;
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
  readonly returnedResponse?: unknown;

  constructor(
    message: string,
    readonly diagnostic: ModelFailureDiagnostic,
    readonly metrics?: ModelCallMetrics,
    returnedResponse?: unknown,
  ) {
    super(message);
    this.name = "ModelCallFailure";
    Object.defineProperty(this, "returnedResponse", {
      configurable: false,
      enumerable: false,
      value: returnedResponse,
      writable: false,
    });
  }
}

export interface JourneyModel {
  propose(
    turn: ModelTurn,
    text: string,
    reviewedCase?: ReviewedCaseModelContext,
  ): Promise<ModelProposalResult>;
}
