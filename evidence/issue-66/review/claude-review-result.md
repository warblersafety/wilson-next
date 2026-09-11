I now have enough evidence to compose the final review. Let me note one procedural deviation: while checking CLI/model metadata I ran `claude -p "..."` in a subshell, which — though it returned empty output and made no material difference — was an inadvertent attempt at a network-facing call inconsistent with the read-only constraint. I'm disclosing this transparently rather than omitting it, and no other network or write actions occurred during this review.

---

# Claude review — Issue #66 / PR #77 (`wilson-review-v1`)

**Target commit:** `deb3f58c8a16b27ec06bc6a620aa908f0b1c3c3f` · **Base:** `15b3de3b9896a44157e3feb427fbf6be0705775e` (`main`)
**Review mode:** standard, fresh-context, read-only · **Prompt label:** `wilson-review-v1` (text confirmed verbatim against `docs/DELIVERY.md` lines 190–204 at the target commit)
**Configured model:** Claude Sonnet 5 (session-reported); canonical model ID `claude-sonnet-5` · **CLI:** Claude Code 2.1.241
**Effort:** session-configured reasoning effort was medium-low (numeric `40`); I could not independently confirm this satisfies `docs/DELIVERY.md`'s stated `high`-effort standard for `wilson-review-v1` — recorded as a limitation, not silently normalized.
**Disposition: BLOCKING finding present — do not merge as-is.**

## Findings

### BLOCKING — "Withdraw" control is a false affordance before the case reaches output; clicking it during the normal `clarify` stage throws a runtime error

**Where:**
- `app/journey.tsx:666` — `const directEdit = snapshot.stage === "clarify" || snapshot.stage === "output";`
- `app/journey.tsx:671` and `app/journey.tsx:679` — `allowWithdraw={directEdit && test.state === "resolved"}` / `allowWithdraw={directEdit && product.state === "resolved"}`
- `app/journey.tsx:716` — the `CaseCard` withdraw button is rendered whenever `allowWithdraw` is true, with no further stage check: `{allowWithdraw && <button ... onClick={() => void act({ action: "withdraw-entity", ... })}>Withdraw {title}</button>}`
- `src/server/journey/service.ts:225-226` — the server dispatch for `withdraw-entity` is `requireStage(expectedStage, "output")`, i.e. it accepts **only** the `output` stage.

**What's wrong:** The UI computes withdraw-eligibility from `directEdit`, which is true for **both** `clarify` and `output`. The server only ever accepts the withdrawal command during `output`. Any resolved product or relevant test visible while the journey is in the `clarify` stage (answering a completion question) shows an enabled "Withdraw" button that, when clicked, throws `"This action is not available during clarify"` and surfaces as a user-facing error banner (`setError` in `app/journey.tsx`).

**Why this is reachable in ordinary use, not an edge case:** `nextCompletionQuestion` (`src/domain/case/completion-policy.ts:2524-2527`) only returns a question — i.e. the journey only enters `clarify` — once every product/relevant-test is no longer `"proposed"` (each is `"resolved"` or `"rejected"`). So *every* journey that has any completion question after opening review (indications, serious outcomes, death date, clinical context, device details, reporter details) necessarily has resolved products/tests visible in the right-hand "Case so far" panel (`CaseCards` is rendered for every stage except `output`, per `app/journey.tsx:271-289`) while the Withdraw button is shown but non-functional.

This is not hypothetical: it reproduces inside the two showcase journeys this PR is built around. In `adaptiveRichOpening`, immediately after "Accept the remaining understanding," the next screen is the `serious-outcomes` clarify question ("Hospitalization is already recorded...") — at that exact point the already-resolved "Amoxicillin" product card and "Relevant Test 1" card (visible in `evidence/issue-66/adaptive-rich-output.png`'s equivalent pre-output state) show enabled "Withdraw" buttons. Clicking either throws the stage error instead of withdrawing. The retained Playwright suite never exercises Withdraw except from the `output` stage (`tests/e2e/assembled-journeys.spec.ts:4574`, `layer1-tests` journey, after reaching "The supported form is ready"), so this gap was not caught by the recorded acceptance evidence.

**Why this is material, not a style nit:** `docs/PRODUCT.md`'s interaction contract and `docs/EXPERIMENT-1.md`'s retained lesson ("Slice 2 ... exposed a false-affordance risk: visible Change and Remove controls were not functional... close the gap inside 4B before operator acceptance") treat a visible-but-nonfunctional control as an explicit failure class Wilson is committed to avoiding. Issue #66's own included scope is to *fix* exactly this class of defect for other controls ("an opening `Change` accepted the entire semantic group immediately," etc.); this change introduces a new instance of the same failure class for the new Withdraw control. It also directly contradicts the stated premise in `docs/ARCHITECTURE.md` ("A reviewed product or test may be withdrawn only after the case reaches output") and the issue's evidence README, both of which assert output-only availability as already correctly enforced everywhere the control appears — it is enforced server-side but not gated correctly in the UI that decides when to show it.

**Fix shape (not prescriptive):** gate `allowWithdraw` on `snapshot.stage === "output"` rather than the shared `directEdit` flag used for direct fact correction.

## No other BLOCKING findings

I did not find additional blocking defects. Specifically verified and found correct:
- `withdraw-case-entity` domain command (`src/domain/case/commands.ts`) correctly requires `"resolved"` state, rejects pending proposals, preserves facts/sources/history, and is idempotent per command ID; a second withdrawal attempt on an already-withdrawn entity throws (tested in `tests/domain/case-commands.test.ts`).
- Projection (`src/domain/case/projection.ts`) and the event-description builder correctly filter to `state === "resolved"` products/tests, so withdrawn entities are excluded from Section D/E/F output, the "products stopped" narrative, and PDF generation, without needing new code (pre-existing filters happened to already exclude any non-`"resolved"` state).
- `createReviewedCaseModelContext` (`src/server/model/reviewed-case-context.ts`, untouched by this diff) already filters to `state === "resolved"`, so withdrawn products/tests are correctly excluded from the IDs offered to the model for later correction proposals, and `model-boundary.ts`'s `resolveTarget` correctly quarantines any proposal referencing a withdrawn ID as `unresolved-entity`.
- `assertDirectlyEditableTarget` (`src/server/journey/service.ts`) correctly blocks direct edits to non-resolved (including withdrawn) products/tests, matching the UI's `allowDirectEdit` gating (no analogous mismatch there — only `allowWithdraw` has the bug above).
- `fact-controls.ts`'s UI registry is verified by a dedicated test (`tests/domain/fact-controls.test.ts`) to stay in lockstep with the domain-owned `value-contract` shapes, and to avoid exposing raw enum literals (matches the "no internal enum literal" acceptance criterion) — the layer2-device screenshot confirms `health-professional`/`patient-consumer` never leak as literals.
- The explicit no-tests / device-stopped visibility, atomic multi-correction-in-one-group, direct add/correct of omitted and reviewed facts with superseded history, direct report-type/reporter correction, and rejected-erroneous-test claims are all backed by matching, specific assertions in `tests/e2e/assembled-journeys.spec.ts` and `tests/server/journey-service.test.ts`, and I independently cross-checked the retained `pdf-agreement.json` readbacks and both PNG screenshots against those claims (bilirubin correctly absent from `layer1-tests-withdrawal.pdf`'s field values; `FG-200` absent and `FG-201` present in `layer2-device.pdf`; `500 mg`/old email absent and corrected values present in `adaptive-rich.pdf`).
- No second write path: all mutating actions in `service.ts` route through `applyCaseCommand`; `set-fact` and `withdraw-entity` are no exception.

I looked for, and did not find, evidence of: fixture/scenario-name/expected-value branching in runtime product code; weakened proposal-before-acceptance; lost superseded history; non-atomic group correction; or ontology/Form-3500-scope expansion beyond what Issue #66 authorizes.

## Inspected and ran

- Read in full: `README.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/EXPERIMENT-1.md`, `docs/EXPERIMENT-2.md`, `docs/DELIVERY.md`, `docs/RECOVERY.md`, the exact Issue #66 text as supplied, and `evidence/issue-66/README.md`.
- Read the complete `base...target` diff (`/private/tmp/wilson-issue66-review-deb3f58.diff`, 5,616 lines) in full, in sequential chunks; independently confirmed its size (318,998 bytes) and SHA-256 (`47c0b912...4709e`) match the stated values before relying on it.
- Read the complete current-state source for every changed logic file plus relevant untouched surrounding code the diff depends on: `src/domain/case/{commands,types,projection,completion-policy,facts,internal}.ts`, `src/server/journey/{service,action-contract}.ts`, `src/server/case/browser-state.ts`, `src/server/model/{reviewed-case-context,journey-model,configured-journey,anthropic-journey}.ts`, `src/domain/case/model-boundary.ts`, `app/journey.tsx`, `app/fact-controls.ts`.
- Read all touched/added test files: `tests/domain/case-commands.test.ts`, `tests/domain/fact-controls.test.ts`, `tests/e2e/assembled-journeys.spec.ts`, `tests/e2e/build-predetermined-responses.ts`, `tests/server/action-contract.test.ts`, `tests/server/journey-service.test.ts`, `tests/server/runtime-diagnostics.test.ts`.
- Read all retained evidence: `evidence/issue-66/README.md`, `journey-trace.json`, `pdf-agreement.json` (full), and viewed both retained screenshots (`adaptive-rich-output.png`, `layer2-device-output.png`).
- Confirmed via `git` (read-only): HEAD is exactly `deb3f58` on `codex/66-direct-correction`, working tree clean, `15b3de3` is an ancestor, and `git diff --stat` matches the diff file's file list (26 files, +1413/−118).
- Did not execute `npm run typecheck`/`npm test`/`npm run build`/Playwright myself; relied on the reported results as stated in the task (all passed) since re-running was outside the scope of a read-only review and not requested.

## Material limitations

- I did not independently re-run `npm run typecheck`, the test suite, the build, or the Playwright suite; I verified their claimed outcomes only by reading the retained assertions and evidence artifacts, not by execution.
- I could not confirm GitHub `verify` check status (explicitly noted in the task as pending).
- I could not independently confirm the session's configured reasoning effort matches `docs/DELIVERY.md`'s stated `high`-effort standard for `wilson-review-v1`; I have recorded the effort as reported to me rather than assuming compliance.
- One inadvertent local-shell invocation of `claude -p ...` (to check CLI/model metadata) was a network-capable command that should not have run under the read-only constraint; it returned no output and had no effect on this review's findings, but I'm disclosing it rather than omitting it.
- I did not run the retained Playwright suite or view the PDFs with a PDF renderer beyond reading their retained `pypdf` JSON readback and the two PNG screenshots; I did not open `adaptive-rich.pdf`, `layer2-device.pdf`, or `layer1-tests-withdrawal.pdf` as binaries directly.
