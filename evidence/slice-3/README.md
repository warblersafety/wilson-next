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

Steve subsequently directed that artificial token ceilings be removed during
development and verification; Wilson's eventual runtime budget remains a later
operator decision. The Anthropic Messages API requires a `max_tokens` value, so
the follow-up implementation uses Sonnet 5's full 128,000-token provider output
capacity rather than a Wilson-selected budget. The model, default effort and
sampling, provider, prompt responsibility, schema, no-retry rule, and USD 5
experiment cap remain unchanged. Sample 1 remains recorded as stopped.

The first follow-up operator attempt (ledger sample 2) stopped locally before a
provider request was sent. Anthropic documents 128,000 as Sonnet 5's standard
maximum, but its TypeScript SDK requires streaming when `max_tokens` is above
the non-streaming timeout threshold. The attempt recorded no calls, usage, or
cost. The adapter now uses the SDK's structured-output streaming path and waits
for its final parsed message; this is an execution-harness correction, not a
change to the model, prompt, schema, or Wilson responsibility.

## Sample 3 — stopped during opening after streaming completion

- Local date: 2026-09-05
- Source revision: `71c1dfc6dd158553b1c89f219ac9991e7ca2f104`
- Model: `claude-sonnet-5`
- SDK: `@anthropic-ai/sdk` 0.124.0
- Prompt revision: `wilson-experiment-1-extraction-v1`
- Schema revision: `wilson-grounded-proposals-v1`
- Sampling: provider defaults; no tools; no automatic retry
- Opening input tokens: 3,112
- Opening output tokens: 14,012
- Latency: 110,737 ms
- Estimated cost: USD 0.146344
- Correction call: not attempted
- Automated semantic score: not reached; the response did not safely complete
  the grounded-proposal boundary
- Human semantic score: not performed because no accepted structured proposal
  was available for review
- Case effect: none; the proposal failed before the journey service or
  `applyCaseCommand`

This result did not reach the 128,000-token provider ceiling and exceeded the
removed 8,192-token Wilson ceiling, confirming that the artificial limit was
no longer controlling the run. The current fail-safe adapter retains usage but
does not distinguish in its durable record among a non-success stop reason, a
missing parsed structured output, and rejection by Wilson's domain boundary.
Slice 3 therefore stops rather than guessing or retrying. Total recorded model
spend for samples 1 and 3 is USD 0.234488; sample 2 made no provider request.

## Instrumented diagnosis and responsibility correction

Steve approved diagnostic remediation before review or further experiment
expansion and noted that the incurred costs were minimal. Revision `f7271f1`
added phase-specific safe diagnostics, exact local-only synthetic response
artifacts with owner-only permissions, conservative spend reservation when
final usage is unavailable, and no operator wall-clock timeout.

Sample 4 then completed its opening provider call at prompt/schema revision v1
with 3,112 input tokens, 15,563 output tokens, 114,554 ms latency, and estimated
cost USD 0.161854. Instrumentation classified the failure as
`domain-boundary`. The retained response showed exactly two contract problems:

- every proposal reused one source ID for different excerpts; and
- hemoglobin was the unitless number `7.8` rather than `"7.8 g/dL"`.

The response otherwise contained all 29 unique opening proposal IDs and the
three expected products in order. No proposal reached the case. Wilson then
took responsibility for deterministic source identity while leaving the model
responsible only for exact offsets, and the prompt explicitly required
measurements to retain value and unit together. These changes are prompt/schema
revision v2. The local ledger was also corrected to apply the governing limit
to complete samples, not stopped attempts; the USD 5 cap and no-retry rule did
not change.

## Sample 5 — complete pass

- Local date: 2026-09-05
- Source revision: `1dd6e13bc6d3b2387a94b86750f13cfd13d1b143`
- Model: `claude-sonnet-5`
- SDK: `@anthropic-ai/sdk` 0.124.0
- Prompt revision: `wilson-experiment-1-extraction-v2`
- Schema revision: `wilson-grounded-proposals-v2`
- Sampling: provider defaults; no tools; no automatic retry; no operator
  wall-clock timeout
- Opening: 3,160 input tokens; 10,659 output tokens; 75,451 ms; estimated USD
  0.112910
- Correction: 2,329 input tokens; 2,161 output tokens; 17,466 ms; estimated
  USD 0.026268
- Automated semantic score: pass, with zero issues across all 29 opening and
  two correction/conflict proposals
- Human semantic score: pass after inspecting every proposed value, entity,
  relationship, and exact excerpt
- Required gates: zero invented material facts, zero wrong-product or role
  attachments, exact supporting text for every proposal, and every
  projection-required fact present
- Case effect: both accepted model results replayed successfully through the
  ordinary journey service and `applyCaseCommand`
- Cumulative recorded model spend: USD 0.535520

The exact synthetic responses remain local and gitignored with file mode 0600.
Their SHA-256 digests are
`0164ecb8b451b99fd70fda43c098573937bd57f1f925c7c6f42dfe5d11ec9d54`
(opening) and
`fec72277845adcaf14e12a7539faaa5c2d0fe9a821e70b359847a821b4119b23`
(correction). No raw provider response, credential, or narrative copy is
committed.
