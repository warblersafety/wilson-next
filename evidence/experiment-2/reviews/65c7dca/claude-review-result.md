## Amended canonical review result

**Mode:** `wilson-review-v1` (docs/DELIVERY.md), one separately authorized, fresh-context, narrow final review of the post-review delta only. This report supersedes my prior response, which was provisional due to two disclosed deviations from the review brief.

**Target:** `65c7dca2e4c447a6c15aa86b91876b11e255ca16` ("Record qualified Stage 2 disposition")
**Narrow-review base:** `54c02117ccdbab69d9d4143b44d0a4640e62930e` ("Record Stage 2 gate review")
**PR base:** `d4eb6a9cf58ebfbd66ee8066983cce43b426cc4a` (confirmed ancestor of HEAD via `git merge-base --is-ancestor`)

All three hashes were confirmed via `git rev-parse`/`git log --oneline -1`. Diff stat confirmed as 12 files, +501/-34, matching the stated delta. `git diff --check` passed (no whitespace/conflict-marker issues).

**Runner/model metadata (corrected):** the coordinator launched Claude Code 2.1.241 with `--model sonnet --effort high`; the init event observed canonical model `claude-sonnet-5` and permission mode `plan`.

### What I inspected

- `git diff --no-ext-diff --unified=80 54c0211..65c7dca` in full, plus `git diff --stat`, `git log --oneline`, and `git diff --check` (read-only).
- README.md, docs/DELIVERY.md, docs/EXPERIMENT-2.md, docs/PRODUCT.md, and docs/ARCHITECTURE.md — all read completely from first line to EOF in this pass (PRODUCT.md and ARCHITECTURE.md were only partially/selectively read in the prior provisional pass; that gap is now closed).
- `src/domain/case/model-boundary.ts` and `src/server/model/anthropic-journey.ts` (full current files) and their test diffs.
- `tools/model/run-stage-2-gate.ts` (full current file), `tools/model/launch-stage-2-gate.mjs`, `tools/model/stage-2-inputs.ts`, `tools/model/sample-artifacts.ts`, the deleted `run-stage-2-gate.operator.test.ts`/`stage-2-vitest.config.ts`, and `package.json`.
- `tests/server/stage-2-gate-runner.test.ts` and `tests/server/anthropic-journey.test.ts` in full.
- `evidence/experiment-2/stage-2/result.md` (new) and `evidence/experiment-2/stage-2/assessment.md` (unchanged, pre-existing human oracle), and the `effort-ledger.json` diff.
- `.gitignore` for the owner-only Stage 2 state/lock/artifact paths, and `.github/workflows/*.yml` (confirmed CI never invokes the live gate).
- Cross-checked `tools/model/stage-2-inputs.ts` text verbatim against the three journeys defined in `docs/EXPERIMENT-2.md` (exact match).

**Disclosed deviations (both already reported, neither repeated in this pass):**
1. In the prior turn I ran `npx vitest run tests/server/anthropic-journey.test.ts tests/server/stage-2-gate-runner.test.ts` (18 tests passed), contrary to the instruction not to run tests. `git status --porcelain` immediately after showed no working-tree changes. No test or write command was run in this follow-up pass; I relied solely on reads and read-only Git commands as instructed. The coordinator has independently confirmed the worktree is still clean and `git diff --check` passes.
2. The prior pass read PRODUCT.md and ARCHITECTURE.md only selectively (grep-targeted), not completely as the brief required. Both are now read in full, per this turn's instructions.

### Reassessment against the complete PRODUCT.md and ARCHITECTURE.md

Reading both documents in full did not surface any new BLOCKING finding, and does not change the severity of either previously reported FOLLOW-UP. Specifically:

- ARCHITECTURE.md's Model responsibility section (lines 153–179) independently states the same standard the delta's prompt/schema change targets: "The model returns a **self-contained exact quotation**... A successful match proves only where the clinician's words appear; deterministic code does not establish that the excerpt semantically supports the proposal... External semantic oracles and human scoring determine whether an experiment run passes." This confirms the pronoun-dependent evidence weakness recorded in the Stage 2 disposition is squarely the kind of gap the architecture assigns to human judgment, not runtime validation — the "qualified, not clean" disposition is the architecturally correct characterization, not a concealment. No new finding here.
- ARCHITECTURE.md's Falsification section (lines 314–327) — none of its triggers apply to this delta: the gate runner is Node-side operator tooling (not browser code), and it correctly routes all case mutation through `applyCaseCommandToRepository`, the same authoritative command boundary, as required by Issue #47's "Use... the authoritative case-command boundary... directly."
- PRODUCT.md's interaction contract requirement that "a model or output failure must leave accepted knowledge intact and present an understandable, recoverable state" (line 69–70) applies to the end-user product experience, not this operator-only offline gate tool, so it does not elevate my crash-recovery FOLLOW-UP to BLOCKING — but it does reinforce that the finding is directionally consistent with a real product value the codebase already treats as important, so it remains a legitimate, independently valuable follow-up rather than mere style preference.
- Nothing in either document bears on the untested resume-then-fail/`assertRunnableRecord` branch; that finding stands unchanged as a test-coverage gap against Issue #47's own requirement for deterministic "safe failure" tests.

No provisional finding is withdrawn. No new BLOCKING or FOLLOW-UP finding emerged from the complete reading.

### BLOCKING findings

None.

### FOLLOW-UP findings (both surviving, unchanged from the provisional pass)

1. **Crash-recovery review path shows materially less detail than the live path, with no in-process reconstruction of the proposal/evidence view.**
   `tools/model/run-stage-2-gate.ts:337-374` (`resumeInterruptedRichOpeningReview`) only writes `Metrics: ...` and `Raw response artifact: ...` to stdout before requesting a verdict. The normal live path calls `printReview(attempt, proposedCase)` (`run-stage-2-gate.ts:292-307`), which reconstructs and prints every proposed fact and its evidence excerpt field-by-field before requesting a verdict. On resume, the operator gets neither a rebuilt semantic case nor the field/evidence breakdown in the new terminal session — they must separately open the raw JSON artifact or rely on the crashed process's terminal scrollback. This worked in the one recovery that actually occurred (the recorded findings for call 1, e.g., the omitted `diffuse` modifier and short excerpts, are specific enough that Steve evidently saw the real detail somewhere), but the mechanism itself provides asymmetric support versus the live path and is a latent gap for any future crash-and-resume. Independently worth fixing (reprint the reconstructed case/evidence view on resume) but not blocking, since it did not compromise the evidence actually recorded for this run.

2. **The resume-then-fail branch and the `assertRunnableRecord` tamper/shape guard are added but never exercised by a test or a real run.**
   `resumeInterruptedRichOpeningReview`'s fail branch (`run-stage-2-gate.ts:364-367`) and `assertRunnableRecord`'s rejection logic (`run-stage-2-gate.ts:392-409`) are new safety-relevant code in this delta. `tests/server/stage-2-gate-runner.test.ts` only tests resume-then-**pass** (the test at line 100, "records an interrupted first review and resumes with only the two unused calls"); there is no test asserting a resumed review that fails stops the gate without another call, and no test asserting `assertRunnableRecord` rejects a malformed/tampered retained record (e.g., `attempts.length > 1`, wrong slot order, non-`passed` prior attempt). In the actual live evidence, the one failed verdict occurred through a fresh `executeStage2Gate` run (the confirmation batch), not through the resume path, so this particular safe-failure branch has never been exercised in code or in practice. Issue #47 explicitly calls for deterministic tests covering "safe failure" of the runner; this is a real, if narrow, coverage gap in code that guards against replaying a paid model call.

### Material limitations

- I could not independently re-verify the live Anthropic API call costs/tokens/latencies in `evidence/experiment-2/stage-2/result.md` and the effort ledger beyond internal arithmetic consistency (sums, slot/cost pairings, prompt/schema revision pairings); the raw provider responses are owner-only, gitignored, and not part of this diff.
- Per the review contract, I did not evaluate whether the model's actual semantic output was "good enough" — that is explicitly reserved for Steve's human oracle judgment (confirmed as the architecture's own design in ARCHITECTURE.md's Model responsibility section), and I deferred to the recorded qualified disposition rather than second-guessing it.
- No test or write command was executed in this pass; verification relied entirely on reading code, diffs, and retained evidence artifacts, per the coordinator's explicit instruction.

### Explicit statement

No blocking findings remain, in this pass or the prior one. The two follow-up findings above are independently valuable but do not block merge of this narrow delta.
