import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AnthropicModelResponse } from "../../src/server/model/anthropic-journey";
import { writeSampleResponseArtifact } from "../../tools/model/sample-artifacts";

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
});
