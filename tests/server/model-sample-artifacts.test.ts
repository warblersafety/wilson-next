import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AnthropicModelResponse } from "../../src/server/model/anthropic-journey";
import {
  writeSampleResponseArtifact,
  writeStage2VerdictArtifact,
} from "../../tools/model/sample-artifacts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

describe("local model response artifacts", () => {
  it("retains the exact synthetic provider response with owner-only permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wilson-model-sample-"));
    temporaryDirectories.push(directory);
    const response: AnthropicModelResponse = {
      id: "message-test",
      model: "claude-sonnet-5",
      stop_reason: "end_turn",
      content: [{ type: "text", text: "synthetic response" }],
      usage: {
        input_tokens: 1,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        output_tokens: 2,
      },
    };

    const path = await writeSampleResponseArtifact(4, "opening", response, directory);

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(response);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("retains a sanitized Stage 2 verdict without the provider response", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wilson-stage-2-verdict-"));
    temporaryDirectories.push(directory);
    const path = await writeStage2VerdictArtifact({
      kind: "experiment-2-stage-2-human-verdict",
      slot: "rich-opening",
      verdict: "pass",
      assessment: "No material semantic failure observed.",
      boundaryAccepted: true,
      metrics: {
        model: "claude-sonnet-5",
        promptRevision: "test-prompt",
        schemaRevision: "test-schema",
        inputTokens: 10,
        outputTokens: 20,
        latencyMs: 30,
        estimatedCostUsd: 0.01,
      },
      cumulativeEstimatedCostUsd: 0.01,
      recordedAt: "2026-09-09T00:00:00.000Z",
    }, directory);

    const serialized = await readFile(path, "utf8");
    expect(JSON.parse(serialized)).toMatchObject({
      slot: "rich-opening",
      verdict: "pass",
      cumulativeEstimatedCostUsd: 0.01,
    });
    expect(serialized).not.toContain("responseArtifact");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
