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
- Standard fresh-context Claude Sonnet high review of `593ae34` completed in
  253,229 ms through the authenticated subscription, Read/Glob/Grep only.
  Its one blocker was a stale architecture invariant contradicting the approved
  partial-observation support. `d59ea38` reconciles that paragraph. Historical
  quarantine notices are intentionally retained for v7/v8 compatibility, and
  date-only rows are explicitly documented as repairable partial information.
  The actual review and dispositions are canonical in PR #95. No code changed
  after review; the originating review covers the documentation remediation.

## Preview access limitation

PR #93 deployment `dpl_Dh1QnPGgLArPbnzXQ6myFXdapoQM` / SHA `996450f` remains
unchanged. Candidate `593ae34` deployed after PR #95 creation, with PR metadata,
and passed fresh Chromium/Firefox access, blank-case API and disclosure/reset
checks. Ordinary URLs remain protected; project-wide bypass remains absent.

The current hosting plan permits only one active share link. Creating the
candidate grant automatically revoked the fallback grant; restoring fallback
access then revoked the candidate grant and interrupted a PDF download. This
matches the previously recorded issue-85 hosting limitation. Both deployments
have individually passed fresh-browser checks; those checks do not establish
simultaneous anonymous access. No deployment was replaced, protection weakened,
or plan purchased. The user was asked which preview should own the share link.
Final access selection and live evaluation disposition are pending.
