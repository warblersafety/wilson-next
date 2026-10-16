# Additional native Section D form copy — issue208 / E02 first vertical

FDA instructions require an additional Form3500 copy, only SectionD filled,
for each suspect beyond the first two. This vertical makes the already-retained
third non-device suspect exportable. It reuses the complete pinned09/2025 native
form and writer; the initial two slots stay native/editable and the third uses
the first block of a complete additional native copy. Other sections and its
second D block remain blank. Fixed native appearances are flattened before the
library's supported copyPages workflow to prevent cross-copy field collisions.
Corrections happen in Wilson followed by regeneration. This is not a generic
supplement or a capacity-constant-only change.

Official authority checked2026-10-16:
https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500
Pinned native PDF SHA256:
1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c.

Matching generated report references link the main form, native copy and any
narrative continuation. Global suspect#3 is explicitly identified as the added
copy's first local block. Exact quantity/D5 qualifiers remain linked to suspect#3
in the main B5, without filling B5 on the additional D-only copy or satisfying
the base-description gate. Native purchase/quantity/date/duration/flag validation
applies to the extra product using its actual local slot geometry. Unsupported
wording retains facts and blocks output at its actual product/field target.

Conversational acceptance, explicit correction, source/history/pending authority,
unfinished drafts and resume retain stable identity/order. Explicit withdrawal
reallocates current products and removes the extra copy without dropping the
withdrawn history. Device rerouting removes D fields/context and preserves facts;
the existing multiple-device and concomitant gates remain. Retained capacity
stays three. Additional E-only copies are the next E02 vertical; broader product/
test/concomitant capacity and X01 combination components remain separate.
No persistence structures/version, model prompt, new credentials or inference.

874 unit tests /86 files, typecheck/build and three focused mock browser journeys
passed. All136 full mock browser journeys passed. After a header-only B5 link
clarification, all three focused browser journeys and four PDF tests passed again,
with fresh build/typecheck. Final exact-headCI will exercise the complete suite.
Five latest actual browser PDFs and a long-context unit PDF have independent
pypdf readbacks including serialized native-copy text. PDFKit2x renders of initial
pages1/4 and all eight added-copy pages9–16 were inspected for native values, checkmarks,
layout, matching references and blank non-D fields. Tests separately cover full
long qualifier continuation with one report reference and fourth-projection
rejection. Semantic readback before flatten/copy is not the sole evidence.

The existing generated-PDF residual encryption marker prevents this library
reloading its output. Native copying stays in memory; no encryption bypass or
mutation was introduced. Zero live application-model calls. Actual Opus full review found no blockers and two follow-ups. Final readback
page count was fixed to use the final document and independently asserted for
16/19-page outputs. All eight copied pages were rendered and inspected. Reset
Form is printable (/F=4) in the approved template and visible on original page1
as well as copied page9; it is not a newly exposed hidden control. The cited FDA
general instructions specify only D filled on additional product copies; no
additional A1 requirement was found, so matching report-reference linkage stays.
Targeted actual recheck, final exact-headCI, guarded merge/mainCI/tree/clean and protected hosted
checkpoint remain required. Six macro categories remain; this is one genuine
capacity vertical, not full Wilson completion.
