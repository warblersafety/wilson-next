# Draft 4 implementation — issue 101

Steve explicitly authorized implementation in the September 22, 2026 task.
`implementation-brief.md` freezes the finalized local brief; its historical hold
was superseded by that instruction. The original planning documents and mockup
archives remain local and unchanged. Branch starts at current main `76042a9`.

Initial active work began 2026-09-22 18:56 UTC; checkpoint no later than 21:56 UTC.
The issue owns scope, synthetic model-call limits and stopping conditions. This
record will hold final evidence; implementation and verification are in progress.

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
prerequisite changes. The final 17 focused service tests also pass. The complete
seven-test suite will run in CI against the post-PR candidate.

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
call, $4.80 total under the $5 batch allowance, no automatic retry. Deployed
verification, required independent review and final delivery disposition follow.
