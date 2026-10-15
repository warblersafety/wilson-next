# Issue115 — B6 test and B7 relevant-history context

Baseline3ddd7f595142197eb705fb1040c25a568bae87ac. Scope: five current B6 fact
qualifiers and scalar B7 history context, not complete issue115/Form3500 support.

## Diagnosis and representation

Test name, result/stated units, lower/upper reference limit and date previously
reached native B6 cells without their accepted qualifiers; history did likewise
in B7. Context appeared only in qualifier-not-included disclosures.

Current B6 qualifiers now populate the native Additional comments box verbatim,
each labelled by actual current B6 table row and field. Row references describe
this PDF's visible table, not UI display ordinals or guessed test identity. Native
identity/result strings, stated units, range text and date formatting are unchanged.
Withdrawals regenerate both table and notes from current active entities. Notes
carry current qualified-fact source IDs; no date sorting, unit conversion, trend,
clinical classification or per-item/list-scope inference is introduced.

B7 retains raw accepted scalar history followed by an explicitly labelled
History context line. This is not a new whole-list interpretation or159 change.
Current known/resolved facts only; pending, conflicted, non-known and superseded
context is never promoted. Explicit correction/removal/re-add/resolution still
uses the authoritative command boundary and retains history. Actual-output keys
now change for context that reaches these native fields.

[Official FDA instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
were inspected15October2026: B6 Additional comments supports test/lab information;
B7 owns relevant history/time courses. The source PDF tooltip agrees. Native
B6comments528.001x197.008 and B7history528.001x201.838 both use8pt/max2000/padding1.
The existing B5 multiline font/fit algorithm is extracted unchanged into a shared
PDF-owned helper. B7 is checked with or without qualifiers, preventing a base
history problem from being bypassed by qualifier removal. B6 checks cover its
new comments, not the unchanged grid's remaining glyph/fit risk154. Unsupported
text stays accepted and blocks preview/download; no shrink, substitution,
truncation, new font or continuation pages.

## Local evidence

- 441unit/PDF tests54files PASS; typecheck and fresh production build PASS.
- Twenty-eight new cases: all five contexts on two same-named serial tests and
  history; exact row/field/source links; actual units/dates/ranges and every other
  native control unchanged; withdrawal rebinding; correction/removal/restored
  case/output keys/history; four non-known states; six fact fields×three glyph/
  character-capacity/vertical limits with preview/download409s and adapter defense;
  B7 base protection without qualifier; native metadata/visual eight-row order;
  pending alternatives, conflict and explicit chosen resolution.
- Five focused browser journeys PASS16.9seconds, including former omission-only
  test-result editing now positively verified in native comments with PDF
  regeneration, unsaved/accepted reload, correction/remove/re-add/history, unchanged
  siblings and unrelated controls; B7 correction/removal/reload and retained blocked
  context with no fresh PDF or interpretation requests. Mobile390px width check
  remains. Initial new assertions used the wrong date widget name/case; corrected
  to actual unchanged TDate/DD-MMM-uppercase, preserving strict date assertions.
- Full76mockbrowser regression PASS2.2minutes. Canonical actual review,
  exact-headCI and merged-mainCI results are recorded in the PR before delivery.
- [Synthetic PDF](test-history.pdf), [pypdf readback](readback.json),
  [projection/source trace](projection.json), [native AP check](appearance-check.json),
  and [PDFKit2x page3 render](route-page-3.png) retained. Both B6comments and B7 AP
  operands independently decode to stored wording/order (only wrapping whitespace
  normalized). Render inspected: complete readable notes, no clipping/substitution,
  separate exact units/dates, correct row attribution. Bounded fixture evidence,
  not general cross-viewer font/glyph support.

## Boundaries

No model/provider/prompt/schema/storage/dependency/auth/grant/shared-preview change
or live application-model calls. Existing supported configLoader runner/task-local
cache is used; the denied default Vitest temp path is not retried. Selectors and
whole-list scope remain unchanged.150paused;151/153/154/157/159explicit/open. Remaining
115 includes other patient/product/device/reporter and selector/stop context,
broader chronology/list scope and output capacity beyond the current native boxes.
