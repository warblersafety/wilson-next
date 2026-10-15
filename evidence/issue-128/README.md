# Issue128 — reviewed values and native PDF representability

Baseline: main `e488ea0a49938218eae647db15a922fc513884f6`, 15October2026.
The existing patch matched this task's recorded in-flight work, not concurrent
user edits. The prior assessment-only checkpoint is preserved in full as
[historical evidence](historical-assessment-2026-10-15.md), with its original
[documentation index](../../docs/ASSESSMENT-2026-10-15.md) retained. Its working-tree
references describe that snapshot; later explicit implementation authority and
this evidence own the selected slice's current delivery status.

## Form authority and bounded contract

The current [FDA download](https://www.fda.gov/media/76299/download), checked
15October2026, is byte-identical to `assets/fda/form-fda-3500-09-2025.pdf`:
921232bytes, eight pages, edition09/2025, OMBexpiry30September2027, SHA256
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.
[Official instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
and actual controls govern output. No clinical synonym or sex inference is made.

Both suspect slots select an actual native route label only by case/outer-space
formatting equivalence. Other wording, including IV, selects Other with original
wording verbatim, within the explicit native control limits below. Oral
compatibility remains. Unknown/declined values stay non-known. Fresh generation
after an explicit native correction contains no stale Other text. Accepted
facts, identity, sources and superseded history remain authoritative.

Reviewed intersex stays accepted/projected but creates an explicit pre-export
limitation. Preview/download return existing409pdf-not-ready before the retained
adapter rejection. Review/output and an earlier-PDF banner agree. Issue128
explicitly permits a pre-export limitation; current user authority requires no
clinical inference and faithful representation. That supports this temporary
block rather than guessing a native sex or silently omitting the reviewed value.
The app does not recommend a false replacement. Test recovery simulates an
explicit fictional clinician correction, not a product recommendation. This is
**containment, not full support**; [issue151](https://github.com/warblersafety/wilson-next/issues/151)
owns the remaining faithful supplemental-representation decision.

The shared PDF-owned helper rejects blank/whitespace route/frequency/dose/strength
before output, keeping the accepted/projected values intact. Other Route and
Other Frequency also require single-line wording that fits at native8.5pt with
existing1pt padding and the existing Helvetica appearance font. Source widths
are165.6pt and123.129pt respectively; no native MaxLen is present. The installed
Cantoo appearance provider uses these bounds and the fixed native size. It
silently replaces unsupported characters with ?, so we check its actual font
character set before measuring. Oversized, line-breaking or unsupported-glyph
wording creates a structured readiness issue; the adapter keeps the same guard.
No font shrinking, truncation, glyph substitution, field-flag mutation or
clinical-text rewrite is introduced. [Issue153](https://github.com/warblersafety/wilson-next/issues/153)
owns full support beyond these controls. This is not general field coverage.

## Verification

Existing Node24.20.0, locked installed dependencies/Chromium/pypdf; no installs
or live application-model calls. Remediation typecheck/fresh build and all
**376unit tests across50files PASS**. Three focused Chromium journeys PASS9.6s;
all68mock-browser journeys PASS against the final build in1.9minutes.
Actual targeted recheck and new exact-head/main CI remain delivery gates on PR152. Before remediation, the complete67browser suite and
exact-head CI38694400146 passed at0a0ea47; that head is superseded by remediation.

- Actual PDF byte readback covers native/custom routes in both slots, formatting,
  no abbreviation inference, non-known values, cleared Other text and history.
- Independent pypdf metadata asserts all68route option export/display pairs are
  identical in both widgets, matching the pinned option list. Unit-option export
  codes do not imply different route export values; no route rewrite is needed.
- Independent source metadata verifies Other field widths,8.5pt default size,
  absent MaxLen, zero border and unchanged ReadOnly/DoNotScroll flags. A65character
  route and54character frequency actually fit; full values read back and all
  four generated appearance streams retain `/Helvetica 8.5 Tf`.
- PDFKit2x rendering of [page4](other-route-page-4.png), [page5](other-route-page-5.png),
  [fitting long page4](fitting-long-text-page-4.png) and
  [fitting long page5](fitting-long-text-page-5.png) was inspected: supplied strings
  fit, remain readable, and preserve alignment/form/page identity. Oversized
  hundred-W strings, multiline text and non-WinAnsi text are explicitly blocked.
- Service/API tests cover blank values in all four fields, preserved projections,
  preview/download409 and unchanged case; capacity/character limits preserve
  source/history and never reach generation through normal readiness.
- Three browser journeys cover native/custom correction→durable reload→actual
  PDF; earlier PDF→intersex→truthful block→reload→explicit fictional correction;
  and oversized route/frequency→retained blocked output/no PDF request→reload→
  explicit supported correction and actual PDF. Unrelated products/facts and
  superseded history remain. All case POSTs except resume/direct set-fact are
  blocked; zero interpretation attempts. [Mobile390px](representation-limited-mobile.png)
  has no document overflow and follows existing layout/components.

## Review corrections and limits

Actual subscription Opus high review run `issue128-20261015T064519-cfbfe040`,
canonical `claude-opus-5-5`, CLI2.1.296, preflight passed, inspected0a0ea47.
The actual full report is [on PR152](https://github.com/warblersafety/wilson-next/pull/152#issuecomment-6186343013).
Static only: reviewer ran no tests or CI. Its B1/follow-ups were addressed:

- B1: adjacent blank text now has shared readiness/adapter guards and recurrence
  evidence. The original audit claim was too broad. Fresh pre-fix probes at0a0ea47
  showed empty frequency/dose/strength **generated**, not the hypothesized500;
  truthiness guards/readback retained empty values differently than the review
  assumed. They still passed readiness without meaningful visible wording. We
  fixed that real representation gap, not an invented late-failure mechanism.
- F1: native geometry/size/flags and no MaxLen checked; fitting long text actually
  rendered/read, oversized text explicitly blocked. Full support tracked153.
- F2: both widgets'68export/display pairs independently checked, all equal.
- F3: explicit issue128 limitation authority and151 remaining gap recorded above;
  never ask the user to invent or substitute a clinical value to obtain a PDF.
- F4: full assessment retained under evidence with original path now an index.
  Historical line/status claims no longer compete with owning current docs.

An early64NoView flag interpretation was disproved against the installed SDK:
NoView=32, annotationReadOnly=64, Print=4. NativeF68/Ff8388609 stay unchanged.
There was no demonstrated hidden-widget defect and no visibility fix is claimed.
Initial new browser guards misread resume's operation envelope and checkbox label
versus /1-/Off export values; harness corrected, no assertions/timeouts weakened.
The Unicode guard initially trusted encodeText success; a failing recurrence
revealed Cantoo's explicit ? substitution. The real font character set is now
checked; original wording stays retained and blocked, never substituted. An
implementer audit also replaced inherited-object lookup in frequency encoding
with own-property lookup: constructor/toString/__proto__ are literal Other
wording, never native options; actual PDF readback covers all three.

Synthetic/mock results are not live extraction reliability, clinical usability,
full Form3500 coverage or real-data readiness. Source identity/hash/page, existing
capacity/date/quantity/readback/checkbox guards remain. Broader qualifiers,
continuation, issue150 semantic targeting and issues151/153 full-support decisions
remain unfinished. No provider wire/prompt, dependencies, storage schema,
credentials, grants, protection settings or shared preview alias changed.

## Targeted recheck and bounded evidence closure

The single targeted same-session actual Opus5-5high recheck at material
`5b4a86f457a810b075f52d6868bd052cf39020bc` found no blocking findings or new
material regression; B1/F1–F4 resolved. Static only, no reviewer tests/CI.
Its non-blocking R1 is now explicitly owned by
[issue154](https://github.com/warblersafety/wilson-next/issues/154).

The [direct appearance inspection](unicode-appearance-inspection.json) of the
existing synthetic issue96 PDF confirms stored β/≥ but generated ? glyphs.
The issue96 README now narrows its historical claim to stored-value roundtrip
and the observed PDFKit rendering; portable appearance fidelity was not proven.
This is a pre-existing risk outside the two Other controls, not a new regression.
The exact PDFKit rendering source is unproven; no new viewer/printing claim is
made. Full-field glyph/fit support requires the issue154 decision. This closure
changes only documentation/evidence, not the reviewed5b4a86f implementation,
tests, product/architecture contract, fonts or dependencies. Delivery's bounded
evidence-closure rule applies; no second reviewer or additional recheck is run.
The owning PR records exact final-head and merged-main CI separately.
