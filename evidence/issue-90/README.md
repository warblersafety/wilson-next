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
