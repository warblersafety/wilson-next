# Wilson Draft 4 — implementation brief

Updated September 22, 2026. This is the single current delivery brief. Product
principles remain in [PRODUCT.md](PRODUCT.md); ordinary delivery controls remain
in [DELIVERY.md](DELIVERY.md). Historical planning does not add requirements here.

## Status — plan finalized; awaiting instruction to begin

Steve adopted the four presentation clarifications after the completed Opus review,
allowed an increase to **three active working hours** for the initial checkpoint,
and required a working Vercel deployment he can test as the delivery outcome.
Scope, deferrals and the checkpoint are now settled. **Do not implement anything
yet:** the prior instruction to hold implementation remains in place. The
[review record and Codex response](../evidence/ui-draft4-opus-review-2026-09-22/README.md)
retain the original results and subsequent disposition; the adopted clarifications
are incorporated below.

Next: wait for Steve's instruction to begin, then execute this brief under the
existing delivery rules. Steve chose to begin implementation in a **new session**;
this planning session is closed. No further broad planning/review round is needed. Do not
create the delivery issue/branch, run application-model evaluation, or deploy while
the hold applies. The three-hour implementation allowance has not started.

## Intended result

A working Wilson application preview **deployed on Vercel and accessible to Steve**,
so he can test the Draft 4 experience with fictional cases using existing reporting
capabilities. Build on the existing case and services so later improvements extend
it. Physician-feedback readiness is a later decision based on the working result
and its limits.

Use [Draft 4](ui-mockups/README.md) as the visual and interaction baseline, subject
to the explicit deferrals below. Its scripted interpretation and specimen output
are not application capabilities or a backend specification.

## Included work

- Integrate Draft 4's describe, review details, reporter details and review/save
  screens, visual treatment, responsive layout, grouped reporter questions and
  separate privacy panel.
- Use the real LLM → proposals → review → accepted case → PDF pipeline. Preserve
  supported additions, straightforward corrections and serial laboratory results,
  plus existing medication, device and product-problem paths.
- Keep review screens quiet: show captured/proposed facts, conflicts and relevant
  history; put other supported fields behind an optional "Show more fields" control.
  Direct entry remains available without implying that every blank must be filled.
- Use the yellow invitation for useful, currently applicable clinical needs from
  shared completion rules, including several needs when useful. Allow answers to
  several things together or another addition/correction. Accepted answers settle
  corresponding needs; pending proposals do not. Keep reporter questions separate.
- Let users move between screens without losing unsaved text, proposed changes or
  accepted information. Keep these distinct. Viewing an earlier screen does not
  change server readiness or undo completed work.
- Let users revisit and edit reporter details. Unchanged returns preserve the PDF;
  accepted relevant changes require updated output without repeating unaffected
  work.
- Review/save displays the actual generated PDF inline with a clear save action.
  Remove the separate sparse supported-fields imitation of the form.
- Keep the actual generated wording available for inspection, labelled "Report
  event description". Do not give it the mockup's polished "clinical story"
  presentation or introduce a new narrative composer.

## Deferrals

| Leave for later | First-version behavior |
| --- | --- |
| Combined acceptance across change groups | Keep clear per-group acceptance/rejection. |
| Neutral skip | Omit it; retain truthful unknown/declined choices where supported. |
| PDF with partially completed reporter details | Keep current reporter requirements and supported whole-reporter refusal. |
| New fields, greater capacity, another medicine added mid-case | Keep current coverage and limits; explain unsupported additions. |
| Richer report prose and difficult/ambiguous correction interpretation | Keep actual generated content and straightforward existing corrections. |

Omit unavailable features or explain them clearly. Form expansion remains an overall
goal, outside this delivery. Do not add a new clinical confirmation gate or bundle
#94 remediation/the wider backlog into the UI work. #99 remains **NOT READY TO
IMPLEMENT**.

## Safeguards

Use one authoritative case and existing governed actions. Preserve #92 medication
dependency invalidation and separate-product attribution. Never silently lose
accepted information or claim unsupported details are included. Draft text and
unaccepted proposals are not PDF contents. Keep output validity tied to its accepted
contents and existing readiness rules. No parallel clinical model, scripted success
path, temporary backend, speculative framework or new durable case storage.
Reporter corrections, including supplying details after refusal, must supersede
earlier values rather than create conflicts. Preserve drafts on navigation; invalidate
obsolete clinical drafts when their prerequisites change so old answers cannot return.
Previously generated PDF bytes may remain viewable with an accurate label while
changes await review; do not claim current output is ready or bypass generation gates.

## Effort and completion evidence

Once implementation is explicitly authorized, allow **three active working hours**,
then stop for a checkpoint. Prioritize one real end-to-end path. Show what works,
obstacles and estimated remaining work; agree further effort before continuing.
Count active implementation, verification, repair and deployment work together;
do not restart the allowance for each phase. Raise material scope or architecture
obstacles earlier. Three hours is not a completion promise or total delivery budget.
If delivery finishes earlier, present it then. Otherwise report what is actually
ready at the checkpoint and agree the next allowance. Planning cleanup and the
completed model review did not start this implementation allowance.

Evidence should demonstrate the included behavior: a growing synthetic case through
review and a real PDF, unchanged returns, accepted clinical/reporter edits, retained
drafts/proposals, and preservation of existing supported paths and #92 safeguards.
Check the changed desktop/mobile surfaces and read back generated PDF content.
Choose proportionate exact tests and live-model limits in the authorized delivery
record under existing delivery rules; historical sample counts and estimates are
not requirements. A material fidelity failure cannot be presented as a successful
supported path. This scope does not promise broad language reliability.

Delivery is complete only when the working preview is on Vercel and Steve has a
verified access link. Use the existing Wilson project/shared-preview workflow and
protections in [DELIVERY.md](DELIVERY.md); retain rollback to the prior working
deployment. Verify that the link serves the intended candidate and exercise a
synthetic case through actual interpretation, review and PDF generation there.
Supply the link, a short testing guide and known limitations. A local build or a
successful Vercel build alone is not the requested deliverable. Normal implementation
review and required checks still apply; the Opus planning review does not replace
them. This is the synthetic preview, not a production release or physician session.

## Supporting material — consult as needed

- [Code integration map](UI-IMPLEMENTATION-IMPACT-2026-09-22.md): existing entry points
  and necessary integration, not an additional feature list.
- [Prototype feedback register](UI-PROTOTYPE-REVIEW-2026-09-21.md): F01–F26 and their
  dispositions; preserved evidence, not a second implementation brief.
- [Walkthrough evidence](UI-WALKTHROUGH-PROBLEMS-2026-09-21.md): observed problems.
- [Mockup recovery](ui-mockups/README.md): Draft 4 and unchanged Draft 3 source/portable
  archives and integrity manifest. Temporary preview URLs are not required.
- [Planning history](history/README.md): superseded starters, broader proposals,
  estimates and prior scope records. Not prerequisite reading for implementation.

Planning updates, the complete Opus review record and mockup archives remain local
and uncommitted in `/Users/sofa-claude/code/warblersafety/wilson-next`. Start the new
session in this same working directory. If implementation uses another worktree,
explicitly carry these records across before beginning; a fresh checkout does not
contain them. The review's raw temporary streams are not required: its prompts,
results, metadata and frozen candidate brief are retained under `evidence/`.
