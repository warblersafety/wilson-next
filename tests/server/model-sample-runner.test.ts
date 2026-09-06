import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openingAccount } from "../../src/experiment/fixed-inputs";
import { parseFixedOpeningResponse } from "../../src/server/model/fixed-journey";
import type { ModelProposalResult } from "../../src/server/model/journey-model";
import { runTurn } from "../../tools/model/run-slice-3-sample";
import type { RecordedSample, SampleState } from "../../tools/model/sample-state";

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => vi.restoreAllMocks());

describe("model sample operator diagnostics", () => {
  it("stops and records a missing metrics result", async () => {
    const { sample, state } = emptySample();
    const result = validOpeningResult();
    delete result.metrics;
    const persist = vi.fn(async () => undefined);

    await expect(runTurn(Promise.resolve(result), "opening", sample, state, async () => {}, persist))
      .rejects.toThrow("must report call metrics");
    expect(sample.lastFailure).toEqual({
      phase: "metrics",
      responseArtifact: ".wilson-model-samples/test.json",
    });
    expect(sample.status).toBe("stopped");
  });

  it("stops and records a response that breaches the experiment spend cap", async () => {
    const { sample, state } = emptySample();
    const result = validOpeningResult();
    result.metrics!.estimatedCostUsd = 5.01;
    const persist = vi.fn(async () => undefined);

    await expect(runTurn(Promise.resolve(result), "opening", sample, state, async () => {}, persist))
      .rejects.toThrow("exceeded the USD 5 cap");
    expect(sample.lastFailure).toEqual({
      phase: "spend-cap",
      responseArtifact: ".wilson-model-samples/test.json",
    });
    expect(sample.status).toBe("stopped");
  });

  it("records semantic-oracle failures with the retained response", async () => {
    const { sample, state } = emptySample();
    const result = validOpeningResult();
    result.envelope.proposals[0].value = { kind: "known", value: "WRONG" };
    const persist = vi.fn(async () => undefined);

    await expect(runTurn(Promise.resolve(result), "opening", sample, state, async () => {}, persist))
      .resolves.toBe(false);

    expect(sample.lastFailure).toMatchObject({
      phase: "semantic-oracle",
      responseArtifact: ".wilson-model-samples/test.json",
      issues: [{ code: "oracle_mismatch" }],
    });
    expect(persist).toHaveBeenCalledOnce();
  });

  it("records a case-replay failure after a semantically correct response", async () => {
    const { sample, state } = emptySample();
    const persist = vi.fn(async () => undefined);

    await expect(runTurn(
      Promise.resolve(validOpeningResult()),
      "opening",
      sample,
      state,
      async () => { throw new TypeError("case detail"); },
      persist,
    )).resolves.toBe(false);

    expect(sample.lastFailure).toEqual({
      phase: "case-replay",
      responseArtifact: ".wilson-model-samples/test.json",
      errorName: "TypeError",
    });
    expect(persist).toHaveBeenCalledOnce();
  });
});

function emptySample(): { sample: RecordedSample; state: SampleState } {
  const sample: RecordedSample = {
    number: 1,
    status: "running",
    calls: [],
    humanVerdict: null,
    disposition: "none",
    lastFailure: null,
  };
  return { sample, state: { version: 1, samples: [sample] } };
}

function validOpeningResult(): ModelProposalResult {
  return {
    envelope: parseFixedOpeningResponse(openingAccount),
    responseArtifact: ".wilson-model-samples/test.json",
    metrics: {
      model: "claude-sonnet-5",
      promptRevision: "test",
      schemaRevision: "test",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      estimatedCostUsd: 0.000012,
    },
  };
}
