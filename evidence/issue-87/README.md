# Issue #87 opening and case-summary evidence

The agreed design is [issue #87](https://github.com/warblersafety/wilson-next/issues/87).
[PR #88](https://github.com/warblersafety/wilson-next/pull/88) owns implementation
review, deployment verification, and merge disposition.

The opening uses one centered task area, product-purpose copy, a short demo
warning, and a native About disclosure. The summary appears after interpretation
and keeps one Case summary heading through output. Counts name individual
proposals or unresolved conflicts; absence of attention makes no review or
completeness claim. Existing proposal badges, acceptance controls, conflict
choices, and omissions preserve their meaning.

New case checks submitted revision, unsubmitted narrative/update text, and
changed opening report selections. Cancellation preserves work. A successful
reset clears the case and drafts, resets the report selection, focuses Clinical
account, and announces New case started for five seconds. A failed request
preserves existing work and reports the error. Stage/clarification transitions
focus the new task heading; within-task acceptance does not move focus to a new
heading. Routine restoration is quiet; incompatible stored state explains the
loss of the previous case.

The implementation review found that reset-from-opening temporarily reused the
interpretation progress text. Progress now follows the operation (opening,
update, case edit, reset, or PDF), and the opening submit button shows extraction
only while interpreting. A held-request regression verifies reset progress and
preserved state before the response. The review's bounded follow-ups are also
closed: successful interpretation clears the submitted opening draft, remaining
load/reset error copy uses ordinary case language, and the populated New case
started notice is checked and captured at 390px without overlap or overflow.

## Verification

On macOS with Node 24.20.0 and the existing pypdf 6.16.2 environment:

The initial local verification accidentally fell back to Node 22.23.2 because
the old temporary Node 24 directory had lost its executable. Before final
review closure, the official Node 24.20.0 archive was restored and SHA-256
checked, the executable version was confirmed, and all required commands and
the browser evidence were rerun with that executable. CI also pins 24.20.0.

- `npm run typecheck` passed.
- `PYPDF_PYTHON=$PWD/.venv-pdf-evidence/bin/python npm test` passed: 21 files,
  152 tests. The initial run without this environment failed only because
  system Python lacked pypdf; configuring the existing reader resolved it.
- `npm run build` passed.
- `PYPDF_PYTHON=$PWD/.venv-pdf-evidence/bin/python npm run test:e2e` passed:
  the full assembled deterministic journey/PDF suite and the new focused blank
  and draft reset test. The assembled suite now covers canceling an interpreted
  case, partial acceptance, summary transitions, singular/plural attention,
  and clearing existing cases. Its processing wait uses enabled controls rather
  than the removed progress wording.
- Focused Chromium 153.0.8010.12 and Firefox 155.0 checks passed for opening,
  interpretation in progress, pending understanding, partial acceptance,
  clarification, proposed later updates, output, conflict, and reset. Both
  browsers verify About by pointer, Enter, and Space; retained input identity,
  text and selection; no request caused by disclosure use; dictation help and
  explicit submission; stage-heading and reset-input focus; transient status;
  quiet restore; visible feedback for incompatible stored state and reset
  failure. `browser-checks.json` records the bounded checks.
- Existing accepted dose remains 400 mg while a 200 mg correction is proposed;
  accepting it changes the active value and shows 400 mg as history. The
  unresolved date alternatives remain visible and omitted from the form.
- Geometry and control checks pass at 1280×800, 1440×900, and 390px width for
  opening and populated summary, without horizontal document overflow. The
  centered opening input stays below 760px wide. Representative Chromium
  screenshots cover those sizes plus disclosure, partial acceptance,
  clarification, proposed update, and conflict output. The implementer inspected
  the rendered captures for wrapping, overlap, input width, and reachable actions.

The temporary cross-browser harness uses the existing repeated-product fixture
pair once per browser. All model responses are deterministic; no live application
model calls, real data, or extraction/PDF-policy changes occurred. Screenshots
contain only fictional fixture information.

## Limits

Browser keyboard, focus, native disclosure, and live-region behavior are checked;
this is not screen-reader certification or clinician usability evidence. Native
OS dictation was not exercised again. The existing deferred live-model
reliability limitations remain unchanged. Secret-bearing preview URLs and
administration credentials are excluded from these artifacts. The PR records
verified share expiration separately from deployment retention.
