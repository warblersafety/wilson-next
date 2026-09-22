# Draft 4 implementation — issue 101

Steve explicitly authorized implementation in the September 22, 2026 task.
`implementation-brief.md` freezes the finalized local brief; its historical hold
was superseded by that instruction. The original planning documents and mockup
archives remain local and unchanged. Branch starts at current main `76042a9`.

Initial active work began 2026-09-22 18:56 UTC; checkpoint no later than 21:56 UTC.
The issue owns scope, synthetic model-call limits and stopping conditions. Implementation and deployed verification are complete; independent review follows.

The four browser screens use the existing case actions. Shared completion policy
supplies read-only clinical invitations. Reporter changes use corrections and
preserve an unchanged save. PDF artifacts are held in browser memory with case
identity and a hash of projected report sections, excluding entity IDs and source/
revision metadata. Readiness gates remain in the PDF route. Older bytes can be
viewed with an earlier-output label while review is pending.

Local verification: 201 deterministic tests, typecheck and production build pass.
The five existing browser tests pass, preserving the original independent downloaded-
PDF readbacks across medication, laboratory, device and product-quality paths.
Two new Draft 4 browser tests pass (7.1 seconds), covering navigation and draft
retention, pending proposals, unchanged reporter saves, corrected reporter/PDF
contents, current versus retained earlier output, and local/accepted medication
prerequisite changes. The final 17 focused service tests also pass. The complete seven-test suite passed in CI run 35774127876 against post-PR
candidate `98ad1a78aee3b036e2096f78e4489b25d5d8a31d`.

The legacy 20-case assembled browser test now uses explicit per-group acceptance,
navigation and the real PDF. Assertions against the removed HTML form imitation
use the accepted projection alongside the retained independent PDF-byte checks.
Its measured local runtime is 41.2 seconds; its timeout is 120 seconds for CI.
No application-model behavior or tests were relaxed to make the redesign pass.

Retained screenshots cover desktop and 390-pixel mobile surfaces. Reporter PDF
readback verifies corrected email, opted-out manufacturer identity disclosure,
and corrected age. The actual generated narrative remains labelled “Report event
description.” Blank fields remain optional; fully known serious outcomes are
grouped, with their individual controls available on request. Optional report date
clearing uses an explicit absence; an omitted action field preserves the old date.

Live synthetic protocol is `live-protocol.json`: three calls, $1.60 reserved per
call, $4.80 total under the $5 batch allowance, no automatic retry. The three completed calls cost an estimated $0.094296 (19,868 input and 5,456
output tokens; 41,643 ms model latency). Exposed metrics and assessments against
the prewritten input are in `live-results.json`; no model retry or repair ran.


Deployed verification used the existing protected shared Vercel alias, retargeted
from `dpl_8UYA95UK47ABe7UxhUueNt2KQAEe` to post-PR candidate
`dpl_7spHNVQGeFHmXa7FTkR52fpThUiR` (commit `98ad1a78`). The existing share grant
and expiration were retained; unsigned access still redirects (302). The prior
working deployment remains ready for rollback. No production deployment occurred.
The private access URL is handed to Steve separately and is not committed.

The live synthetic case moved through all four screens, accepted multiple clinical
answers from one update, retained drafts, preserved an unchanged reporter/PDF
return, held earlier PDF bytes during a pending correction, and regenerated after
accepted clinical and reporter edits. Three downloaded PDFs are retained.
`pdf-readback.json` records independent pypdf 6.16.2 readback: serial hemoglobin
results keep dates/ranges; only September 12 changes from 9.4 to 9.6; the final
reporter email changes and identity nondisclosure stays checked. macOS PDFKit
renders of pages 3, 4 and 7 were visually inspected and retained.

`live-inline-chromium.png` demonstrates the actual native PDF viewer in full
Chromium. Default headless-shell screenshots show layout and iframe presence but
cannot render its PDF plugin. A headed-browser capture could not establish layout
visibility on this host; full Chromium headless rendering succeeded. Desktop and
390-pixel mobile screenshots preserve the changed screens with no horizontal
overflow. The live protocol was not repeated to capture these images.

Known limits remain those in the frozen brief: one bounded successful synthetic
path does not establish broad language reliability; richer prose/ambiguous
corrections, bulk acceptance, partial reporter completion, new fields/capacity and
mid-case medicines are deferred. #94 and #99 are unchanged. The UI and independent
PDF checks preserve the existing medication, device and product-problem paths.
