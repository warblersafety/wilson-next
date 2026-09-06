import { open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { ModelCallMetrics, ModelTurn } from "../../src/server/model/journey-model";

export const SAMPLE_LIMIT = 4;
export const COST_LIMIT_USD = 5;
// This is a spend reservation, not a token budget. It covers one call even if
// the model uses its full provider output capacity for the fixed short input.
export const PER_CALL_RESERVE_USD = 1.5;
export const SAMPLE_STATE_PATH = resolve(".wilson-model-sample-state.json");
const SAMPLE_LOCK_PATH = resolve(".wilson-model-sample-state.lock");

const metricsSchema = z.object({
  turn: z.enum(["opening", "correction"]),
  model: z.string().min(1),
  promptRevision: z.string().min(1),
  schemaRevision: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  automaticPass: z.boolean(),
  issueCount: z.number().int().nonnegative(),
}).strict();

const sampleStateSchema = z.object({
  version: z.literal(1),
  samples: z.array(z.object({
    number: z.number().int().positive(),
    status: z.enum(["running", "awaiting-human-review", "complete", "stopped"]),
    calls: z.array(metricsSchema).max(2),
    humanVerdict: z.enum(["pass", "fail"]).nullable(),
    disposition: z.enum(["none", "approved-remove-artificial-output-ceiling"]).default("none"),
  }).strict()).max(SAMPLE_LIMIT),
}).strict();

export interface RecordedCall extends ModelCallMetrics {
  turn: ModelTurn;
  automaticPass: boolean;
  issueCount: number;
}

export interface RecordedSample {
  number: number;
  status: "running" | "awaiting-human-review" | "complete" | "stopped";
  calls: RecordedCall[];
  humanVerdict: "pass" | "fail" | null;
  disposition: "none" | "approved-remove-artificial-output-ceiling";
}

export interface SampleState {
  version: 1;
  samples: RecordedSample[];
}

export async function loadSampleState(): Promise<SampleState> {
  try {
    const parsed = sampleStateSchema.parse(JSON.parse(await readFile(SAMPLE_STATE_PATH, "utf8")));
    parsed.samples.forEach((sample, index) => {
      if (sample.number !== index + 1) throw new Error("Sample state numbering is invalid");
      if (sample.status === "complete" && sample.humanVerdict !== "pass") {
        throw new Error("A complete sample requires a passing human verdict");
      }
      if (sample.status === "awaiting-human-review" && sample.humanVerdict !== null) {
        throw new Error("A pending sample cannot have a human verdict");
      }
    });
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, samples: [] };
    throw error;
  }
}

export async function withSampleLock<T>(operation: () => Promise<T>): Promise<T> {
  let lock;
  try {
    lock = await open(SAMPLE_LOCK_PATH, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Another model-sample operation is active or needs operator recovery.");
    }
    throw error;
  }
  try {
    return await operation();
  } finally {
    await lock.close();
    await unlink(SAMPLE_LOCK_PATH);
  }
}

export async function saveSampleState(state: SampleState): Promise<void> {
  const temporary = `${SAMPLE_STATE_PATH}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, SAMPLE_STATE_PATH);
}

export function cumulativeCost(state: SampleState): number {
  return state.samples.flatMap(({ calls }) => calls)
    .reduce((total, call) => total + call.estimatedCostUsd, 0);
}

export function assertMayStartSample(state: SampleState): void {
  if (state.samples.length >= SAMPLE_LIMIT) throw new Error("The four-sample cap has been reached.");
  const prior = state.samples.at(-1);
  const priorPassed = prior?.status === "complete" && prior.humanVerdict === "pass";
  const priorAdjustmentApproved = prior?.status === "stopped"
    && prior.disposition === "approved-remove-artificial-output-ceiling";
  if (prior && !priorPassed && !priorAdjustmentApproved) {
    throw new Error("The prior sample has not received a passing human review.");
  }
  const reserved = PER_CALL_RESERVE_USD * 2;
  if (cumulativeCost(state) + reserved > COST_LIMIT_USD) {
    throw new Error("The USD 5 sample cap does not have enough reserved capacity for a complete sample.");
  }
}
