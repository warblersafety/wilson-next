# Issue128 — reviewed values and native PDF representability

Baseline: main `e488ea0a49938218eae647db15a922fc513884f6`, 15 October2026.
The pre-existing issue128 patch in this execution task was resumed; no unrelated
concurrent edits were found. The separate assessment checkpoint is retained in
its repository path as historical context, with private machine details removed;
it does not replace implementation or require a new general approval.

## Contract and form authority

Current [FDA download](https://www.fda.gov/media/76299/download) checked15October2026
is byte-identical to `assets/fda/form-fda-3500-09-2025.pdf`:921232bytes,
SHA256 `1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`,
eight pages, edition09/2025, OMBexpiry30September2027.
[Official instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
and native controls govern output; no clinical synonym or sex inference is made.

- Both suspect slots accept actual native route labels by formatting-only
  case/outer-space match. Other wording, including IV, selects Other with original
  supplied text. Oral compatibility remains. Unknown/declined facts do not become
  a known Unknown/Other answer. Native corrections regenerate a fresh form with
  no stale Other text. Case facts/source/IDs/history remain authoritative.
- Reviewed intersex remains accepted/projected and creates an explicit
  pre-export limitation. Preview/download return existing409pdf-not-ready before
  the adapter's retained rejection. Review/output and an earlier-PDF banner remain
  truthful. No coercion, silent omission, suggested false correction or new
  demographic concept is introduced. This is containment, **not completed support**;
  [issue151](https://github.com/warblersafety/wilson-next/issues/151) owns the
  remaining supplemental-representation decision.
- Other adapter rejection paths were inspected: source identity/hash/page guards,
  existing product/test capacity, full dates, quantity options, frequency readback
  and contradictory checkbox checks. None was weakened. This bounded inspection
  is not exhaustive form coverage or a continuation/qualifier audit.

## Implementer evidence

Existing Node24.20.0, installed locked dependencies/Chromium/pypdf; no installs or
live application-model calls. Typecheck, fresh build,361unit tests in49files pass.
Ten new cases cover both route slots, formatting, custom/abbreviated wording,
cleared Other text, non-known values, readiness/API409/no mutation, retained
history and explicit fictional correction. Independent pypdf reads actual bytes.

Two new Chromium journeys pass: native/custom routes→direct correction→durable
reload→actual PDF; baseline PDF→reviewed intersex→truthful blocked/earlier output→
reload→explicit fictional correction→actual PDF. They preserve unrelated facts,
products, IDs and superseded history. All case POSTs except resume/direct set-fact
are blocked; zero interpretation attempts. Narrow390px layout is checked.
Full67mock-browser regression result and independent review/CI are delivery gates.
The implementer audit also found known empty/whitespace route strings: readiness
now blocks them explicitly and the adapter retains a non-blank guard. Both
values stay accepted/projected; nothing is guessed or silently omitted.

PDFKit rendered the generated synthetic Other-route PDF pages4/5 at2x. Visual
inspection confirms both route/custom-frequency strings are readable, form fields
aligned, and page/form identity intact. Native field flags remain unchanged:
annotationF68 (Print4 plus annotationReadOnly64), fieldFf8388609. NoView is32;
there is **no demonstrated hidden-widget defect** and no visibility/flag/frequency
runtime mutation in this slice. The initial mistaken64NoView interpretation was
caught by an independent check, corrected against the installed SDK enum, and
removed before delivery. Readback and visual rendering are separate evidence.

Initial browser harness corrections: resume uses body.operation, not
body.action.action; FDA sex checkboxes read as /1 and /Off, not label text.
The guards/assertions now match actual contracts; no app behavior, timeout or
required acceptance was weakened. Existing65journeys remain intact.

## Limits

Synthetic/mock evidence proves bounded behavior, not live extraction reliability,
general clinical usability or real-data readiness. Full Form3500 breadth,
qualifiers/continuation, issue150 semantic targeting and issue151 supplementary
representation remain unfinished. No provider wire/prompt, dependencies, storage
schema, credentials, grants, protection settings or shared preview alias changed.
Local synthetic PDF/rendering files are temporary; private access material and
originals are not published. Actual Opus review and exact-head/main CI must be
recorded on the owning PR before completion is claimed.

Rendered [page4](other-route-page-4.png), [page5](other-route-page-5.png) and
[mobile limitation](representation-limited-mobile.png) are synthetic-only visual evidence.
