# Wilson synthetic testing checkpoint — Steve

**Status: code verified; protected testing handoff pending authenticated checks.**

Reviewed application source: `5943e609f9515e4684e66d71df9cd18fd20e2f75`
([PR142](https://github.com/warblersafety/wilson-next/pull/142)), tree-equivalent
to merged main `dc7cd047028cb95984a81b5552fe6ab014b74a11`.
Deployment **7078695904** reports success for that exact source. Its immutable
candidate URL is [the protected preview](https://wilson-next-80bolwbb0-warblersafety.vercel.app).
This URL is verified as deployment metadata and an unsigned authentication
redirect, **not yet as an operator-ready testing link**. Use the final explicitly
verified origin once the remaining checks below pass. Do not substitute an older
preview or assume stored work follows a different hostname.

Use only fictional clinical and reporter/contact information. This is a bounded
save/resume and reporter-reuse checkpoint, not complete Form3500 coverage or
approval for real reports. Existing protection remains in force.

## A short clinician-oriented pass

1. Start with a fictional medication event in your own words. Review proposed
   details; correct one value and explicitly accept the right groups. Check that
   the workflow preserves what you meant and distinguishes unknown/declined
   information from a negative answer.
2. Leave unfinished text in a clinical update, a field editor and the Reporter
   form. Wait for “Saved in this browser”, close the browser, reopen the exact
   same site/profile. Check your accepted facts, pending review, full submitted
   wording, unsent words and visible workflow step. No input should be submitted
   again automatically.
3. Open a second tab at the same site. It should explain that the first tab owns
   editing; close the owner and explicitly retry the second. Confirm continuity.
4. Enter fictional reporter identity/contact/professional details and remember
   them. Select a case-specific date, prior-reporting destination and disclosure
   choice. Save the reporter details to this report separately. Check the PDF
   against the accepted case, including reporter details and date; Wilson never
   submits it to FDA.
5. Start a new case after reading its loss confirmation. Reporter identity and
   professional defaults should be editable and reusable, while the earlier
   case's date, prior-reporting and disclosure selections must not carry over.
   Edit one reporter value before saving it to the new report. Existing accepted
   reports must not change when remembered defaults are updated or forgotten.
6. Try a fictional device event or product-quality problem through the same
   narrative/review/output flow. Note anything you cannot express, a misleading
   question/label, a missing field or an output omission. Current bounded PDF
   capacity includes two suspect non-device products plus one concomitant,
   with separate single-device limits; this does not promise full Form3500 coverage.

## What to record

For each problem: candidate SHA and site hostname, browser/profile, fictional
words/steps, expected versus observed behavior, saving indicator, whether the
problem survived reload and a screenshot or synthetic PDF if useful. Avoid
repeating a failed action before noting the first result. Classify a problem as
meaning/clinical workflow, lost/changed work, misleading status, output mismatch,
missing supported capability or usability friction; no clinical efficacy or
causation judgment is being requested.

Browser storage is local to this origin/profile. Clearing site data, a new
preview hostname, private browsing, eviction or profile loss can remove access;
it is not a backup. A power failure can lose the latest completed browser save.
Testing on other browsers remains useful feedback, not automated coverage.

## Completed evidence and remaining checks

- [PR140](https://github.com/warblersafety/wilson-next/pull/140) delivered durable
  active-case resume. [PR142](https://github.com/warblersafety/wilson-next/pull/142)
  delivered separate fictional reporter reuse. Their topic branches are deleted.
- Final local exact Node 24.20.0 gates: **336 unit tests across 44 files, all 60
  deterministic Chromium journeys, typecheck and fresh build passed**. Browser
  evidence includes actual temporary-profile process restart and the original 48
  journeys plus 12 reporter scenarios. See [workspace evidence](../evidence/issue-139/README.md)
  and [reporter evidence](../evidence/issue-141/README.md).
- Actual subscription Opus high review/recheck at the final material source found
  no remaining findings. These were static reviews; the reviewer ran no tests.
  The complete attributed findings, fixes and limits are recorded on PR142.
- [Exact-source CI38647130355](https://github.com/warblersafety/wilson-next/actions/runs/38647130355)
  and [merged-main CI38647742799](https://github.com/warblersafety/wilson-next/actions/runs/38647742799)
  passed. Successful synthetic checks do not establish live-model reliability,
  Safari/Firefox coverage or real-data privacy readiness.
- Candidate metadata was created after PR142 and targets the exact reviewed
  source. Unsigned HEAD returns 302 to Vercel authentication. Prior successful
  deployment **7078206453**, source `cdb5d6d22324a93cd3d0798ac02af49f4f8e5125`,
  is the [rollback candidate](https://wilson-next-1s21pgdv3-warblersafety.vercel.app);
  its current authenticated accessibility has not been reverified.

Before calling the checkpoint ready, the operator must verify:

1. The exact candidate's project/deployment protection remains enabled, without a
   public exception or project-wide bypass. Existing access controls stay intact.
2. The existing protected origin selected for testing is stable and actually
   resolves to this candidate. Storage is scoped to that origin; changing a
   preview hostname does not transfer cases or reporter defaults. Check existing
   sharing/rollback arrangements without creating a new access exception.
3. An authenticated, no-model `GET /api/case` response reports
   `provenance.release` equal to the **deployment source**
   `5943e609f9515e4684e66d71df9cd18fd20e2f75`, not the different squash-merge SHA.
4. The protected application loads and its no-model continuity surfaces work on
   the chosen origin. Record exact URL, deployment/source, protection observation
   and smoke result on PR142 before handing it to Steve. Do not make paid/live
   application-model calls under this documentation step.

Fresh supported-route check: computer-use inventory exposes no browser; native
macOS reports locked and automatic unlock failed. The supported hidden in-app
browser is unavailable. No installed Vercel CLI/local package, project link,
configured Vercel token or callable Vercel connector was found. This blocks the
remaining authenticated checks. Existing browser sign-in state is unknown until
that browser can be inspected; do not assume that sign-in is either required or
already complete. No browser credentials were read/transferred, authentication
created, software installed or settings/permissions changed. A fresh headless
unsigned session would not establish the existing account's authenticated state.

The handoff remains pending these checks. No production release, external
clinician invitation or relaxation of the synthetic-only boundary is implied.
Broader work stays open, including [serial test correction identity #105](https://github.com/warblersafety/wilson-next/issues/105),
[qualifiers and narrative omissions #115](https://github.com/warblersafety/wilson-next/issues/115),
[PDF representability #128](https://github.com/warblersafety/wilson-next/issues/128)
and [assistive-technology evidence #108](https://github.com/warblersafety/wilson-next/issues/108).
