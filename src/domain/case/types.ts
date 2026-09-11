export type EntityState = "proposed" | "resolved" | "rejected" | "withdrawn";

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
  weight: Fact<{ value: number; unit: "kg" | "lb" }>;
}

export type ReportType = "adverse-event" | "product-problem" | "adverse-event-and-product-problem";

export interface EventFacts {
  reportType: Fact<ReportType>;
  problemDescription: Fact<string>;
  symptoms: Fact<string[]>;
  onsetDate: Fact<string>;
  death: Fact<boolean>;
  deathDate: Fact<string>;
  lifeThreatening: Fact<boolean>;
  hospitalized: Fact<boolean>;
  disability: Fact<boolean>;
  requiredIntervention: Fact<boolean>;
  congenitalAnomaly: Fact<boolean>;
  otherSerious: Fact<boolean>;
  relevantTestsAvailable: Fact<boolean>;
  relevantHistory: Fact<string>;
  treatments: Fact<string[]>;
  outcome: Fact<string>;
  dischargeDate: Fact<string>;
  productAvailability: Fact<"available" | "not-available" | "returned-to-manufacturer">;
  productReturnDate: Fact<string>;
}

export interface RelevantTestFacts {
  testResult: Fact<string>;
  lowRange: Fact<string>;
  highRange: Fact<string>;
  date: Fact<string>;
}

export interface ReporterFacts {
  lastName: Fact<string>;
  firstName: Fact<string>;
  address: Fact<string>;
  city: Fact<string>;
  state: Fact<string>;
  postalCode: Fact<string>;
  country: Fact<string>;
  phone: Fact<string>;
  email: Fact<string>;
  healthProfessional: Fact<boolean>;
  occupation: Fact<string>;
  reportedTo: Fact<Array<"manufacturer" | "user-facility" | "distributor-importer" | "packer">>;
  doNotDiscloseIdentity: Fact<boolean>;
}

export interface ProductFacts {
  name: Fact<string>;
  productType: Fact<"drug-or-biologic" | "device" | "other">;
  role: Fact<"suspect" | "concomitant">;
  manufacturer: Fact<string>;
  lotNumber: Fact<string>;
  dose: Fact<string>;
  frequency: Fact<string>;
  route: Fact<string>;
  startDate: Fact<string>;
  stopDate: Fact<string>;
  indication: Fact<string>;
  stopped: Fact<boolean>;
  commonName: Fact<string>;
  procode: Fact<string>;
  modelNumber: Fact<string>;
  catalogNumber: Fact<string>;
  expirationDate: Fact<string>;
  serialNumber: Fact<string>;
  udi: Fact<string>;
  deviceOperator: Fact<"health-professional" | "patient-consumer" | "other">;
  implanted: Fact<boolean>;
  implantDate: Fact<string>;
  explantDate: Fact<string>;
  reprocessedSingleUse: Fact<boolean>;
  reprocessor: Fact<string>;
  servicedByThirdParty: Fact<"yes" | "no" | "unknown">;
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

export interface RelevantTestEntity {
  id: string;
  proposalGroupId: string;
  state: EntityState;
  facts: RelevantTestFacts;
}

export interface ReporterEntity {
  id: "reporter";
  facts: ReporterFacts;
}

export interface ProductEntity {
  id: string;
  proposalGroupId: string;
  state: EntityState;
  facts: ProductFacts;
}

export type InputType = "narrative" | "selection" | "answer" | "correction" | "resolution" | "reporter-entry";

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

export type SemanticNeedKey =
  | "suspect-product-indications"
  | "serious-outcomes"
  | "death-date"
  | "relevant-clinical-context"
  | "device-details"
  | "reporter-details";

export interface AskedNeed {
  key: SemanticNeedKey;
  targetIds: string[];
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
  relevantTests: RelevantTestEntity[];
  reporter: ReporterEntity;
  askedNeeds: AskedNeed[];
  sources: Source[];
  changes: Change[];
}

export type PatientFactKey = keyof PatientFacts;
export type EventFactKey = keyof EventFacts;
export type ProductFactKey = keyof ProductFacts;
export type RelevantTestFactKey = keyof RelevantTestFacts;
export type ReporterFactKey = keyof ReporterFacts;

export type FactTarget =
  | { entity: "patient"; entityId: "patient"; field: PatientFactKey }
  | { entity: "event"; entityId: "event"; field: EventFactKey }
  | { entity: "product"; entityId: string; field: ProductFactKey }
  | { entity: "test"; entityId: string; field: RelevantTestFactKey }
  | { entity: "reporter"; entityId: "reporter"; field: ReporterFactKey };

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

export interface ProposedRelevantTest {
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
  relevantTests?: ProposedRelevantTest[];
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
  relevantTests?: ProposedRelevantTest[];
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
  targetIds: string[];
}

export interface ResolveConflictCommand extends CommandEnvelope {
  type: "resolve-conflict";
  target: FactTarget;
  chosenValueId: string;
  source: Source;
}

export interface WithdrawCaseEntityCommand extends CommandEnvelope {
  type: "withdraw-case-entity";
  target: { entity: "product" | "test"; entityId: string };
  source: Source;
}

export type CaseCommand =
  | AttachGroundedProposalsCommand
  | ReviewProposalGroupsCommand
  | RecordClinicianFactsCommand
  | RecordAskedNeedCommand
  | ResolveConflictCommand
  | WithdrawCaseEntityCommand;

export type CaseCommandType = CaseCommand["type"];

export interface ApplyCaseCommandResult {
  case: SemanticCase;
  applied: boolean;
}
