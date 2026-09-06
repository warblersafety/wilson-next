import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AnthropicModelResponse } from "../../src/server/model/anthropic-journey";
import type { ModelTurn } from "../../src/server/model/journey-model";

export const SAMPLE_ARTIFACT_DIRECTORY = resolve(".wilson-model-samples");

export async function writeSampleResponseArtifact(
  sampleNumber: number,
  turn: ModelTurn,
  response: AnthropicModelResponse,
  directory = SAMPLE_ARTIFACT_DIRECTORY,
): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const destination = resolve(directory, `sample-${sampleNumber}-${turn}-response.json`);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify(response, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, destination);
  await chmod(destination, 0o600);
  return destination;
}
