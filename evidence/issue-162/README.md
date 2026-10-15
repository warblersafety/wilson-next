# Issue162: Section D expiration dates

All content is fictional. No application-model calls were made. The assembled
browser journey uses two predetermined model responses and ordinary source
validation, explicit review, correction, native browser persistence and PDF API.
It is deterministic integration evidence, not live-model reliability evidence.

## Authority and behavior

[Official FDA instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500),
consulted 15 October2026, D6 requests expiration if available (best/use-by for
cosmetics). The pinned official09/2025 form hash remains
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.
Native Prod1ExpDate/Prod2ExpDate tooltips require DD-MMM-YYYY. Existing complete
ISO-date fact/control contracts are reused; missing day/month is never invented.
Zero new follow-up questions. No product-expiry judgment or causality inference.

## Retained independent PDF evidence

- `expiration.pdf`: actual generated two-suspect output from the command-built
  synthetic fixture, distinct from the browser's conversational fixture.
- `readback.json`: pypdf full named-control readback.
- `appearance.json`: pypdf extracted actual native appearance streams and
  rectangles; WinAnsi hex text decodes exactly to29-FEB-2028 and31-DEC-2027 at
  the existing Helvetica8.5pt. This verifies appearance text as well as stored V.
- `expiration-page-4.png` / `expiration-page-5.png`: macOS PDFKit2x renders,
  visually inspected: both dates are legible in their correct D6 boxes with no
  clipping or displaced form content. No broad glyph-fidelity claim is made.

`tests/pdf/product-expiration.test.ts` independently reads actual PDFs and
compares all other named controls with the unchanged baseline. It covers two
slots, leap day, source trace, correction/history/qualifier omission, serialized
restore, all four non-known kinds, pending/conflicting alternatives, withdrawal
and concomitant-role omission. Existing device regressions remain required.

`tests/e2e/product-expiration.spec.ts` starts from a natural fictional opening,
checks unaccepted dates remain proposals, accepts groups, downloads both slots,
reviews a conversational second-product correction, reloads durable storage,
compares every other PDF control, then directly marks the date unknown and
verifies blank output after another reload. Its artifacts are disposable browser
outputs; canonical retained PDF/render evidence above uses no private originals.

## Deliberate limits

This adds complete-date Section D support only. Partial-date precision,
expiration qualifier representation, other category controls, purchase and
identifiers remain unfinished. Qualifiers remain accepted with explicit output
omission disclosure. Section F still discloses its expiration omission. Existing
state already has this fact; no migration, dependency, auth or UI redesign.
Issue150 remains paused;115/151/153/154/157/159/161 remain separate.

## Local acceptance checkpoint

Pinned Node24.20.0:449unit tests/55files PASS; typecheck PASS; fresh production
build PASS; all77mock Chromium journeys PASS (2.3min), including the new focused
journey which also passed separately (5.3s). Full-suite fixture counts/order were
updated for the two new attributable responses. An initial browser selector
mistake was corrected to the existing `Expiration date status` label. No
application regression or acceptance weakening was involved. Review/CI/merge
records belong to the PR.
