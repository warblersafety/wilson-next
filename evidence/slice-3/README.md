# Experiment 1 Slice 3 model evidence

This directory retains the permitted short model record for the capped
real-model sample. It contains no credential, raw provider payload, narrative
copy, case record, or PDF.

## Sample 1 — stopped during opening

- Local date: 2026-09-05
- Source revision: `74428e74082bdd791209b881118d0164f7656f65`
- Model: `claude-sonnet-5`
- SDK: `@anthropic-ai/sdk` 0.124.0
- Prompt revision: `wilson-experiment-1-extraction-v1`
- Schema revision: `wilson-grounded-proposals-v1`
- Sampling: provider defaults; no tools; no automatic retry
- Opening input tokens: 3,112
- Opening output tokens: 8,192
- Latency: 65,419 ms
- Estimated cost: USD 0.088144 at USD 2/input MTok and USD 10/output
  MTok
- Correction call: not attempted
- Automated semantic score: not reached; output did not safely complete the
  grounded-proposal boundary
- Human semantic score: not performed because no accepted structured proposal
  was available for review
- Case effect: none; the proposal failed before the journey service or
  `applyCaseCommand`

The output-token count exactly reached the configured 8,192-token maximum.
This strongly indicates truncation at that ceiling. The runner recorded the
attempt as stopped and blocks further samples. No retry occurred.

During this attempt, the outer Vitest operator wrapper reported a passing test
because the inner runner returned after marking the durable state stopped. The
state and call cap remained fail-closed, so no additional request was possible.
The subsequent implementation change makes any stopped inner run throw so the
operator command also exits nonzero. This is a runner-reporting defect, not a
second model result.

Resuming the sample requires an explicit disposition of the model-output
ceiling. Do not change effort, model, provider, prompt responsibility, or schema
and do not make another call without that decision.
