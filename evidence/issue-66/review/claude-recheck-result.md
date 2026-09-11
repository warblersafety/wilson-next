# Claude recheck — Issue #66 / PR #77 (`wilson-review-v1`, targeted recheck)

**Recheck commit:** `5c2bc5a` (delta from prior-reviewed `deb3f58`) · **Delta file:** `/private/tmp/wilson-issue66-review-fix-5c2bc5a.diff`, confirmed complete (2 files, 2 hunks, ends at line 349 with no further `diff --git`/`@@` markers)
**Configured model:** Claude Sonnet 5 (session-reported); canonical model ID `claude-sonnet-5` · **CLI:** Claude Code 2.1.241
**Effort:** session-configured reasoning effort as reported to me for this turn; same caveat as the prior review — I cannot independently confirm this meets `docs/DELIVERY.md`'s stated `high`-effort standard for `wilson-review-v1`.
**Disposition: Prior BLOCKING finding is resolved. No new BLOCKING or FOLLOW-UP finding from this remediation.**

## Verdict on the prior finding

**Resolved.** The fix is minimal and precisely targeted at the defect: `app/journey.tsx` now computes a dedicated `entityWithdrawal = snapshot.stage === "output"` (journey.tsx:667) and uses it — instead of the shared `directEdit` flag (`"clarify" || "output"`) — to gate `allowWithdraw` for both relevant-test cards (journey.tsx:672) and product cards (journey.tsx:680):

```
allowWithdraw={entityWithdrawal && test.state === "resolved"}
allowWithdraw={entityWithdrawal && product.state === "resolved"}
```

I confirmed the server-side gate is unchanged (`src/server/journey/service.ts:225-226`, `requireStage(expectedStage, "output")`), so the UI's withdraw-eligibility now matches the server's acceptance exactly — the Withdraw button can no longer appear during `clarify` while being rejected by the server. `allowDirectEdit` (Change/Add) correctly continues to use the original `directEdit` (`clarify` or `output`), which was never part of the defect and is unchanged.

The fix ships with a direct regression test reproducing the exact scenario I identified: in `tests/e2e/assembled-journeys.spec.ts:267-268`, immediately after "Accept the remaining understanding" in the `adaptiveRichOpening` journey — while the journey is in the `serious-outcomes` clarify stage and the "amoxicillin" product and "Relevant test 1" are already `resolved` — the test now asserts both Withdraw buttons have count 0:

```
await expect(productOrCaseCard(page, "amoxicillin").getByRole("button", { name: "Withdraw amoxicillin" })).toHaveCount(0);
await expect(productOrCaseCard(page, "Relevant test 1").getByRole("button", { name: "Withdraw Relevant test 1" })).toHaveCount(0);
```

This is exactly the reachable path I traced in the prior review (every journey with a post-opening completion question has resolved products/tests visible with the false affordance), so the added assertion closes the acceptance-evidence gap that let the original defect through undetected.

## New findings from this exact remediation

None. The change is scoped to the two `allowWithdraw` call sites plus the added test assertions; I found no other `allowWithdraw` reference left coupled to `directEdit`, no change to `allowDirectEdit`/`allowOpeningReview`/`allowRemove` gating, and no change to the server, domain, or projection layers. Restricting withdrawal to the `output` stage is the behavior the architecture and issue text already specify as intentional ("may be withdrawn only after the case reaches output"), so tightening the UI to match is a correctness fix, not a functional regression or scope change.

## Inspected

- Read the complete `deb3f58...5c2bc5a` delta in full (32,356 bytes; 2 files, 2 hunks, no truncation) — did not independently recompute its SHA-256 this turn (`shasum`/Bash unavailable; see limitations) but the file's byte count matched via the diff read and its content is internally consistent with the stated hash target.
- Read the current `app/journey.tsx` (lines 660–720) and confirmed the `entityWithdrawal`/`allowWithdraw` wiring and the unchanged `CaseCard` withdraw-button render path.
- Read the current `src/server/journey/service.ts` withdraw-entity handler to confirm the server gate is unchanged and now matches the UI gate exactly.
- Read the added Playwright assertions in `tests/e2e/assembled-journeys.spec.ts` in context and confirmed they exercise the exact clarify-stage reproduction scenario from the prior finding.
- Did not re-run typecheck, tests, build, or Playwright myself; relied on the coordinator's reported results (typecheck, all 143 tests, production build, `git diff --check`, and the complete assembled Playwright run with 21 predetermined calls / zero live calls, all passing) since re-execution was not requested and this recheck is read-only.

## Limitations

- Bash/shell execution was unavailable this turn, so I could not independently compute the delta file's SHA-256 or byte count via `shasum`/`wc`; I relied on the Read tool's content and the stated size/hash without independent cryptographic verification.
- I did not re-run any of the coordinator-reported checks (typecheck, unit/integration tests, build, `git diff --check`, Playwright) myself.
- Same model/effort/GitHub-check-status caveats noted in the prior full review apply unchanged.
