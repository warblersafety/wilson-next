# Claude review — wilson-review-v1, target `514f213` vs base `7b86b27`

I found one blocking issue and three follow-ups.

## What I inspected
- **The diff:** all of `REVIEW-DIFF.patch` (≈11.2k lines). It adds only `evidence/live-acceptance-241/{A01–A12.json, README.md, summary.json}` and `tests/fixtures/live-acceptance-12.json`. No runtime, prompt or test code changes.
- **Issue #241** and its three checkpoint comments.
- **Owning docs:** `docs/PRODUCT.md`, `docs/DELIVERY.md`, `docs/REMAINING-PRACTICAL-CUT.md`, and `docs/ARCHITECTURE.md` lines 1–985 (the later half was not read).
- **Surrounding code:**
  - `src/server/pdf/form-3500.ts` field map and B6 row map.
  - `src/domain/case/projection.ts` lines 1–700.
  - `app/api/case/route.ts`, `vercel.json`, `vitest.config.ts`, `tests/e2e/load-fixtures.cjs`.
  - The `reusedFrom` sources in `tests/e2e/build-predetermined-responses.ts`.
- **My own checks** (read-only):
  - Per-case costs add up to 0.878292. Call counts are 4, 8, 11 and 15 at the checkpoints, matching the issue comments.
  - Render hashes are internally consistent: identical page images appear only where the content is identical.
  - The A03 `Row8…TDate3` field is the intended crossed-widget mapping (`form-3500.ts:145-157`), not a defect.
  - The new fixture JSON is not picked up by any test glob or loader, so it can't cause a regression.
  - The `reusedFrom` openings match the source fixtures, apart from additions noted in follow-up 3.

I ran no tests, builds or scripts; the only tool was Read.

## BLOCKING

**1. The evidence the frozen protocol requires isn't in the repository, so the PR's main claims can't be checked.**

The fixture (`tests/fixtures/live-acceptance-12.json:41-48`) requires recording of:
- operation correlation;
- the full returned state, sources and review decisions;
- the actual PDF, pypdf native/page readback, PDFKit render and visual inspection.

The committed scorecards contain only fact subsets, native-field readback, and SHA-256 hashes. `README.md:7` says the "Full PDFs, readbacks and renders remain in the task evidence archive; hashes do not make the binary artifacts available from this checkout." Concretely, the committed evidence is missing:
- **PDFs, page readback and renders.** Without them nobody can check the "no truncation/overlap" failure criterion. Visual inspection is recorded only as "selected filled pages", and which pages were inspected isn't recorded. Batch 3 says before-recovery PDFs/state were "preserved", but they aren't committed.
- **Source records.** Every proposal cites `source-…` IDs that resolve to nothing in the repo. That makes the source-grounding judgments (e.g. A03/A04 "without an explicit after-change relation") and the "preserve … source" correction expectation impossible to check.
- **Proposal review decisions and recovery commands.** These exist only as prose. There is also no superseded-value or change history for the A03/A04/A11 corrections.
- **Operation / diagnostic IDs.** The route emits these (`operationIdHeader`, `diagnosticReference`), but none are recorded. The A04/A07 claim that the recovered response was the "exact original … no model regeneration" therefore rests entirely on unrecorded operations. Related: `A04.json:1110-1129` lists the 159-token correction call before the 5,399-token opening, and nothing recorded allows reconciling that order.

Why this blocks:
- DELIVERY's durable trace says "CI and retained experiment artifacts: reproducible evidence", and requires PRs to carry "required … traces, model samples, or PDFs".
- Every earlier live-evidence directory commits these artifacts (e.g. `evidence/issue-192/live-v19-*`, `evidence/issue-101/live-*.pdf`, `evidence/issue-237/*.pdf/-readback/-render`).
- This change is evidence-only, and its release-cut recommendation depends on that evidence.

Cheap fix: commit the 12 final PDFs (plus the cited before-recovery ones), their readback/render JSON and the inspected PNGs, the source excerpts behind each `sourceId`, and the operation IDs per model call. Alternatively, narrow the README and summary claims to what is actually retained.

## FOLLOW-UP

**1. Doubled period in the B5 narrative on the documented recovery path; the evidence didn't catch it.**
- `A06.json:408` ends "…no adverse event occurred.." and `A10.json:602` ends "…no patient or adverse event was involved..".
- Cause: `projection.ts:598` always appends `.` after `Problem detail: …`. Lines 599–602 do the same for symptoms, treatment and outcome.
- The README's prescribed recovery (paste the exact source sentences into the problem prose) reliably triggers it.
- It's cosmetic, not a misrepresentation. But it appears in 2 of the 12 final PDFs, and the "PDF agrees with accepted facts" review didn't record it.

**2. The data narrows down the "root cause unestablished" transport interruption.**
- API-client latencies were 22.7, 23.2, 37.1, 2.5, 2.2, 30.3 and 23.4 s for the calls that worked. The two that were interrupted were the two slowest: A04 opening at 40.3 s (`A04.json:1126`) and A07 at 45.3 s.
- The browser path completed A11 at 54.8 s, and the route allows `maxDuration = 300` (`app/api/case/route.ts:32`).
- That points to a harness read timeout of roughly 38–40 s, not the product.
- Recording this (along with the operation IDs from the blocking finding) would close the open transport item rather than carrying it forward as an unexplained risk. Separately, near-minute first responses on richer cases are worth noting as a latency observation.

**3. The input-provenance statement is slightly incomplete.**
`README.md:3` says the inputs reuse existing fixtures and that only "the mixed case adds an explicitly concomitant medication". In fact:
- every opening gained the prefix "Entirely fictional evaluation.";
- A06 also gained "Cardiovex is explicitly a medication." (compare `build-predetermined-responses.ts:28`).

Both changes plausibly affect extraction (product-type routing), so the reuse claim should list them.

## Limitations
- I couldn't see the PR body or comments. If the artifacts or operation IDs are recorded there, or in a linked durable archive, the blocking finding narrows to "not committed per repo convention".
- I couldn't verify the corpus commit `9e0fc0a`, its SHA-256, or that it came before the first call: there was no git access or hashing.
- I couldn't verify any PDF or render hash against actual bytes, because none are in the payload.
- The issue has no checkpoint for the final batch (A10–A12), at least as of this snapshot.
- I read only the first half of `ARCHITECTURE.md` (lines 1–985).

No other blocking findings remain.