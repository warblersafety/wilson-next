# Serial-test correction allocation containment

Baseline: main `34cb8160e5c5ce90b44171aadb91e15bc1740691` (15 October 2026).
Historical [issue105](https://github.com/warblersafety/wilson-next/issues/105) retains
the failure and [existing diagnosis](https://github.com/warblersafety/wilson-next/issues/105#issuecomment-5803617218).
The original raw provider response is unavailable. Tests construct synthetic
responses; they are not byte-exact replay or a live-model evaluation.

## Delivered boundary and remaining issue

An unmatched later-turn correction reference cannot allocate a new test merely
by appearing in a response-local declaration. Dependent facts on that bad
reference are quarantined too; independent valid siblings remain reviewable.
Exact supplied IDs, including pending/unnamed observations and redundant echoed
declarations, still resolve the original observation. Genuine additions remain
allowed, separately reviewable and subject to the existing capacity limit.
Sources, accepted facts, explicit acceptance and superseded history are retained.
No fuzzy matching, automatic acceptance, clinical decision or retry-as-repair is
introduced. Architecture records this local boundary; provider code, prompts,
revisions and wire schema remain exactly as before this slice.

**This is containment, not completion of issue105.** Correct responses already
worked; the tests protect them while blocking the demonstrated allocation error.
The model can still choose the wrong valid ID or mislabel correction as a fact.
An addition with a correction to its own newly declared reference in one response
is quarantined for restatement; source excerpts remain visible. These limits do
not establish general conversational correction reliability.

## Stopped provider experiment

The first candidate attempted request-specific allowed-ID enums. A request test
caught the installed SDK0.124.0 demoting enum/const to descriptions, as already
recorded by [issue38](https://github.com/warblersafety/wilson-next/issues/38).
A documented raw-schema restoration was explored, but actual Opus review blocked
it: it affected every update, revived the provider-schema rewriting premise
previously stopped in issue67, and lacked live acceptance/target-selection proof.
That approach was stopped and removed; commit `1b4ba62` retains the candidate for
reconstruction. It is not the delivered wire. No dependency was changed and no
paid model call was attempted. Revisiting the provider contract requires an
explicit owning architecture decision and suitable separately authorized live
synthetic verification. The unfinished work is retained in [open successor150](https://github.com/warblersafety/wilson-next/issues/150). Historical105 was inadvertently marked complete by a negated keyword in PR147; that wording is corrected. The scoped broker has no reopen operation, so the linked successor preserves the remaining scope without a credential or permission workaround.

## Verification

- Five boundary cases cover correct existing IDs, genuine first additions,
  invented/typo references despite declarations, dependent bad-reference facts
  versus valid additions, redundant ID echoes and separate review groups.
- Five production request/boundary/service cases protect explicit acceptance,
  stable IDs, untouched sibling/facts/dates/ranges, superseded history,
  no-allocation/no-retry failures, genuine additions and mixed review.
- Service PDFs are read independently with pypdf. Three mocked browser journeys
  download the actual UI PDF and verify corrected/separate rows, reload/resume,
  mixed review and retained draft/case after malformed reference.
- Final narrowed source: **351 unit tests in47 files**, typecheck/fresh build
  and **all65 mocked Chromium journeys passed in1.7minutes**, including actual
  PDF readback. Exact-head and merged-main CI remain separate delivery gates.

Harness corrections: new responses appear before existing source-reference
scenarios, matching browser execution order (28 scenarios/42 responses/37 scopes).
An initially prepended full run was interrupted, not counted as success. The
immutable synthetic baseline is cloned before assigning a browser-valid case ID;
browser-state decoding is checked before service tests. No storage validator,
product assertion or timeout was weakened.

All application-model calls remain mocked. Live semantic target selection is
unverified. This is not full Form3500 coverage or real-data approval. No new
credential, grant, auth change, purchase or dependency installation occurred.
