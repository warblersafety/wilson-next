# Issue183: complete purchase dates

Fictional product-capacity cases only. Official pinned FDA3500 09/2025 source:
https://www.fda.gov/media/76299/download?attachment=
Purchase Date is within each Section D Place and Date of Purchase block, separate
from therapy/expiration dates. FDA slot two is named Pdt2PurchaseDate, slot one
Prod1PurchaseDate. No seller/place/category inference or full purchase-coverage claim.

676 unit tests/71 files, typecheck/build passed; two focused mock Chromium
journeys passed (9.6s). Full 105 mock browser suite is running; terminal results
and actual Opus review/CI will be recorded on the PR.

Two PDFs and independent pypdf named readbacks show both native slots and
correction of only the second date. PDFKit 2x page4/5 renders inspected: exact
29-FEB-2024 and 12-AUG-2026 / corrected 13-AUG-2026 appear in purchase controls,
unclipped, distinct from therapy dates. Corrected page4 is byte-identical to the
visually inspected original. Unit tests compare every unrelated named control
unchanged; no invented date on absent/unknown/conflicted/withdrawn states.

Genuine v7-v18 compatibility retains old knowledge and compatible unfinished
drafts; only empty purchase facts added. Date partial/impossible edits persist
unfinished with Apply disabled; nonknown/source/history/routing semantics retained.

Purchase place/address/website, partial dates (#180 case-specific omission
visibility), other D5 categories and previous inventory gaps remain open.
No live application-model calls; mocked prompt behavior is not live validation.
