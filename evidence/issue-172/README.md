# Issue #172: complete date of birth as the A2 alternative

All inputs/artifacts are fictional. Predetermined outputs exercise ordinary
proposal grounding/review and correction; other cases use command-built
fixtures. No application-model calls were made. Mocks and prompt assertions
establish no live fidelity. Existing #169 and paused #150 remain unresolved.

## Official semantics and explicit choice

[FDA A2 instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500),
consulted15October2026, ask birth date if known or age at event onset. The pinned
09/2025 native DateBirth tooltip specifies DD-MMM-YYYY. The form's OR is an output
alternative, not authority to delete supplied clinical facts. Form SHA256 stays
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.

DOB and age remain separate reviewed facts. The clinician-only A2 value to print
control selects one when both are known. With one known and no choice, only
that value prints. Both known without a choice block new output; an explicitly
selected unavailable value also blocks instead of falling back. Unselected
known facts are retained and explicitly disclosed as not selected for A2.
Switching output preference never edits age or DOB, their history/source, or
independent unfinished field edits. No consistency/clinical judgment, age/date
arithmetic, unit conversion or gestational-age inference. The model cannot
propose the print choice; that target is absent from its schema and guidance.

## Complete dates and historical compatibility

Only complete valid Gregorian ISO dates in years0001–9999 become DOB facts.
Leap years include2000/2024, not1900/2023. Invalid/partial drafts remain exact
text across reload, Apply is disabled and a clear instruction remains visible.
Domain/model/API/current-state and PDF defenses reject impossible DOB dates;
no missing components, timezone shifts or age are inferred. Fixed component
formatting produces native DD-MMM-YYYY. No future-date/age eligibility judgment.
Global legacy date issue #164 stays open; unrelated old dates are not repaired.

Statev14 strictly validates v7–v13 against their original schemas, then adds only
empty DOB/choice facts. Prior facts, IDs, targets, revisions, sources/history and
unfinished edits are preserved. Historical test fixtures remove just the fields
that did not exist, keeping their original equality assertions. Native v13 week
age/history and unsent age/product edits are exercised through actual browser
resume, DOB addition, explicit print selection and native export. Older v7–v12
migrations and browser cases remain in the full suite.

## Independent native PDF evidence

- `birth-date-leap.pdf`: actual output for explicitly supplied2024-02-29. DOB
  native V is29-FEB-2024; no age value or unit is selected.
- `birth-date-age-selected.pdf`: explicit age choice for retained6weeks and DOB.
  Native age6/Weeks is selected and DateBirth is blank.
- Matching `*-readback.json`: independent pypdf named controls. Tests compare
  symmetric maps of every unrelated field, and actual adapter readback equals
  projection. Existing years/months/days/weeks PDF maps remain covered.
- `a2-appearance.json`: independent traversal of full widget names, actual
  rectangles and generated appearances. DateBirth width127.020pt with centered
  Helvetica8.5pt exact `<32392D4645422D32303234>` text. Age has exact `<36>` text
  and Weeks-only V/AS. Unused native DateBirth is left unset on old age paths.
- Matching `*-page-1.png`: actual macOS PDFKit2x renders, visually inspected.
  Correct date or age/unit; no clipping, displacement or simultaneous A2 values.

## Verification

Pinned Node24.20.0:525unit tests across61files, typecheck and fresh build passed.
Three focused DOB Chromium journeys passed12.0seconds; all88full synthetic/mock
Chromium journeys passed3.1minutes, including final omission visibility checks.
Final34focused unit checks pinned native geometry and actual request/schema
instructions after the full525pass. Exact CI and actual Opus dispositions are
recorded on the PR.

Unit cases cover leap/boundary dates, impossible/partial inputs, invalid DOB
quarantine without discarding other supplied facts, model exclusion of print
selection, pending/conflicts/resolution, unavailable chosen values, API409 guards,
qualifier/omitted-base disclosure, source/history, and strict v13 migration.
Browser cases exercise conversational acceptance/correction, both-known export
block, explicit switches, retained invalid DOB plus unsent age edits, reload,
visible omission/qualifier disclosure, unknown selected DOB block and explicit
age recovery, genuine v13 resume, and unrelated draft/product preservation.

Early checks caught stale control-shape/legacy fixture expectations and a test
trying to mutate a frozen fixture. Those were corrected without weakening the
contracts. Invalid-only model responses already fail as wholly unrepresentable;
mixed-output checks explicitly verify invalid DOB quarantine while a supported
identifier survives. The first focused conversation test assumed a whole
multi-sentence input became one source; it now verifies actual grounded source
passages, exact original offsets and retained DOB wording. No product workaround.

No dependencies, purchases, credentials/auth/grants, shared-preview changes or
unrelated repository changes. No full Form3500, real-data or broad model/pediatric
clinical-validation claim. Partial DOB, fractional/compound age, race/ethnicity
and the other existing gaps remain outside this bounded slice.

## Actual review remediation and CI prerequisite

Actual subscription Opus high review at1f97c22 found no blockers and one
follow-up: after a selected A2 value became unknown with neither alternative
known, the clearing recovery was hidden behind generic clinical statuses.
The preference now has an explicit No print preference option, no silent Age
default, no clinical-status dropdown and no new qualifier control. No preference
uses the sole known value or permits blank A2 if neither is known; both-known
still requires selection. Existing preference context remains visible and can
be explicitly removed, with its accepted history preserved. Recovery messages
name the actual clearing option. Unit and browser cases cover the full recovery,
no default selection and explicit existing-context removal.

Post-remediation526unit tests/61files, finaltypecheck and freshbuild passed.
Five focused DOB journeys passed16.4seconds. Actual targeted Opus recheck and
final full browser/CI results are recorded on the PR.

First-head CI at1f97c22 passed typecheck/unit/build and87of88browser cases. The
existing waiting-reporter-tab test retried immediately after page.close without
observing Chromium's native workspace lock release, and no Saved region appeared.
The helper now requires native held-lock absence before the same user retry;
it never steals a lock, sleeps, increases timeouts/retries or weakens any final
ownership/data assertion. Five focused repetitions passed6.5seconds. This small
test prerequisite delta is included with the material recovery recheck.

All90full synthetic/mock Chromium journeys passed3.2minutes after both fixes,
including the existing reporter waiting-tab path. The complete material delta
is committed for the originating Opus review's targeted recheck and fresh
exact-head CI. PDF mapping/artifacts are unchanged by this UI/test remediation.
