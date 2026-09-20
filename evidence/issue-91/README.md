# Issue #91 — laboratory fidelity

Tracker #89 and its DEMO-24 assessment identify extraction loss before review:
hemoglobin and stool-test identity disappeared while numeric/qualitative results
remained. The earlier tryptase failure is the other named regression. Baseline
is PR #93 / main `626ef18`; its protected report-completeness alias remains the
working fallback. Access-bearing URLs are not retained here.

Separate identity/result facts preserve partial observations, stated units,
ranges and dates through source review, stable-ID correction and B6 output.
Missing identity is visible and directly repairable after accepting the
understanding; partial output remains available. Legacy combined text is kept
verbatim with identity unrecorded. Broad dictation ambiguity detection is
deferred independently: unfamiliar terms stay as stated for source review.
No clinical vocabulary, unit or date inference is authorized.

## Bounded live evaluation, specified before execution

Exact four synthetic inputs and expected observations are in
`tests/fixtures/laboratory-fidelity.ts`: tryptase; DEMO-24 hemoglobin/stool;
contrasting culture/platelets/biopsy partials; garbled and unidentified tests.
Run four openings plus the specified tryptase correction against its reviewed
stable identity, then one repeated DEMO-24 opening: **six calls maximum**, no
automatic retries, **USD 5 maximum**. Reserve the provider's maximum output cost
before each call; stop further calls before exceeding the cap. The repeated
case checks observed consistency only, not a reliability rate. No extra model
call is allowed to recover a browser driver failure.

Score identity/result omissions, unsupported additions (especially inferred
units/dates or repaired clinical terms), attribution, repair/clarification burden
and repeatability separately. Preserve one concise scored result per call with
model/prompt/schema, tokens, latency and estimated cost. Do not archive raw logs.
Stop an affected interpretation direction on a recurring material semantic
failure; preserve structural improvements and independently useful cases.

This reopens only the laboratory reliability surface previously observed under
#55/#67. It does not reopen their full experiments or claim broad model
reliability. #92 and #94 remain separate.

## Verification

- Material implementation `189e5bd`: Node 24.20.0 production build/typecheck,
  166 tests across 25 files and all three Playwright tests pass. Existing
  assembled journeys remain green; their legacy combined text now carries the
  explicit identity-unrecorded label rather than being silently split.
- The added browser path starts from the historical DEMO-24 extraction failure,
  visibly discloses missing identities, repairs each through the real API,
  corrects hemoglobin alone and independently reads the downloaded PDF. Stable
  test IDs, date, reference bounds and the other observation remain intact.
- `laboratory.pdf` and its PDFKit page capture show eight numeric, qualitative,
  garbled and partial observations. Independent pypdf widget-coordinate checks
  also found and verify the narrow B6 visual-row mapping repair: native field
  suffixes 5/8 did not line up with their reference bounds and dates.
- PR #93 fallback alias was checked without mutation: deployment
  `dpl_Dh1QnPGgLArPbnzXQ6myFXdapoQM`, SHA `996450f`, ready, with its existing grant
  expiring 2026-09-27 19:19:52 UTC.

Live/deployment results and independent Claude disposition will be recorded
before merge.
