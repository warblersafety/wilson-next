I don't think this should merge yet. I found four blocking issues (two in the code, two in docs and evidence) and three smaller follow-ups.

## BLOCKING

### B1. The new F supplement prints stop/restart outcomes that suspect products deliberately withhold
- **Code:** `src/domain/case/projection.ts:547-566` prints every resolved `stopped`, `doseReduced`, `improvedAfterChange`, `restarted` and `recurred` value as-is, with fixed labels.
- **Governing rule:** ARCHITECTURE.md:276-290 says the D7/D8 outcomes require a known stop/reduction or restart. Unresolved or declined prerequisites leave the outcome blank with a disclosure, and "Projection also checks applicability." Suspect products follow this at `projection.ts:450-475`.
- **What goes wrong:** the labels "Improved after stopping or reducing" and "Event returned after restarting" assume the stop or restart happened. The F path prints them even when that is declined, unknown or missing.
- **Evidence:** `tests/pdf/f-medication-context.test.ts:16` requires output showing "Restarted: Declined" next to "Event returned after restarting: No". `evidence/issue-243/f431ba604b2d/report-page-9.png` shows exactly that. Suspect output would withhold that answer and disclose why.
- **Why it matters for concomitants:** the grouped medication-history task targets suspect products (ARCHITECTURE.md:266), so concomitant prerequisites are often empty. An accepted `recurred=false` would then print "Event returned after restarting: No" with no restart statement anywhere. That adds a claim the clinician never made.
- **Fix:** reuse `withdrawalApplicability`/`restartApplicability`, print the outcome only when applicability is true, and otherwise keep the existing not-included disclosure. Alternatively, record an explicit owner decision to diverge.

### B2. Section F continuation pages no longer say which field they belong to
- **Code:** each medication entry's heading is `F row N - accepted medication details` (`src/server/pdf/concomitant.ts:24`), and each page header repeats only that (`concomitant.ts:48`).
- **Governing rule:** ARCHITECTURE.md:1747-1748 (issue212) says "Every continuation page repeats its starting row/field so a detached dense page remains attributable." The name and context headings in the same function do include the field.
- **Evidence:** `evidence/issue-243/f4afa5a485fe/report-page-11.png` shows "Exact supplied indication line 92…100" under "Starts with F row 1 - accepted medication details". Nothing on the page says these lines are the Indication. The same thing happens to the second line of a multi-line dose or its "Context:" line when it spills onto a new page.
- **Fix:** put the field label in each medication entry's heading.

### B3. The owning documents now contradict the code
The diff touches no file under `docs/`, but it reverses several recorded decisions:
- ARCHITECTURE.md:283 says "concomitant support is unchanged".
- ARCHITECTURE.md:1236-1237, 1272-1273 and 1307 say ongoing status, reduction date and duration get a "no-destination disclosure" on concomitant routes.
- ARCHITECTURE.md:1742 says "Unknown/conflicted/pending/superseded values do not print" in F. F now prints Unknown, Declined, Explicitly absent and Does not apply.
- ARCHITECTURE.md:1881 says "F1 supports only therapy start/stop, with other facts still disclosed as non-carried."
- The PRODUCT.md:238 checklist row was not updated.

DELIVERY.md:147-170 and 286-287 require the owning document to be updated, and changed decisions to be named, when authority changes. Every comparable slice added an ARCHITECTURE section; this one needs one too.

### B4. Required acceptance evidence is missing at this commit
`evidence/issue-243/README.md:21-25` says:
- The first full browser run had 23 failures (154/177 passed). Assertions were then changed, and the full rerun is still pending.
- Exact-head CI, protected preview verification and the frozen live check are also still pending.

The issue requires the full unit, browser, type and build suite to pass. I checked the test edits I could see: they change page counts (8→9) and filter out F pages, which fits the new behaviour. That still isn't evidence the suite passes at this commit.

## FOLLOW-UP

- **F1. The render manifests overstate what was inspected.** All five `report-render.json` files carry the same check list, and three are byte-identical (hash `daf1f58…`). They claim "A07 page 6" and "final line 100 visible" for directories where only page 9 of a non-dense case was viewed. The dense check was marked as passed without catching B2. Write the checks per directory.
- **F2. Reduction dates are formatted differently from every other date in the report.**
  - A complete reduction date prints as raw ISO (`2026-09-18`); `tests/pdf/dose-reduction-date.test.ts:70` asserts this. Native F dates and every other supplement use DD-MMM-YYYY (ARCHITECTURE.md:1883).
  - A partial reduction date prints only its wording (`projection.ts:558`). It drops the precision line and the "No missing month or day has been inferred" statement that `suppliedDateText` adds everywhere else, including partial F start and stop dates on the same page.
- **F3. Concomitant products of type `other` are left out.** The gate is `productType === "drug-or-biologic"` (`projection.ts:547`), while suspect-side medication handling covers `["drug-or-biologic","other"]` (`duration.ts:31`; ARCHITECTURE.md:282). An `other` product's regimen is still disclosed as not included, so this is a known gap rather than silent loss.

## Checks that came out clean

- Report-key and report-reference invalidation include the new notes.
- Extra D/E form copies get no duplicate F supplement.
- The new page-6 pointer (y=750) doesn't collide with the F1 expiration pointer (y=119) or the device-copy links (y=776/763).
- Legacy invalid reduction dates still block export through `invalidCalendarDates`.
- Unsupported characters block export and point at the exact product field.
- Pending updates block the PDF (e2e).
- No dependency, app or UI files changed.

## What I inspected
- `REVIEW-ISSUE.json`, `REVIEW-FILES.txt` and the whole diff. I read every source and test hunk; the generated `state.json` evidence I sampled rather than reading line by line.
- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md` and `docs/DELIVERY.md` in full.
- Source in context: `projection.ts`, `medication.ts`, `duration.ts`, `date-precision.ts`, `types.ts`, `form-3500.ts` (lines 1-699), `concomitant.ts`, `d2-continuation.ts`, `product-date-continuation.ts`, `service.ts` (lines 90-179), and the PDF route.
- Evidence: the issue-243 README, render manifests and readbacks, the live-acceptance-241 README and the frozen protocol. I viewed four PNGs myself: 1e2a page 6, f431 page 9, f4af page 11, and the 17f145 readback text.

## Limitations
- I could only read files in the payload; I ran nothing. No tests, typecheck, build, PDF parsing or hash checks.
- I didn't verify the hashes in `hashes.json`.
- I didn't inspect the app UI code or every generated state file, and I couldn't search the payload, so the review is from targeted reads.

No other blocking findings remain beyond B1–B4.