# Issue 119 — bounded operator clarity

Steve approved the six-change specification on September 23, 2026 after review
of all 14 preserved post-#116 screenshots and the existing application. The issue
contains the approved specification; PR #120 owns the final diff and independent
review. The four screens, card layout and service-enforced acceptance order stay.

## Delivered behavior

- Shorter instructions and spacing, a smaller initial account box, and field-only
  update labels within a single stable entity. Full entity/field source attribution
  remains in the existing disclosures; no groups are combined by display name.
- Interpretation activity appears in its initiating button, with a persistent
  polite live region. Errors, explicit retry, retained text, reduced motion and
  current/earlier PDF feedback remain.
- Accept/Discard labels distinguish proposal rejection from correction and
  withdrawal. Field edits to proposals remain drafts until group acceptance.
- The clinical panel distinguishes pending review, actionable questions and
  optional additions. During update review, the draft input remains mounted in
  a disclosure; pending/missing guidance stays available separately. Completing
  review brings actionable questions into view; direct answers focus the next
  applicable question without passive rerenders stealing focus.
- New test actions occupy their eventual positions while disabled, then enable
  at the existing stage boundary. Each test still requires explicit acceptance.
- Clinical work gets the primary navigation action; early reporter entry is
  labelled drafting. Reporter and Output return actions name the actual next
  task. Previously saved reporter details retain their distinct saving permission.

Only three production files change: `app/journey.tsx`, `app/clinical-guidance.ts`
and `app/page.module.css`. No service, semantic case, completion policy, source
contract, model prompt, projection or PDF adapter changes. #105, #115, broader
redesign, registration, form expansion, richer progress and #118 remain outside
scope. The serious-outcome interpretation concern remains unresolved: UI wording
never supplies missing outcome answers or claims to repair that interpretation.

## Acceptance evidence

234 deterministic tests, typecheck and build pass. Focused Chromium checks cover
loading/failure/retry, reduced motion, source disclosure, independent update/test
acceptance, disabled test actions, newly available questions, direct navigation,
retained narrative/dictation/direct-answer/reporter/privacy drafts, and actual PDF
readback. Discard checks prove unrelated accepted facts and sources survive;
discarding the first test leaves the second observation unchanged. Previously
saved reporter information remains savable while clinical completion can still
block the PDF. Opening edits remain drafts until explicit acceptance.

The focused flow uses #116's labelled synthetic variant of the preserved #109
response, not the unavailable user session. Its downloaded `accepted.pdf` matches
all 59 populated named fields in the independent #109 readback, including both
dated hemoglobin rows, medication follow-ups and reporter privacy. The usability
journey also checks current/stale PDF feedback and single-field changes after a
clinical correction and reporter edit. No live application-model calls and no
repeated user case/PDF walkthrough.

Selected 1440px/390px screenshots retain compact attributed review, enabled test
controls, reporter draft guidance and actual remaining clinical work. Existing
fidelity/browser coverage retains qualifiers, history, conflicts, omissions and
multiple products. Stable-ID unit coverage prevents shortened field labels from
combining different entities. Programmatic accessibility evidence does not claim
manual screen-reader parity or unassisted usability.

Verification failures are retained without changing application rules: the first
deterministic invocation omitted the repository PDF-reader environment (22 missing
`pypdf` errors); the corrected invocation passes. The first full browser run
stopped at an old “Remove lisinopril” selector and displaced later shared fixtures.
The next run passed 11/13; one old test expected hidden rather than disabled test
actions, and the new discard test incorrectly used the display number/exact date
text despite existing renumbering and the Proposed badge. Selectors now verify
disabled actions and the retained dated observation; rejection remains distinct
from withdrawal. Both corrected tests pass in isolation. Final full-suite/CI and
independent-review results are recorded in the PR and closeout below.

## Preservation and limits

All 82 pre-existing local documents, evidence and mockup files are backed up with
SHA-256 hashes at `/private/tmp/wilson-clarity-preserved-20260924`. They remain
uncommitted. The standard review runner requires a clean tree; any temporary
stash is restored and hash-checked after it has copied the committed payload.
No credentials or access-bearing preview URLs belong in this evidence directory.

These checks establish the bounded presentation/navigation behavior and retained
PDF content, not general interpretation reliability, full form coverage or a
production/real-data readiness decision. Conversational correction beside each
card remains outside this slice.
