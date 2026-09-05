export type EntityState = "proposed" | "resolved" | "rejected";

export type NonKnownValue =
  | { kind: "unknown" }
  | { kind: "explicitly-absent" }
  | { kind: "inapplicable" }
  | { kind: "declined" };

export type CaseValue<T> =
  | { kind: "known"; value: T; qualifier?: string }
  | NonKnownValue;

export interface GroundedValue<T> {
  id: string;
  groupId: string;
  intent: "fact" | "correction" | "alternative";
  value: CaseValue<T>;
  sourceIds: string[];
}

export type FactState = "empty" | "proposed" | "resolved" | "conflicted";

export interface Fact<T> {
  state: FactState;
  proposedValues: GroundedValue<T>[];
  resolvedValue?: GroundedValue<T>;
  conflictingValues: GroundedValue<T>[];
  sourceIds: string[];
  supersededValues: GroundedValue<T>[];
}

export interface PatientFacts {
  identifier: Fact<string>;
  ageYears: Fact<number>;
  sex: Fact<"female" | "male" | "intersex">;
}

export interface EventFacts {
  symptoms: Fact<string[]>;
  onsetDate: Fact<string>;
  hospitalized: Fact<boolean>;
  hemoglobin: Fact<string>;
  treatments: Fact<string[]>;
  outcome: Fact<string>;
  dischargeDate: Fact<string>;
}

export interface ProductFacts {
  name: Fact<string>;
  role: Fact<"suspect" | "concomitant">;
  dose: Fact<string>;
  frequency: Fact<string>;
  route: Fact<string>;
  startDate: Fact<string>;
  stopDate: Fact<string>;
  indication: Fact<string>;
  stopped: Fact<boolean>;
}

export interface PatientEntity {
  id: "patient";
  state: EntityState;
  facts: PatientFacts;
}

export interface EventEntity {
  id: "event";
  state: EntityState;
  facts: EventFacts;
}

export interface ProductEntity {
  id: string;
  proposalGroupId: string;
  state: EntityState;
  facts: ProductFacts;
}

export type InputType = "narrative" | "answer" | "correction" | "resolution";

export interface Source {
  id: string;
  inputId: string;
  inputType: InputType;
  excerpt: string;
  start: number;
  end: number;
  actor: "clinician";
  recordedAt: string;
}

export type SemanticNeedKey = "suspect-product-indications";

export interface AskedNeed {
  key: SemanticNeedKey;
  productIds: string[];
  status: "open" | "answered" | "declined";
}

export interface Change {
  commandId: string;
  type: CaseCommandType;
  affectedTargets: string[];
  sourceIds: string[];
  priorRevision: number;
  resultingRevision: number;
  supersessions: string[];
  resolutions: string[];
}

export interface SemanticCase {
  id: string;
  revision: number;
  patient: PatientEntity;
  event: EventEntity;
  products: ProductEntity[];
  askedNeeds: AskedNeed[];
  sources: Source[];
  changes: Change[];
}

export type PatientFactKey = keyof PatientFacts;
export type EventFactKey = keyof EventFacts;
export type ProductFactKey = keyof ProductFacts;

export type FactTarget =
  | { entity: "patient"; entityId: "patient"; field: PatientFactKey }
  | { entity: "event"; entityId: "event"; field: EventFactKey }
  | { entity: "product"; entityId: string; field: ProductFactKey };

export interface GroundedProposal {
  proposalId: string;
  groupId: string;
  intent: GroundedValue<unknown>["intent"];
  target: FactTarget;
  value: CaseValue<unknown>;
  sourceIds: string[];
}

export interface ProposedProduct {
  id: string;
  groupId: string;
}

interface CommandEnvelope {
  commandId: string;
  expectedRevision: number;
}

export interface AttachGroundedProposalsCommand extends CommandEnvelope {
  type: "attach-grounded-proposals";
  products: ProposedProduct[];
  sources: Source[];
  proposals: GroundedProposal[];
}

export interface ReviewProposalGroupsCommand extends CommandEnvelope {
  type: "review-proposal-groups";
  decisions: ProposalGroupDecision[];
}

export type ProposalGroupDecision =
  | {
      groupId: string;
      action: "accept";
      corrections?: Array<{
        proposalId: string;
        replacementId: string;
        value: CaseValue<unknown>;
        source: Source;
      }>;
    }
  | { groupId: string; action: "reject" };

export interface RecordClinicianFactsCommand extends CommandEnvelope {
  type: "record-clinician-facts";
  source: Source;
  facts: Array<{
    id: string;
    target: FactTarget;
    intent: GroundedValue<unknown>["intent"];
    value: CaseValue<unknown>;
  }>;
  answersNeed?: SemanticNeedKey;
}

export interface RecordAskedNeedCommand extends CommandEnvelope {
  type: "record-asked-need";
  key: SemanticNeedKey;
  productIds: string[];
}

export interface ResolveConflictCommand extends CommandEnvelope {
  type: "resolve-conflict";
  target: FactTarget;
  chosenValueId: string;
  source: Source;
}

export type CaseCommand =
  | AttachGroundedProposalsCommand
  | ReviewProposalGroupsCommand
  | RecordClinicianFactsCommand
  | RecordAskedNeedCommand
  | ResolveConflictCommand;

export type CaseCommandType = CaseCommand["type"];

export interface ApplyCaseCommandResult {
  case: SemanticCase;
  applied: boolean;
}
