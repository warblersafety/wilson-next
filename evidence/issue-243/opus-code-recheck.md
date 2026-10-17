The code fixes for B1, B2 and B3 hold up, and I found no new regression. One gate remains: B4 is still open at this commit because the full browser suite hasn't been rerun since the runtime fixes. That's missing evidence, not a code defect.

## Finding dispositions

**B1 (temporal outcomes printed without their prerequisites): resolved.**
- `src/domain/case/projection.ts:553-554` now uses `withdrawalApplicability` and `restartApplicability`, the same guards as suspect D7/D8. The outcome line prints only when its prerequisite is known and applicable.
- A withheld answer falls back to the existing "remains in reviewed knowledge" disclosure (`projection.ts:345`).
- Tests cover both directions (`tests/pdf/f-medication-context.test.ts:16, :23`): withheld with an unknown or declined prerequisite, printed when stopped or restarted is true.
- In `evidence/issue-243/11da061e5ea5/report-page-9.png` (stopped Unknown, reduced Declined, restarted Unknown), no outcome line appears.

**B2 (continuation pages missing the field): resolved.**
- Each entry's heading is now `F row N - <field label>` (`src/server/pdf/concomitant.ts:24`).
- `f4afa5a485fe/report-page-11.png` now reads "Starts with F row 1 - Indication" above lines 92–100.
- The dense test checks this heading on every later page (`f-medication-context.test.ts:19`).

**B3 (owning documents contradicted the code): resolved.**
- ARCHITECTURE.md now names Issue243 at each superseded statement (lines 283, ~1234, ~1271, ~1306, 1740 and 1879).
- It adds an Issue243 section covering the applicability rule, the field-labelled continuation pages, date display and the exclusion of `other` products.
- The PRODUCT.md coverage row is updated. Each change is scoped to the named fields only.

**B4 (acceptance evidence): still blocking.**
- `evidence/issue-243/README.md:23-25` says 177/177 browser journeys passed after the first fixes. After this round's runtime changes, the full browser rerun is "pending", as are exact-head CI, preview verification and the frozen live check.
- This round touched runtime code that affects every report: `form-3500.ts` now formats every native date through the new shared helper, and the projection changed. The full browser suite and exact-head CI need to pass before merge.
- By my reading, the new helper returns the same output as the old `formatDate` for any valid date, so I expect no regression. That's my inspection, not a test run.

**Follow-ups:**
- **F1 (render manifests): resolved.** Each directory now lists its own checks. I spot-checked `f431…` and `11da…`, and both match what the images show.
- **F2 (date formatting): resolved.** A complete reduction date now prints as 18-SEP-2026. A partial one uses the shared precision wording, including the "No missing month or day has been inferred" statement.
- **F3 (`other` product type left out): accepted as deliberately out of scope.** ARCHITECTURE.md and PRODUCT.md now record this, and the existing not-included disclosure remains.

## New in this delta
No new blocking or follow-up findings. Two behaviour changes are intended and documented:
- An explicitly answered "Does not apply" outcome is now withheld when its prerequisite is false. It stays disclosed rather than printed, which ARCHITECTURE.md now states.
- The partial-date line reads "Supplied Dose reduction date precision", with a capital D mid-sentence. This is cosmetic only.

## What I inspected
- The full delta diff (docs, `calendar-date.ts`, `projection.ts`, `concomitant.ts`, `form-3500.ts`, and the changed tests), plus the issue.
- Current `concomitant.ts`, `projection.ts:335-354 and 535-575`, and `calendar-date.ts`.
- Evidence: the README, `review-dispositions.md`, and two render manifests. I viewed the PNGs `11da061e5ea5/report-page-9.png` and `f4afa5a485fe/report-page-11.png` myself.

## Limitations
- I could only read files; I ran no tests, build, PDF parsing or hash checks.
- I didn't inspect the new state and readback JSON for `ab8ed0c4d3a7` or `aaeb388b9609`.
- I didn't re-read the unchanged parts of the docs.

Apart from B4, no blocking findings remain.