## Wilson standard review — `wilson-review-v1`

**Mode:** standard fresh-context review, prompt-source `docs/DELIVERY.md` (`wilson-review-v1`)
**Target commit:** `c89e622c11a89759adcb2225f77f5aad28470861` ("Prepare Experiment 2 Stage 2 live gate")
**Base commit:** `d4eb6a9cf58ebfbd66ee8066983cce43b426cc4a`
**Reviewing model/effort:** Claude Sonnet 5, effort not separately selectable in this session (treated as the required high-effort standard review); CLI not directly introspectable from within the session.

### What I inspected
- Full `git diff --no-ext-diff --unified=80 main...HEAD` (12 files, +819/‑1), read end to end.
- `README.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/EXPERIMENT-2.md`, `docs/DELIVERY.md` in full.
- Issue #47 text and Draft PR #48 delivery context as supplied.
- Production model/case boundary code the new runner depends on: `src/server/model/journey-model.ts`, `src/server/model/anthropic-journey.ts`, `src/server/model/reviewed-case-context.ts`, `src/domain/case/model-boundary.ts`, `src/domain/case/create.ts`, `src/domain/case/commands.ts` (partial), `src/server/case/apply-command.ts`, `src/server/case/repository.ts`.
- The retained Experiment 1 runner/fixture/oracle for comparison: `tools/model/run-slice-3-sample.ts`, and confirmed `src/experiment/*` and `src/server/journey/service.ts` are untouched by this diff.
- `.github/workflows/verify.yml`, root `vitest.config.ts`, `tools/model/vitest.config.ts`, `tsconfig.json` to confirm the new operator test/script cannot run in CI or default `npm test`.
- New test files in full: `tests/server/stage-2-gate-runner.test.ts`, `tests/architecture/source-boundary.test.ts` addition, `tests/server/model-sample-artifacts.test.ts` addition, `tools/model/run-stage-2-gate.operator.test.ts`.

### What I ran
- Read-only `git log`, `git rev-parse`, `git diff --stat`, and `git diff` commands only. `git diff --check` was blocked by the sandbox's Bash permission layer (unrelated to repository content); I visually inspected the diff for stray whitespace and saw none, and the PR's own recorded evidence states diff check passed. No tests, typecheck, or model calls were executed, per instructions.

### BLOCKING findings

None. I did not find a material reason this preparation-only change should not merge. The runner introduces no production/browser/route/schema/prompt behavior change (confirmed by diff scope), correctly reuses the production Anthropic adapter and generalized model/case boundary (`createAnthropicJourneyModel` with `requester` left as its production default, `applyCaseCommandToRepository`, `createReviewedCaseModelContext`), enforces the three-call cap structurally (fixed-length `STAGE_2_CALL_SLOTS`), enforces one call before a durable awaiting-human-review stop with no continuation on `fail` (verified by test), enforces the $5/$1.50 reservation cap before each call (verified by test), enforces zero retries (verified by test and by `MODEL_MAX_RETRIES = 0` in the unmodified adapter), keeps the human-readable semantic oracle (`evidence/experiment-2/stage-2/assessment.md`) out of executable gate code (verified by a new source-boundary test), and leaves the Experiment 1 fixture/oracle/fixed-journey files completely untouched as the required regression. The new operator test and `gate:stage2:model` script are excluded from the default `vitest.config.ts` include list and from CI's `verify` workflow, so no live call risk exists from routine `npm test`/CI runs. The three call-input texts in `tools/model/stage-2-inputs.ts` are verified byte-for-byte identical to the approved journeys in `docs/EXPERIMENT-2.md`.

### FOLLOW-UP findings (independently valuable, non-blocking)

1. **Missing deterministic test for the case-replay/domain-boundary safe-failure path.** `tools/model/run-stage-2-gate.ts:960-969` (`stopCaseReplay`) is the code path that fires when `applyCaseCommandToRepository` rejects a model's output (e.g., an ambiguous/absent evidence quote or a type-incompatible target) — precisely the mechanical rejection category the model boundary is designed to enforce, and the most likely real failure mode of a live call. `tests/server/stage-2-gate-runner.test.ts` covers ordering, the fail-verdict interlock, the $5 cap, and a provider-request failure, but no test drives an envelope through `attach-grounded-proposals` in a way that trips `applyCaseCommand`'s validation and asserts the gate stops safely without calling the human reviewer and without touching `richCase`/`repeatedCase`. Issue #47's "Included preparation" explicitly names "safe failure" as one of the required deterministic test categories; only the provider-failure variant of "safe failure" is currently exercised.

2. **Unconditional post-verdict acceptance on all three calls, not just call 2 as the manual sequence specifies.** `tools/model/run-stage-2-gate.ts:908-922`: after every `pass` verdict (rich-opening, repeated-opening, *and* repeated-update), the runner automatically issues `review-proposal-groups` with `action: "accept"` for every pending group. Issue #47's manual sequence explicitly calls for this action only after call 2 ("Only after Steve passes it, accept its groups through applyCaseCommand to create reviewed context") to build context for call 3; step 1 says only "stop for Steve's verdict," and step 3 says only "Stop for the final verdict" — neither mentions an accept step. As implemented, a single `PASS` verdict now does double duty: a QA judgment on model output quality, and an authoritative case-acceptance action (including auto-superseding the ibuprofen dose and creating a conflict on the acetaminophen date) that the issue's script did not ask for on calls 1 and 3. In this preparation the effect is inert (the accepted `richCase`/`repeatedCase` objects are in-memory only and never persisted or read back except to seed call 3's context), and it exercises the authoritative write boundary in a way consistent with the exact-journey oracle text in `docs/EXPERIMENT-2.md`, so it is not a safety or correctness defect. Given this project's unusually strict "no action beyond what was explicitly authorized" culture (`docs/DELIVERY.md`'s proportional-closure rule, `docs/EXPERIMENT-2.md`'s stop-and-reconcile list, Issue #47's own authorization boundary), this deviation from the literal manual sequence is worth an explicit note or a one-line issue/PR clarification before Steve authorizes the live batch, so the deviation is a recorded decision rather than an implicit one.

### Material limitations

- I did not execute `npm test`, `npm run typecheck`, `npm run build`, or `git diff --check`; I relied on static reading of the diff and the PR's recorded local evidence for those results.
- I did not have GitHub network access and did not independently read the live PR #48 thread or Issue #47 comments beyond the text supplied in this task.
- Runtime expected-answer validation was not performed and is out of scope by design; I did not attempt to judge whether a live model call would actually pass Steve's oracle — only whether the gate's mechanical behavior matches the governing documents and Issue #47.
- I could not independently verify the exact "100 passed" full-test-suite count claimed in the effort ledger against the visible diff's ~6 new test cases; this is a minor ledger-bookkeeping question I could not resolve without running tests, and I do not consider it consequential enough to report as a finding.

### Disposition

No BLOCKING findings survive. Two independently valuable FOLLOW-UP findings are reported above; neither compromises the mechanical safety invariants (call cap, cost cap, human-review interlock, zero retry, oracle-import isolation) that Issue #47 requires before live-call authorization.
