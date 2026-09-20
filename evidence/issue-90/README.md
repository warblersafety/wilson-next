# Issue #90 — report metadata and medication quantities

Tracker #89 coordinates this slice, laboratory fidelity (#91), and medication
follow-ups (#92). Baseline main was `77be689`; the working PR #88 deployment is
retained separately while this candidate is evaluated. No access secrets belong
in this repository.

## Scope and verification cases

Report date is explicitly submitted from the reporter step and is editable;
PDF regeneration never changes it. Dose and strength remain independent facts.
Simple quantities map to text/unit controls; complex descriptions remain intact.
The current FDA source bytes and dropdown options remain unchanged.

`tests/fixtures/report-completeness.ts` contains three synthetic opening cases
and independent expectations: dose only (no known strength), 250 mg tablets
with a 500 mg administered dose, and 250 mg/5 mL liquid with a 10 mL dose.
No model or runtime code imports this fixture. Live evaluation: three calls,
no automatic retries; at most one justified three-call recheck, total <=6 calls
and USD 5. Score omissions, additions, attribution, and unsupported inference
separately; a single successful sample is not a reliability rate.

Deterministic checks cover independent PDF values/units in both suspect slots,
concentration fallback, missing strength, unchanged report date, direct correction,
identity refusal, invalid date rejection, and lossless upgrade of valid v7 cases.
Existing journey and PDF regressions remain required. Browser coverage exercises
the date default/edit and final output; final evidence is recorded below at closure.

## Remaining scope

No new clinical follow-ups or laboratory repair in this slice. Complex quantity
text can leave the separate unit blank by design. The output discloses unsupported
Section D fields. The protected preview remains synthetic-only.

## Acceptance evidence

- Node 24.20.0: typecheck and production build passed; 156 tests in 23 files
  passed. The assembled Playwright suite passed both tests, including the existing
  regression journeys, local-day default, provided/declined reporter date,
  direct date correction and independent PDF assertions.
- `quantities.pdf`, three PDFKit page captures and `pdf-rendering-result.json`
  show separate numeric/unit controls in both suspect slots, a preserved liquid
  concentration and the report date. Independent pypdf assertions also check the
  FDA dropdown export values, rather than relying only on adapter readback.
- `live-results.json` records the three real synthetic opening calls against
  deployment `af4ce5e`, independent expected/observed values and scored gaps.
  All three preserved independent dose/strength, with no invented strength or
  calculated liquid dose. Two completed the deployed browser journey and their
  downloaded PDFs passed independent pypdf value/unit/date checks. The first
  driver's completion logic stopped at the existing clinical-context question;
  that successful extraction was not repeated. Deterministic coverage verifies
  its dose-only PDF case.
- `preview-access.json` records fresh Chromium and Firefox access, blank-case
  API, disclosure/reset behavior and ordinary URL protection. The candidate has
  a separate protected alias; the PR #88 fallback alias was not changed.

The live sample also exposed two follow-up findings: symptoms were retained as
`problemDescription` and displayed under “Product problem,” and the 500 mg tablet
case omitted the accompanying “two tablets” wording. Neither changes the
quantity values checked here; neither is claimed fixed. Three samples do not
establish model reliability, and this is not a physician-readiness decision.
