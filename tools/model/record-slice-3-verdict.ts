import {
  cumulativeCost,
  loadSampleState,
  saveSampleState,
  withSampleLock,
} from "./sample-state.ts";

async function main(): Promise<void> {
  const [sampleText, verdictText] = process.argv.slice(2);
  const sampleNumber = Number(sampleText);
  if (!Number.isInteger(sampleNumber) || !["pass", "fail"].includes(verdictText)) {
    throw new Error("Usage: npm run sample:model:verdict -- <sample-number> <pass|fail>");
  }
  await withSampleLock(async () => {
    const state = await loadSampleState();
    const sample = state.samples.find(({ number }) => number === sampleNumber);
    if (!sample || sample.status !== "awaiting-human-review" || sample.humanVerdict !== null) {
      throw new Error("That sample is not awaiting a human verdict.");
    }
    sample.humanVerdict = verdictText as "pass" | "fail";
    sample.status = verdictText === "pass" ? "complete" : "stopped";
    await saveSampleState(state);

    process.stdout.write(`${JSON.stringify({
      sample: sample.number,
      status: sample.status,
      humanVerdict: sample.humanVerdict,
      calls: sample.calls,
      cumulativeEstimatedCostUsd: cumulativeCost(state),
    }, null, 2)}\n`);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "The verdict was not recorded.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
