import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AnthropicModelResponse } from "../../src/server/model/anthropic-journey";
import type { ModelTurn } from "../../src/server/model/journey-model";
import type { Stage2CallSlot } from "./stage-2-inputs";

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

export interface Stage2VerdictArtifact {
  kind: "experiment-2-stage-2-human-verdict";
  slot: Stage2CallSlot;
  verdict: "pass" | "fail";
  assessment: string;
  boundaryAccepted: boolean;
  metrics: {
    model: string;
    promptRevision: string;
    schemaRevision: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    estimatedCostUsd: number;
  } | null;
  cumulativeEstimatedCostUsd: number;
  recordedAt: string;
}

export async function writeStage2VerdictArtifact(
  artifact: Stage2VerdictArtifact,
  directory: string,
): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const destination = resolve(directory, `verdict-${artifact.slot}.json`);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, destination);
  await chmod(destination, 0o600);
  return destination;
}
