# Issue #92 medication-history evidence

Synthetic information only. Approved scope and physician-observation provenance remain on #92/#89; PR #100 owns implementation review and delivery.

The initial checkpoint passes 192 deterministic tests, typecheck, production build and all five assembled Playwright tests. Deterministic assertions cover reviewed temporal facts, missing/unknown/declined history, two-product attribution, dose reduction, explicit D5 combinations, stale-outcome supersession and v7–v9 draft restoration. A partial conversational answer retains conditional targets in the same grouped need. Independent pypdf readback verifies actual FDA controls in both Section D slots.

Two complete browser journeys retained here:

- Sparse amoxicillin account: one medication-history group answered conversationally plus one reporter group; reviewed stop date, D7 Yes and D8 Doesn't apply in `medication-sparse.pdf`.
- Two supplied medication histories: zero medication groups initially, one reporter group. Restart correction supersedes recurrence and changes D8 Yes to Doesn't apply. Correcting restart back to true leaves recurrence blank and asks one newly applicable recurrence question. A fresh No answer appears in `medication-two-final.pdf`; naproxen's generic+OTC/D7 No/D8 Doesn't apply remain unchanged. Intermediate PDFs preserve the sequence.

The screenshot records the new grouped task in the existing journey. PDFKit page 4/5 renders support visual inspection alongside independent field readback. The fixed browser queue is deterministic fixture evidence, not model-quality evidence; the frozen four-call `live-protocol.json` defines the separate live evaluation and retry/cost limits. Live results and final review disposition will be added after execution.
