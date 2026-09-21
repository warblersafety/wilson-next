# Issue #92 medication-history evidence

Synthetic information only. Approved scope and physician-observation provenance remain on #92/#89; PR #100 owns implementation review and delivery.

The initial checkpoint passes 195 deterministic tests, typecheck, production build and all five assembled Playwright tests. Deterministic assertions cover reviewed temporal facts, missing/unknown/declined history, two-product attribution, dose reduction, explicit D5 combinations, stale-outcome supersession and v7–v9 draft restoration. A partial conversational answer retains conditional targets in the same grouped need. Independent pypdf readback verifies actual FDA controls in both Section D slots.

Two complete browser journeys retained here:

- Sparse amoxicillin account: one medication-history group answered conversationally plus one reporter group; reviewed stop date, D7 Yes and D8 Doesn't apply in `medication-sparse.pdf`.
- Two supplied medication histories: zero medication groups initially, one reporter group. Restart correction supersedes recurrence and changes D8 Yes to Doesn't apply. Correcting restart back to true leaves recurrence blank and asks one newly applicable recurrence question. A fresh No answer appears in `medication-two-final.pdf`; naproxen's generic+OTC/D7 No/D8 Doesn't apply remain unchanged. Intermediate PDFs preserve the sequence.

The screenshot records the new grouped task in the existing journey. PDFKit page 4/5 renders support visual inspection alongside independent field readback. The fixed browser queue is deterministic fixture evidence, not model-quality evidence; the frozen four-call `live-protocol.json` defines the separate live evaluation and retry/cost limits.

Four live calls ran against protected preview commit `78216b0`: 3 openings and
1 correction, no model retries, estimated USD 0.207638 total. `live-results.json`
retains facts, source excerpts, metrics, questions and explicit assessment;
`live-readback.json` independently reads the four actual downloaded PDFs.
Medication-scope expectations held in all four exposures. Sparse: medication
plus reporter (2 groups); two-product opening: reporter only (1); correction:
no new group (0); fresh case: serious outcomes, ibuprofen stopping, reporter
(3). The fresh sample preserved all medication unknowns without guessing
improvement, recurrence or doxycycline subtype.

**Retained limitation:** the fresh case omitted six negative serious-outcome
facts despite the supplied general negation, causing an unnecessary question.
It also placed nausea in product-problem description rather than symptoms,
matching the separately tracked #94 concern. This is not a clean overall
journey pass. The fresh PDF was completed from the saved response with direct
answers and zero new model calls; the medication behavior and the unrelated
extraction failures are scored separately. No prompt tuning or resampling was
used to erase the failure. The batch offers existence evidence, not a reliability
rate. A subsequent view-only notice explains superseded outcomes; source
extraction, case rules and PDF mapping are unchanged from the live candidate.

Visual inspection: the grouped-task screenshot and PDFKit pages 4/5 show legible
labels, stop date and the intended D5/D7/D8 selections with intact form layout.
The final browser suite also checks that the supersession explanation is visible
and that remaining-unknown preserves selected answers. Independent review and
final delivery disposition are recorded on PR #100.
