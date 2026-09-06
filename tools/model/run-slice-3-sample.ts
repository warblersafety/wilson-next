import { createAnthropicJourneyModel } from "../../src/server/model/anthropic-journey";
import { assessModelProposals, type SampleAssessment } from "../../src/server/model/sample-oracle";
import {
  ModelCallFailure,
  type ModelProposalResult,
  type ModelTurn,
} from "../../src/server/model/journey-model";
import { correctionAccount, openingAccount } from "../../src/experiment/fixed-inputs";
import { indicationAnswer } from "../../src/experiment/fixed-inputs";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { performJourneyAction } from "../../src/server/journey/service";
import {
  assertMayStartSample,
  COST_LIMIT_USD,
  cumulativeCost,
  loadSampleState,
  SAMPLE_LIMIT,
  saveSampleState,
  withSampleLock,
  type RecordedSample,
  type SampleState,
} from "./sample-state";

const EXPECTED_REPOSITORY = "/Users/sofa-claude/code/warblersafety/wilson-next";

export async function runSlice3Sample(): Promise<void> {
  assertCredentialRuntime();
  await withSampleLock(runLockedSample);
}

async function runLockedSample(): Promise<void> {
  const state = await loadSampleState();
  assertMayStartSample(state);
  const sample: RecordedSample = {
    number: state.samples.length + 1,
    status: "running",
    calls: [],
    humanVerdict: null,
    disposition: "none",
  };
  state.samples.push(sample);
  await saveSampleState(state);

  const model = createAnthropicJourneyModel();
  const repository = new InMemoryCaseRepository();
  const caseId = `case-model-sample-${sample.number}`;
  const openingCompleted = await runTurn(
    model.propose("opening", openingAccount),
    "opening",
    sample,
    state,
    async (result) => {
      await performJourneyAction(
        repository,
        caseId,
        { action: "submit-opening", text: openingAccount, reportType: "adverse-event" },
        replay("opening", result),
      );
    },
  );
  if (!openingCompleted) throw new Error("The opening call stopped Slice 3; no retry was attempted.");
  await performJourneyAction(repository, caseId, { action: "accept-understanding" });
  await performJourneyAction(repository, caseId, { action: "answer-indications", text: indicationAnswer });

  const correctionCompleted = await runTurn(
    model.propose("correction", correctionAccount),
    "correction",
    sample,
    state,
    async (result) => {
      await performJourneyAction(
        repository,
        caseId,
        { action: "submit-correction", text: correctionAccount },
        replay("correction", result),
      );
    },
  );
  if (!correctionCompleted) throw new Error("The correction call stopped Slice 3; no retry was attempted.");

  sample.status = "awaiting-human-review";
  await saveSampleState(state);
  process.stdout.write(`\nSample ${sample.number} passed automated oracle checks and awaits human review.\n`);
  process.stdout.write(`Recorded estimated cost: $${sample.calls.reduce((sum, call) => sum + call.estimatedCostUsd, 0).toFixed(6)}.\n`);
}

async function runTurn(
  pending: Promise<ModelProposalResult>,
  turn: ModelTurn,
  sample: RecordedSample,
  state: SampleState,
  applyToJourney: (result: ModelProposalResult) => Promise<void>,
): Promise<boolean> {
  let result: ModelProposalResult;
  try {
    result = await pending;
  } catch (error) {
    if (error instanceof ModelCallFailure && error.metrics) {
      sample.calls.push({
        turn,
        ...error.metrics,
        automaticPass: false,
        issueCount: 1,
      });
    }
    sample.status = "stopped";
    await saveSampleState(state);
    process.stderr.write(`${turn} call failed safely; no retry was attempted. Slice 3 is stopped.\n`);
    return false;
  }
  if (!result.metrics) throw new Error("A real-model sample must report call metrics.");
  const assessment = assessModelProposals(turn, result.envelope);
  sample.calls.push({
    turn,
    ...result.metrics,
    automaticPass: assessment.automaticPass,
    issueCount: assessment.issues.length,
  });
  if (cumulativeCost(state) > COST_LIMIT_USD) {
    sample.status = "stopped";
    await saveSampleState(state);
    throw new Error("The recorded cost exceeded the USD 5 cap.");
  }
  printAssessment(turn, assessment);
  if (!assessment.automaticPass) {
    sample.status = "stopped";
    await saveSampleState(state);
    process.stderr.write(`${turn} did not match the semantic oracle. Slice 3 is stopped.\n`);
    return false;
  }
  try {
    await applyToJourney(result);
  } catch {
    const recorded = sample.calls.at(-1);
    if (recorded?.turn === turn) {
      recorded.automaticPass = false;
      recorded.issueCount += 1;
    }
    sample.status = "stopped";
    await saveSampleState(state);
    process.stderr.write(`${turn} could not enter the authoritative journey path. Slice 3 is stopped.\n`);
    return false;
  }
  await saveSampleState(state);
  return true;
}

function replay(expectedTurn: ModelTurn, result: ModelProposalResult) {
  return {
    async propose(turn: ModelTurn): Promise<ModelProposalResult> {
      if (turn !== expectedTurn) throw new Error("Unexpected model turn");
      return result;
    },
  };
}

function printAssessment(turn: ModelTurn, assessment: SampleAssessment): void {
  process.stdout.write(`\n${turn.toUpperCase()} HUMAN REVIEW\n`);
  process.stdout.write("Inspect whether each exact excerpt genuinely supports its proposed value and entity.\n");
  for (const row of assessment.proposals) {
    process.stdout.write(`${row.automaticPass ? "PASS" : "FAIL"} ${row.proposalId}\n`);
    process.stdout.write(`  target: ${row.target}\n`);
    process.stdout.write(`  expected: ${row.expectedValue}\n`);
    process.stdout.write(`  proposed: ${row.proposedValue}\n`);
    process.stdout.write(`  excerpt: ${JSON.stringify(row.excerpt)}\n`);
  }
  for (const issue of assessment.issues) process.stdout.write(`ISSUE ${issue}\n`);
}

function assertCredentialRuntime(): void {
  if (process.cwd() !== EXPECTED_REPOSITORY) {
    throw new Error("Run the sample from the Wilson Next repository root.");
  }
  const socket = process.env.TMUX?.split(",", 1)[0];
  if (!socket?.endsWith("/wilson-next")) {
    throw new Error("Run the sample only inside the documented wilson-next tmux server.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("The Wilson-specific model credential is not ready.");
  }
  process.stdout.write(`Starting one capped complete sample (maximum ${SAMPLE_LIMIT} samples / $${COST_LIMIT_USD}).\n`);
}
