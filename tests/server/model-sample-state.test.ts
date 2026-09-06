import { describe, expect, it } from "vitest";
import {
  assertMayStartSample,
  COST_LIMIT_USD,
  cumulativeCost,
  PER_CALL_RESERVE_USD,
  SAMPLE_LIMIT,
  type RecordedSample,
  type SampleState,
} from "../../tools/model/sample-state";

describe("real-model sample caps", () => {
  it("requires passing human review before another sample", () => {
    const state = withSamples([sample("awaiting-human-review", null)]);
    expect(() => assertMayStartSample(state)).toThrow("passing human review");
  });

  it("requires an explicit disposition before continuing after a stopped sample", () => {
    const stopped = sample("stopped", null);
    expect(() => assertMayStartSample(withSamples([stopped]))).toThrow("passing human review");

    stopped.disposition = "approved-remove-artificial-output-ceiling";
    expect(() => assertMayStartSample(withSamples([stopped]))).not.toThrow();
  });

  it("refuses a fifth sample", () => {
    const state = withSamples(Array.from({ length: SAMPLE_LIMIT }, () => sample("complete", "pass")));
    expect(() => assertMayStartSample(state)).toThrow("four-complete-sample cap");
  });

  it("does not mistake stopped attempts for complete samples", () => {
    const attempts = Array.from({ length: SAMPLE_LIMIT + 1 }, () => {
      const stopped = sample("stopped", null);
      stopped.disposition = "approved-source-and-measurement-contract";
      return stopped;
    });
    expect(() => assertMayStartSample(withSamples(attempts))).not.toThrow();
  });

  it("counts recorded call cost and reserves room under the USD cap", () => {
    const prior = sample("complete", "pass");
    prior.calls = [call(COST_LIMIT_USD - 0.49)];
    const state = withSamples([prior]);
    expect(cumulativeCost(state)).toBe(COST_LIMIT_USD - 0.49);
    expect(() => assertMayStartSample(state)).toThrow("USD 5 sample cap");
  });

  it("conservatively reserves spend when a provider request has no final usage", () => {
    const stopped = sample("stopped", null);
    stopped.lastFailure = { phase: "provider-request", errorName: "APIConnectionError" };

    expect(cumulativeCost(withSamples([stopped]))).toBe(PER_CALL_RESERVE_USD);
  });
});

function withSamples(samples: RecordedSample[]): SampleState {
  return { version: 1, samples: samples.map((entry, index) => ({ ...entry, number: index + 1 })) };
}
function sample(status: RecordedSample["status"], humanVerdict: RecordedSample["humanVerdict"]): RecordedSample {
  return { number: 0, status, calls: [], humanVerdict, disposition: "none", lastFailure: null };
}

function call(cost: number): RecordedSample["calls"][number] {
  return {
    turn: "opening",
    model: "claude-sonnet-5",
    promptRevision: "test",
    schemaRevision: "test",
    inputTokens: 1,
    outputTokens: 1,
    latencyMs: 1,
    estimatedCostUsd: cost,
    automaticPass: true,
    issueCount: 0,
  };
}
