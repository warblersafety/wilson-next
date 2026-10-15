# Issue #170: explicit A2 patient age in weeks

All inputs and artifacts are fictional. No application-model calls were made.
Predetermined model outputs exercise proposal grounding and human review, not
live interpretation fidelity. That unresolved boundary remains #169.

## Official semantics and bounded behavior

[FDA A2 instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500),
consulted 15 October 2026, ask for the most precise supplied age at event onset
with its units and give years/months/days guidance. The pinned official 09/2025
form additionally has a native Week(s) checkbox; its tooltip explicitly says to
check it when patient age is given in weeks. This slice uses that control only
for explicitly supplied patient age in weeks. It does not infer gestational age,
convert units, infer dates/age or round. Form SHA256 remains
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.

Weeks extends the existing atomic age fact, legacy ageYears identity, current
Age unit selector and native width guard. Whole nonnegative safe integers are
accepted as explicit months/weeks/days; numeric years retain 0–150 bounds.
Changing a unit retains the quantity until explicit acceptance. No new question,
clinical judgment, age-specific clinical rule or broader pediatric validation.
Fractional/compound ages, DOB, race/ethnicity remain outside this slice and
visible in coverage disclosure. All earlier unresolved issues remain open.

State v13 validates v12 with its previous strict months/days contract and
v7–v11 with their old numeric-years contracts after existing migrations. Facts,
histories, IDs, sources, targets and revisions remain unchanged. New weeks
mislabelled as v12, including in history, are rejected without mutating input.
Finite unfinished invalid month/week/day edits persist without becoming facts;
legacy numeric drafts and unrelated drafts remain intact.

## Independent native PDF evidence

- `age-weeks.pdf`: actual adapter output from a command-built six-week age case.
- `age-weeks-readback.json`: independent pypdf named controls. Unit tests compare
  symmetric full maps of all unrelated controls and adapter readback against
  the projection; legacy years maps stay unchanged.
- `age-weeks-appearance.json`: independently traversed full widget names,
  native rectangles, exact AgeValue6 and generated Helvetica8.5pt `<36>` text;
  only Weeks has checked V/AS. No blank unused unit control is gratuitously set.
- `age-weeks-page-1.png`: actual macOS PDFKit2x render, visually inspected:
  value6 and Week(s) checked, other units clear, no clipping or displacement.

## Acceptance

Pinned Node24.20.0:495unit tests across59files passed; final23focused unit
checks passed after adding strict invalid-weeks assertions; typecheck and fresh
build passed. All85full synthetic/mock Chromium journeys passed in2.9minutes,
including the added weeks overflow/recovery case. Five focused age journeys
passed in25seconds before that additional case. Exact CI/review dispositions
are recorded on the PR. Unit coverage includes zero,
strict invalid shape/value rejection, grounded week proposals, mixed-unit
conflicts, source/history/qualifiers, nonknown clearing, months/days/years
compatibility, v12 strict restoration and native-width/API409 guard.

Full mock browser cases include a six-week opening, seven-week correction kept
pending until accepted, reload, unit-only changes through every supported unit
without calculation, invalid negative/fractional week edits surviving reload
with Apply disabled, zero weeks, unknown clearing, and native v12 month/day
history plus invalid unsent age/other drafts retained before explicit weeks
correction. Oversized weeks remain accepted and saved, block fresh PDF requests,
and recover only after an explicit representable correction. All existing
browser journeys run with the attributable 50-response mock queue; no live
fallback is allowed.

Early unit runs exposed stale exact prompt/queue-count assertions after adding
the new scenario. Those were updated to the new complete text/count, including
unique scenario identities; no behavioral acceptance assertion was weakened.
No dependencies, purchases, credential/auth/grant changes or shared-preview
changes were made.
