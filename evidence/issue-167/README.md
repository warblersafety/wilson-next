# Issue167: A2 patient age in months and days

All data and artifacts are fictional. No application-model calls were made.
Two predetermined responses exercise ordinary grounding and explicit review;
other cases use command-built accepted fixtures. This is deterministic
integration evidence, not live-model reliability or clinical validation.

## Semantics and compatibility

[Official FDA A2 instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500),
consulted15October2026, ask age at event onset with units and describe years,
months and days. Pinned09/2025 form hash remains
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.
Its AgeValue plus Years/Months/Weeks/Days widgets verify one quantity and one unit.
This slice preserves explicitly supplied whole months/days and the existing
whole-years behavior. It does not calculate from dates, convert units, round,
infer a missing unit or enforce threshold conversions. Zero new questions.
Weeks, fractional/compound ages, DOB and race/ethnicity remain unsupported and
explicitly disclosed. No broader pediatric clinical behavior is claimed.

One atomic age fact avoids independent quantity/unit or competing age facts.
Internal legacy key ageYears stays for existing IDs, history, source/change
references and unfinished draft targets. Numeric0–150 values still mean years;
months/days carry {value,unit}, with nonnegative safe-integer quantity. Statev12
strictly validates actualv7–v11 numeric-year shapes after the prior migrations,
then retains them unchanged; no age or target rewrites. Current accepted values
are validated strictly. UI draft codecs separately retain unfinished finite
numeric quantities/units, including invalid negative/fractional edits, without
promoting them. Numeric input uses the established number-control behavior.

The existing Age editor gains a unit selector. Changing it keeps the number for
explicit clinician acceptance; it never calculates an equivalent. Numeric years
and retained years edits are labelled clearly. A chosen age conflict records a
readable source value/unit, without object-stringification or an internal target
name in the age description. Qualifiers remain explicitly disclosed as omitted.

## Independent native PDF evidence

- `age-months.pdf` / `age-days.pdf`: actual output for24months and5days from a
  separate command-built case, preserving the original source/history.
- Matching `*-readback.json`: pypdf named-control maps. Tests compare symmetric
  maps of every unrelated populated field, catching writes to formerly blank
  controls as well as changed values. Adapter readback equals the projection.
- `age-appearance.json`: exact stored values, native rectangles, actual generated
  Helvetica8.5pt appearance hex text and all four unit values. Only Months or
  Days is checked respectively; Years/Weeks and the other new unit are off.
- `age-*-page-1.png`: macOS PDFKit2x renders, visually inspected: value24with
  Month(s) checked and value5withDay(s) checked, no clipping/displacement.

Native AgeValue is27.621pt wide. The same native font/1pt padding metrics guard
an unrepresentable quantity before PDF generation, with adapter defense and
API409s in preview/download. Accepted age stays intact; no shrinking, truncation
or substitution. Years retain their established0–150 whole-number contract.

## Acceptance paths

PDF/domain/model/server tests cover months/days/zero, unchanged years, explicit
unit-only and amount corrections, pending and mixed-unit conflict/resolution,
source/qualifier/history, all four nonknown meanings, strict invalid shapes and
native width/API error behavior. Old-version compatibility includes v7–v11,
strictly rejected mislabelled new-unit/future payloads and preserved input data.

Browser paths cover natural24-month opening and5-day correction before/after
acceptance, exact PDFs, a direct years round trip with no conversion, persisted
invalid unfinished month input, visible qualifier omission/history and unknown
clearing all units. Nativev11 resume retains an unsent numeric years edit and an
unrelated dose draft; only explicit age submission changes the case, while the
dose stays unsent and absent from the PDF. An accepted oversized day quantity
stays saved with no fresh PDF request until explicit correction recovers output.

The first full run found a New Age/New Age unit accessible-label collision in an
existing broad selector; it was stopped when the resulting mock queue went out
of sequence. The selector now uses the established measurement label Age unit;
old Age input lookups and assertions are preserved. No application-model calls
or clinical-data changes occurred. Final check outcomes and review/CI belong to
the PR.

Prior150 remains paused; calendar164, partial dates, glyph/capacity and other
existing gaps remain independent. No new dependencies, purchases, auth/grants or
shared-preview changes.
The next full run found two exact text checks needing the deliberate years label
and a historical PDF-map regression from writing explicit Off values into three
previously unset unit boxes. The adapter now leaves blank unused native controls
untouched on the legacy years path, while still clearing selected mismatched
units. Historical PDF-map equality is retained unchanged; two exact UI assertions
now require the explicit years wording. Independent PDFs/AP/readbacks were
regenerated; page1 render PNGs are byte-identical to the inspected images.

## Local acceptance checkpoint

Pinned Node24.20.0:489unit tests/59files PASS, typecheck/freshbuild PASS, all82mock
Chromium journeys PASS (2.7min), including the unchanged historical PDF control
map comparison. The three focused new journeys passed (12.2s) before the final
label/control-map compatibility fixes; the full82 run covers the final tree.
Independent PDFs/readbacks/AP proof were regenerated after the control-map fix;
render PNGs were byte-identical to the visually inspected images. No assertion
was removed or broadened to bless a different age value/unit. Actual Opus review,
exact-headCI, merge and mainCI disposition belong to the PR.

Actual Opus found no blockers. Its scope-documentation follow-up is resolved:
the shared prompt no longer says adult-only because this slice represents
explicitly supplied month/day ages. Architecture records that narrow framing
change and the original adult completion evidence, without claiming broader
pediatric clinical behavior or live-model validation. Follow-up169 owns future
authorized live unit-preservation evidence despite the legacy target name. No
new provider calls, product behavior, semantic contract or test assertions changed
in this editorial clarification. Delivery permits the originating review to
cover this bounded documentation remediation; no repeat model review is needed.
