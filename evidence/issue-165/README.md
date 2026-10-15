# Issue165: Section D NDC number or Unique ID

All inputs and artifacts are fictional. No application-model calls were made.
The browser runs two predetermined responses through ordinary grounding/review,
then native persistence and the actual PDF API. This proves deterministic
integration, not live-model reliability or regulatory identifier validity.

## Semantics and bounds

[Official FDA instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500),
consulted15October2026, D1 describes NDC or HCT/P Unique ID and specifically
preserves label zeros/dashes. The pinned09/2025 form hash remains
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.
Both native Prod1NDC_ID/Prod2NDC_ID tooltips identify this concept. It is separate
from lot/catalog/serial and device UDI. No lookup, number conversion, clinical
inference or regulatory identity check. No new follow-up question.

New ndcOrUniqueId string fact uses existing source/history/nonknown/conflict and
review contracts. Statev11 validates actualv7–v10 schemas before adding only an
empty fact; prior migrations remain. Source objects, histories, changes and
revisions are preserved; malformed/mislabeled/future payloads fail without
mutating caller input. Native v10 browser evidence includes an unfinished dose
draft, which remains editable and unsubmitted after migration.

Both native fields are145.196pt wide, Helvetica8.5pt. Guard uses actual font
metrics/charset and existing1pt padding. Known blank, newline/tab, unsupported
glyphs and horizontal overflow retain accepted facts and block preview/download
with the identified product/fact. Adapter guards independently. No shrinking,
clipping, truncation, transliteration or silent omission. Context qualifiers
remain explicitly disclosed as omitted; Section E/F do not carry this field.
Wider identifier capacity/glyph support is unfinished, alongside153/154.

## Independent artifacts

- `identifier.pdf`: generated from the command-built two-suspect fixture.
- `readback.json`: pypdf named-control map. Symmetric map comparison checks every
  unrelated populated control and detects a newly filled formerly blank control.
- `appearance.json`: pypdf native appearance streams/rectangles; exact hex text
  decodes to00123-0045-06 andHCT 00-A/07 at8.5pt, preserving zeros/dashes/space/slash.
- `identifier-page-4.png` / `identifier-page-5.png`: PDFKit2x renders, visually
  inspected for readable exact identifiers in their D1 boxes without clipping
  or displaced content. AP inspection supplements viewer rendering.

The PDF tests verify adapter readback equals the projection; both slots,
correction/raw whitespace/qualifier omission, unknown/declined/absent/inapplicable,
pending/conflict, withdrawal/rebinding, device UDI separation/concomitant omission,
native geometry/metric boundary and PDF API409s for six invalid representations.
Migration tests cover accepted/pending/conflicting/withdrawn products, strict
malformed/future rejection and numeric-model-value quarantine with independent
valid facts retained. Existing v7–v9 resume cases now also coverv10.

Browser journeys exercise opening proposals before acceptance, exact two-slot
PDFs, conversational second-product correction/history, direct unknown and
reload. The native migration journey retains an unsent dose edit, then adds an
unsupported identifier, verifies blocked output/reload and recovers by explicit
correction to a spaced identifier and actual PDF download.

Partial dates and calendar164 are unchanged.150 stays paused;115/151/153/154/157/
159/161 remain separate. No accounts, new dependency, auth/grant or preview change.

## Local acceptance

Pinned Node24.20.0:471unit tests/57files PASS, typecheck PASS, fresh production
build PASS, all79mock Chromium journeys PASS (2.4min), and both focused new
journeys PASS (7.4s). Two authoring assumptions were corrected: use the official
PDF adapter's existing empty-password load option for metadata inspection, and
include an independent valid fact when testing numeric-value quarantine because
the established boundary rejects a wholly unrepresentable response. No existing
acceptance assertion was weakened. The complete retained PDF/render evidence is
synthetic; review and CI outcomes belong to the PR.

Actual Opus review found no blockers or independently valuable follow-ups. Its
minor fixture observation is addressed: the constructed v10 workspace removes
the new identifier fingerprint from saved card drafts as well as removing the
case fact and restoring old provenance, so the retained-dose test exercises the
pre-field draft shape. Product behavior is unchanged by this evidence repair.
The strengthened browser journey also exercises identifier qualifier omission
and a suspect-to-concomitant-to-suspect role correction with reload and actual
PDFs, verifying the identifier stays with the product and never fills Section F.
Final strengthened tree:471unit/57files,typecheck,freshbuild and all79mock browser
journeys (2.5min) PASS again. The expanded two focused journeys also passed
(10.9s) before the final visibility assertion/full rerun. Native PDF production
code and independent artifact bytes are unchanged by this evidence repair.
