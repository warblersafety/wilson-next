import { randomUUID } from "node:crypto";
import { access, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { createSemanticCase } from "../../src/domain/case/create";
import type { Fact, SemanticCase } from "../../src/domain/case/types";
import { applyCaseCommandToRepository } from "../../src/server/case/apply-command";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { createAnthropicJourneyModel } from "../../src/server/model/anthropic-journey";
import {
  ModelCallFailure,
  type JourneyModel,
  type ModelCallMetrics,
  type ModelFailureDiagnostic,
} from "../../src/server/model/journey-model";
import { createReviewedCaseModelContext } from "../../src/server/model/reviewed-case-context";
import {
  writeSampleResponseArtifact,
  writeStage2VerdictArtifact,
} from "./sample-artifacts";
import {
  STAGE_2_CALL_SLOTS,
  stage2Input,
  type Stage2CallSlot,
} from "./stage-2-inputs";

export const STAGE_2_CALL_LIMIT = STAGE_2_CALL_SLOTS.length;
export const STAGE_2_COST_LIMIT_USD = 5;
export const STAGE_2_PER_CALL_RESERVE_USD = 1.5;
export const STAGE_2_STATE_PATH = resolve(".wilson-experiment-2-stage-2-state.json");
export const STAGE_2_ARTIFACT_DIRECTORY = resolve(".wilson-experiment-2-stage-2");
const STAGE_2_LOCK_PATH = resolve(".wilson-experiment-2-stage-2-state.lock");
const EXPECTED_REPOSITORY = "/Users/sofa-claude/code/warblersafety/wilson-next";
const AUTHORIZATION_PHRASE = "issue-47-three-calls-usd-5";

export interface Stage2Attempt {
  number: number;
  slot: Stage2CallSlot;
  turn: "opening" | "correction";
  status: "running" | "awaiting-human-review" | "passed" | "failed" | "stopped";
  metrics: ModelCallMetrics | null;
  boundaryAccepted: boolean;
  humanVerdict: "pass" | "fail" | null;
  humanAssessment: string | null;
  responseArtifact: string | null;
  lastFailure: ModelFailureDiagnostic | null;
}

export interface Stage2GateRecord {
  version: 1;
  status: "running" | "awaiting-human-review" | "stopped" | "complete";
  attempts: Stage2Attempt[];
  stopReason: string | null;
}

export interface HumanVerdict {
  verdict: "pass" | "fail";
  assessment: string;
}

export type HumanReviewer = (
  slot: Stage2CallSlot,
  attempt: Stage2Attempt,
  proposedCase: SemanticCase,
) => Promise<HumanVerdict>;

export interface Stage2GateResult {
  record: Stage2GateRecord;
  richCase: SemanticCase | null;
  repeatedCase: SemanticCase | null;
}

export async function runStage2Gate(): Promise<void> {
  assertCredentialRuntime();
  await withGateLock(async () => {
    let record = await loadGateRecordForRun();
    if (record) {
      record = await resumeInterruptedRichOpeningReview(record);
      if (record.status === "stopped") {
        throw new Error(`Stage 2 stopped: ${record.stopReason ?? "operator decision"}. No retry was attempted.`);
      }
    }
    let currentAttempt = 0;
    const model = createAnthropicJourneyModel(
      undefined,
      Date.now,
      (turn, response) => writeSampleResponseArtifact(
        currentAttempt,
        turn,
        response,
        STAGE_2_ARTIFACT_DIRECTORY,
      ),
    );
    const result = await executeStage2Gate(
      model,
      promptForVerdict,
      saveGateRecord,
      (number) => { currentAttempt = number; },
      () => `case-${randomUUID()}`,
      writeStage2VerdictArtifact,
      record ?? undefined,
    );
    if (result.record.status !== "complete") {
      throw new Error(`Stage 2 stopped: ${result.record.stopReason ?? "operator decision"}. No retry was attempted.`);
    }
  });
}

export async function executeStage2Gate(
  model: JourneyModel,
  review: HumanReviewer,
  persist: (record: Stage2GateRecord) => Promise<void> = saveGateRecord,
  beforeCall: (number: number) => void = () => undefined,
  createCaseId: () => string = () => `case-${randomUUID()}`,
  writeVerdict: typeof writeStage2VerdictArtifact = writeStage2VerdictArtifact,
  initialRecord?: Stage2GateRecord,
): Promise<Stage2GateResult> {
  const record: Stage2GateRecord = initialRecord
    ?? { version: 1, status: "running", attempts: [], stopReason: null };
  assertRunnableRecord(record);
  let richCase: SemanticCase | null = null;
  let repeatedCase: SemanticCase | null = null;

  for (const slot of STAGE_2_CALL_SLOTS.slice(record.attempts.length)) {
    if (cumulativeCost(record) + STAGE_2_PER_CALL_RESERVE_USD > STAGE_2_COST_LIMIT_USD) {
      record.status = "stopped";
      record.stopReason = "The USD 5 cap has insufficient reserved capacity for another call.";
      await persist(record);
      break;
    }
    const input = stage2Input(slot);
    const attempt: Stage2Attempt = {
      number: record.attempts.length + 1,
      slot,
      turn: input.turn,
      status: "running",
      metrics: null,
      boundaryAccepted: false,
      humanVerdict: null,
      humanAssessment: null,
      responseArtifact: null,
      lastFailure: null,
    };
    record.attempts.push(attempt);
    record.status = "running";
    beforeCall(attempt.number);
    await persist(record);
    process.stdout.write(`Starting Stage 2 call ${attempt.number}/${STAGE_2_CALL_LIMIT} (cap $${STAGE_2_COST_LIMIT_USD}).\n`);

    const reviewedContext = slot === "repeated-update"
      ? createReviewedCaseModelContext(requireRepeatedCase(repeatedCase))
      : undefined;
    let result;
    try {
      result = await model.propose(input.turn, input.text, reviewedContext);
    } catch (error) {
      stopAttempt(attempt, record, error);
      await persist(record);
      break;
    }
    if (!result.metrics) {
      attempt.lastFailure = { phase: "metrics", responseArtifact: result.responseArtifact };
      attempt.responseArtifact = result.responseArtifact ?? null;
      attempt.status = "stopped";
      record.status = "stopped";
      record.stopReason = `${slot} returned no metrics.`;
      await persist(record);
      break;
    }
    attempt.metrics = result.metrics;
    attempt.responseArtifact = result.responseArtifact ?? null;
    if (cumulativeCost(record) > STAGE_2_COST_LIMIT_USD) {
      attempt.lastFailure = { phase: "spend-cap", responseArtifact: result.responseArtifact };
      attempt.status = "stopped";
      record.status = "stopped";
      record.stopReason = "The recorded cost exceeded the USD 5 cap.";
      await persist(record);
      break;
    }

    let proposedCase: SemanticCase;
    let pendingGroups: string[];
    try {
      const initialCase = input.turn === "opening"
        ? createSemanticCase(createCaseId())
        : requireRepeatedCase(repeatedCase);
      const repository = new InMemoryCaseRepository({ initialCase, maxCases: 1 });
      proposedCase = await applyCaseCommandToRepository(repository, initialCase.id, {
        type: "attach-grounded-proposals",
        commandId: `command-stage-2-${slot}-attach`,
        expectedRevision: initialCase.revision,
        ...result.envelope,
      });
      pendingGroups = [...new Set(result.envelope.proposals.map(({ groupId }) => groupId))];
    } catch (error) {
      stopCaseReplay(attempt, record, error);
      await persist(record);
      break;
    }

    attempt.boundaryAccepted = true;
    attempt.status = "awaiting-human-review";
    record.status = "awaiting-human-review";
    await persist(record);
    printReview(attempt, proposedCase);
    const verdict = await review(slot, attempt, proposedCase);
    if (!verdict.assessment.trim()) throw new Error("A human verdict requires a sanitized assessment.");
    attempt.humanVerdict = verdict.verdict;
    attempt.humanAssessment = verdict.assessment.trim();
    await writeVerdict({
      kind: "experiment-2-stage-2-human-verdict",
      slot,
      verdict: verdict.verdict,
      assessment: attempt.humanAssessment,
      boundaryAccepted: true,
      metrics: attempt.metrics,
      cumulativeEstimatedCostUsd: cumulativeCost(record),
      recordedAt: new Date().toISOString(),
    }, STAGE_2_ARTIFACT_DIRECTORY);
    if (verdict.verdict === "fail") {
      attempt.status = "failed";
      record.status = "stopped";
      record.stopReason = `${slot} failed human semantic review.`;
      await persist(record);
      break;
    }

    if (slot === "rich-opening") richCase = proposedCase;
    if (slot === "repeated-opening") {
      try {
        const repository = new InMemoryCaseRepository({ initialCase: proposedCase, maxCases: 1 });
        repeatedCase = await applyCaseCommandToRepository(repository, proposedCase.id, {
          type: "review-proposal-groups",
          commandId: `command-stage-2-${slot}-accept`,
          expectedRevision: proposedCase.revision,
          decisions: pendingGroups.map((groupId) => ({ groupId, action: "accept" as const })),
        });
      } catch (error) {
        stopCaseReplay(attempt, record, error);
        await persist(record);
        break;
      }
    }
    attempt.status = "passed";
    record.status = "running";
    await persist(record);
  }

  if (record.attempts.length === STAGE_2_CALL_LIMIT
    && record.attempts.every(({ status }) => status === "passed")) {
    record.status = "complete";
    await persist(record);
  }
  return { record, richCase, repeatedCase };
}

export function cumulativeCost(record: Stage2GateRecord): number {
  return record.attempts.reduce((total, attempt) => (
    total + (attempt.metrics?.estimatedCostUsd ?? STAGE_2_PER_CALL_RESERVE_USD)
  ), 0);
}

function requireRepeatedCase(caseState: SemanticCase | null): SemanticCase {
  if (!caseState) throw new Error("The reviewed repeated-product opening is unavailable.");
  return caseState;
}

function stopAttempt(attempt: Stage2Attempt, record: Stage2GateRecord, error: unknown): void {
  if (error instanceof ModelCallFailure) {
    attempt.lastFailure = error.diagnostic;
    attempt.metrics = error.metrics ?? null;
    attempt.responseArtifact = error.diagnostic.responseArtifact ?? null;
  } else {
    attempt.lastFailure = { phase: "provider-request", errorName: error instanceof Error ? error.name : typeof error };
  }
  attempt.status = "stopped";
  record.status = "stopped";
  record.stopReason = `${attempt.slot} failed at the model boundary.`;
}

function stopCaseReplay(attempt: Stage2Attempt, record: Stage2GateRecord, error: unknown): void {
  attempt.lastFailure = {
    phase: "case-replay",
    responseArtifact: attempt.responseArtifact ?? undefined,
    errorName: error instanceof Error ? error.name : typeof error,
  };
  attempt.status = "stopped";
  record.status = "stopped";
  record.stopReason = `${attempt.slot} could not enter the authoritative case boundary.`;
}

function printReview(attempt: Stage2Attempt, caseState: SemanticCase): void {
  const sources = new Map(caseState.sources.map((source) => [source.id, source]));
  process.stdout.write(`\nCALL ${attempt.number}/${STAGE_2_CALL_LIMIT}: ${attempt.slot}\n`);
  process.stdout.write("Boundary accepted. This is not a semantic pass. Inspect every proposal manually.\n");
  for (const entity of [caseState.patient, caseState.event, ...caseState.products]) {
    for (const [field, fact] of Object.entries(entity.facts)) {
      for (const proposal of (fact as Fact<unknown>).proposedValues) {
        const excerpts = proposal.sourceIds.map((id) => sources.get(id)?.excerpt ?? "[missing source]");
        process.stdout.write(`${entity.id}.${field} ${proposal.intent} ${JSON.stringify(proposal.value)}\n`);
        process.stdout.write(`  evidence: ${JSON.stringify(excerpts)}\n`);
      }
    }
  }
  process.stdout.write(`Metrics: ${JSON.stringify(attempt.metrics)}\n`);
  process.stdout.write(`Raw response artifact: ${attempt.responseArtifact ?? "unavailable"}\n`);
}

async function promptForVerdict(slot: Stage2CallSlot): Promise<HumanVerdict> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question(`${slot}: enter PASS [assessment] or FAIL <assessment>\n> `)).trim();
    const [word, ...rest] = answer.split(/\s+/);
    const verdict = word?.toUpperCase();
    if (!["PASS", "FAIL"].includes(verdict)) throw new Error("The operator must enter PASS or FAIL.");
    const assessment = rest.join(" ").trim()
      || (verdict === "PASS" ? "No material semantic failure observed." : "");
    if (!assessment) throw new Error("A failed verdict requires a sanitized assessment.");
    return { verdict: verdict === "PASS" ? "pass" : "fail", assessment };
  } finally {
    prompt.close();
  }
}

async function loadGateRecordForRun(): Promise<Stage2GateRecord | null> {
  try {
    await access(STAGE_2_STATE_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const retained = JSON.parse(await readFile(STAGE_2_STATE_PATH, "utf8")) as Stage2GateRecord;
  if (isInterruptedRichOpeningReview(retained)) return retained;
  throw new Error(`Stage 2 already has retained state (${String(retained.status ?? "unknown")}); do not retry or replace it.`);
}

export async function resumeInterruptedRichOpeningReview(
  record: Stage2GateRecord,
  review: (slot: Stage2CallSlot, attempt: Stage2Attempt) => Promise<HumanVerdict> = promptForVerdict,
  persist: (record: Stage2GateRecord) => Promise<void> = saveGateRecord,
  writeVerdict: typeof writeStage2VerdictArtifact = writeStage2VerdictArtifact,
): Promise<Stage2GateRecord> {
  if (!isInterruptedRichOpeningReview(record)) {
    throw new Error("Only the retained rich-opening human review can be resumed without another model call.");
  }
  const attempt = record.attempts[0];
  process.stdout.write("Resuming the saved rich-opening review. No model call will be repeated.\n");
  process.stdout.write(`Metrics: ${JSON.stringify(attempt.metrics)}\n`);
  process.stdout.write(`Raw response artifact: ${attempt.responseArtifact ?? "unavailable"}\n`);
  const verdict = await review(attempt.slot, attempt);
  if (!verdict.assessment.trim()) throw new Error("A human verdict requires a sanitized assessment.");
  attempt.humanVerdict = verdict.verdict;
  attempt.humanAssessment = verdict.assessment.trim();
  await writeVerdict({
    kind: "experiment-2-stage-2-human-verdict",
    slot: attempt.slot,
    verdict: verdict.verdict,
    assessment: attempt.humanAssessment,
    boundaryAccepted: true,
    metrics: attempt.metrics,
    cumulativeEstimatedCostUsd: cumulativeCost(record),
    recordedAt: new Date().toISOString(),
  }, STAGE_2_ARTIFACT_DIRECTORY);
  if (verdict.verdict === "fail") {
    attempt.status = "failed";
    record.status = "stopped";
    record.stopReason = `${attempt.slot} failed human semantic review.`;
  } else {
    attempt.status = "passed";
    record.status = "running";
  }
  await persist(record);
  return record;
}

function isInterruptedRichOpeningReview(record: Stage2GateRecord): boolean {
  const [attempt] = record.attempts;
  return record.version === 1
    && record.status === "awaiting-human-review"
    && record.stopReason === null
    && record.attempts.length === 1
    && attempt?.number === 1
    && attempt.slot === "rich-opening"
    && attempt.turn === "opening"
    && attempt.status === "awaiting-human-review"
    && attempt.metrics !== null
    && attempt.boundaryAccepted
    && attempt.humanVerdict === null
    && attempt.humanAssessment === null;
}

function assertRunnableRecord(record: Stage2GateRecord): void {
  if (record.version !== 1 || record.status !== "running" || record.stopReason !== null) {
    throw new Error("Stage 2 retained state is not runnable.");
  }
  for (const [index, attempt] of record.attempts.entries()) {
    if (attempt.number !== index + 1
      || attempt.slot !== STAGE_2_CALL_SLOTS[index]
      || attempt.status !== "passed"
      || attempt.humanVerdict !== "pass"
      || !attempt.boundaryAccepted
      || !attempt.metrics) {
      throw new Error("Stage 2 retained attempts are not a completed prefix of the approved call sequence.");
    }
  }
  if (record.attempts.length > 1) {
    throw new Error("Only the interrupted rich-opening review is approved for recovery.");
  }
}

async function saveGateRecord(record: Stage2GateRecord): Promise<void> {
  const temporary = `${STAGE_2_STATE_PATH}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, STAGE_2_STATE_PATH);
}

async function withGateLock<T>(operation: () => Promise<T>): Promise<T> {
  let lock;
  try {
    lock = await open(STAGE_2_LOCK_PATH, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Another Stage 2 gate operation is active or needs operator recovery.");
    }
    throw error;
  }
  try {
    return await operation();
  } finally {
    await lock.close();
    await unlink(STAGE_2_LOCK_PATH);
  }
}

function assertCredentialRuntime(): void {
  if (process.cwd() !== EXPECTED_REPOSITORY) throw new Error("Run the gate from the Wilson Next repository root.");
  const socket = process.env.TMUX?.split(",", 1)[0];
  if (!socket?.endsWith("/wilson-next")) {
    throw new Error("Run the gate only inside the documented wilson-next tmux server.");
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("The Wilson-specific model credential is not ready.");
  if (process.env.WILSON_STAGE_2_LIVE_AUTHORIZATION !== AUTHORIZATION_PHRASE) {
    throw new Error("The exact Stage 2 live authorization phrase is not present.");
  }
}
