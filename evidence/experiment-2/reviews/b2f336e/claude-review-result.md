# Claude review

**Review mode:** Standard fresh-context review, directive `wilson-review-v1`,
read-only, no implementation.

**Exact commit reviewed:** `b2f336ed29fd93598169ed1261fdc1c1db0782f8`.

**Base:** `main` at `e0d4a8d757684c92e3d217e4747bee4c88e97ef5`.

**Model/effort:** Claude Sonnet 5 (`claude-sonnet-5`), high, Claude Code
2.1.241. Subscription preflight passed through `claude.ai`; provider override
variables were unset.

**Disposition:** The one blocker and two follow-ups below were resolved in
`242441e2e988612abc688f6e02080951398c5039`; see `dispositions.md`.

## Verbatim result

## BLOCKING

**1. This change removes the only code-level barrier that kept the deployed protected preview from making live, uncapped, unauthorized calls to the real Anthropic API with arbitrary (including potentially non-synthetic) text.**

- `src/server/model/anthropic-journey.ts` previously called `requireFixedInput(turn, text)` at the top of `createAnthropicRequest`, which threw for any input other than the exact fixed `openingAccount`/`correctionAccount` strings, so no network call to the provider could ever be made with non-fixed text. This diff deletes `requireFixedInput` entirely (removed function, formerly ~`anthropic-journey.ts:1838-1843`) and no longer restricts `createAnthropicRequest`'s input.
- `app/api/case/route.ts:148-155` (`configuredJourneyModel`) is **unchanged** by this diff: `if (process.env.VERCEL_ENV !== "preview") return fixedJourneyModel;` else it builds a live `createAnthropicJourneyModel()` for every request. Vercel sets `VERCEL_ENV=preview` on every branch/PR preview build, including this PR's own preview (the supplied evidence confirms "Vercel and Vercel Preview Comments checks: success at the exact target commit," i.e., this exact exposure already existed once that preview built).
- `app/journey.tsx:204,240` render plain editable `<textarea>` elements wired directly to `submit-opening`/`submit-correction`, whose `text` is validated only as `z.string()` in `app/api/case/route.ts`'s `actionSchema` (unchanged, still free-form). `hasSameOrigin` (`route.ts:252-262`) only compares the `Origin` header to the request host; it is not an authorization boundary.
- Net effect: on any `VERCEL_ENV=preview` deployment where `ANTHROPIC_API_KEY` is configured (the entire stated purpose of the pre-existing "protected live-model operator capability" from Slice 4B/PR #36), an operator (or anyone reaching the protected preview) typing or pasting *any* text into the ordinary opening/correction textarea and clicking submit now triggers a real, live model call — with no spend cap, no sample limit, and none of the "smallest operator runner" controls (`tools/model/run-slice-3-sample.ts` enforces a `$5` cap and a sample-count lock; the interactive route enforces neither).
- This directly contradicts Issue #44's explicit exclusion — "Any live model call until deterministic evidence and the separately authorized standard review are complete... followed by a separate call-budget authorization" — and `docs/EXPERIMENT-2.md`'s staged sequence, which reserves all live calls for the separately authorized Stage 2 gate run through the operator runner, not the interactive web app.
- It also creates a privacy exposure beyond process/authorization: `diagnosticInput`/`diagnosticAction` (`src/server/journey/service.ts`) intentionally suppress logging any text that isn't one of the three fixed fixture strings ("[NOT LOGGED: outside fixed synthetic fixture]"), so if a user pastes real (non-synthetic) clinical text expecting the deterministic Experiment‑1‑style rejection, it would now be sent live to a third-party model provider, and Wilson's own diagnostics would not even retain what was sent — conflicting with `docs/PRODUCT.md`'s "Development uses synthetic information until privacy... boundaries for real clinical data are explicitly approved."
- I recognize `docs/EXPERIMENT-2.md`'s Stage 1 text literally instructs "remove the fixed proposal catalogs and fixed-input rejection from production behavior," so the implementer followed the letter of that instruction. But that instruction appears not to have accounted for its interaction with the pre-existing, unrelated `configuredJourneyModel` preview switch in `route.ts`. This is exactly the "hidden faulty premise" class of defect `docs/DELIVERY.md`'s review mandate calls out ("Review checks... whether implementation hides a bad premise; local conformance is not enough"), and it should be stopped and reconciled rather than merged as-is — e.g., by gating the interactive route's live-model branch behind its own explicit, separately authorized flag (distinct from mere `VERCEL_ENV=preview`), or by re-scoping the removed input check to the currently-approved synthetic journeys at the interactive boundary, before this generalization ships.

## FOLLOW-UP

**1. Dead/unreachable defensive branch in `parseModelProposalEnvelope`'s `allocate`.** In `src/domain/case/model-boundary.ts:96`, the duplicate check `kind === "product" && existingProductIds.has(id)` can never trigger under the function's own enforced invariants: opening turns require `existingProductIds` to be empty (line 85-87), and correction turns forbid any new product declarations (line 88-90), so `allocate("product", ...)` is only ever reachable when `existingProductIds` is empty. Worth simplifying or documenting the intent so a future change to those invariants doesn't silently rely on untested code.

**2. New source-consolidation behavior (multiple proposals sharing one `Source` when their `evidenceQuote` is identical) has direct test coverage in `tests/domain/model-boundary.test.ts`, but no test exercises it through the fixed fixture's multi-field product proposals** (`src/experiment/fixed-journey.ts`'s `productProposals`, where `name`/`dose`/`frequency`/`route` all reuse the same `regimenExcerpt`). Under the new dedup-by-quote logic these now collapse onto one shared `Source` object where before each had its own. No test or view/projection code was found that assumes a 1:1 proposal-to-source mapping, so this is very likely benign, but an explicit regression test asserting review/understanding views still show correct per-fact evidence when several product facts share one clause would make this intentional behavior change verifiable rather than incidental.

## Inspected and ran

- Read the complete `main...target` diff at `/private/tmp/wilson-issue44-review-b2f336e-full.diff` in full (all ~3668 lines, three sequential reads covering the entire file).
- Read `README.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/EXPERIMENT-2.md`, and `docs/DELIVERY.md` in full; skimmed `docs/EXPERIMENT-1.md` for provider-adapter/preview-protection context via targeted grep.
- Read Issue #44 and Issue #39 text as supplied in the prompt.
- Read the current (target-commit) contents of `src/domain/case/model-boundary.ts`, `src/domain/case/types.ts`, `src/domain/case/commands.ts`, `app/api/case/route.ts` (full `postCase`/`configuredJourneyModel`/`hasSameOrigin`), and `app/journey.tsx` (textarea/action wiring) to check the diff against real surrounding code rather than the diff text alone.
- Grepped the repository for `VERCEL_ENV`, `ANTHROPIC_API_KEY`, and related environment/authorization checks to confirm no additional live-call gate exists outside `route.ts:149`.
- Grepped for hard-coded `source-*` ID references across tests to confirm the new evidence-deduplication behavior does not break any existing assertion.
- Did not execute any commands myself (no test run, typecheck, build, lint, or browser check); the "39/87 tests, typecheck, build, 2 browser tests" results in the acceptance evidence and effort ledger are self-reported and were not independently reproduced.
- Used only read-only tools (Read/Grep/Glob); made no edits, no Git state changes, and no network access.

## Limitations

- I did not independently run the focused/full test suites, typecheck, production build, or browser regression; my assessment of correctness for the model-boundary logic (group/target/identity resolution, evidence anchoring, duplicate detection) is based on close manual reading of the code and the test file diffs, not execution.
- I could not verify externally whether `ANTHROPIC_API_KEY` is currently provisioned on the Vercel Preview environment, which determines whether BLOCKING finding #1 is exploitable today versus latent; the code no longer provides its own enforcement either way, which is the basis for the finding regardless of current secret provisioning.
- I did not inspect the actual Vercel deployment/preview-protection configuration (only documentation describing it), so my characterization of preview access control (Vercel Authentication) relies on `docs/EXPERIMENT-1.md`'s description rather than direct verification.

Findings remain: one BLOCKING finding must be resolved before merge; the two FOLLOW-UP items are independently valuable but not merge-blocking.
