# Wilson synthetic testing checkpoint — Steve

**Status: verified for Steve’s bounded synthetic testing — 15 October 2026.**

Reviewed application source: `5943e609f9515e4684e66d71df9cd18fd20e2f75`
([PR142](https://github.com/warblersafety/wilson-next/pull/142)), tree-equivalent
to merged main `dc7cd047028cb95984a81b5552fe6ab014b74a11`.
Deployment **7078695904** reports success for that exact source. Its immutable
candidate URL is [the protected preview](https://wilson-next-80bolwbb0-warblersafety.vercel.app).
The fixed test origin is the existing
[protected candidate alias](https://wilson-next-git-codex-141-reusable-reporter-warblersafety.vercel.app),
verified to map to that deployment. Use the private Shareable Link supplied
separately; bare URLs correctly require Vercel authentication. The single
operator-approved alias grant expires **22 October 2026 at02:17:33 UTC**.
It remains pinned to this source for the test window; do not forward its bearer
URL or place it in public feedback. It is absent from this repository.

Use only fictional clinical and reporter/contact information. This is a bounded
save/resume and reporter-reuse checkpoint, not complete Form3500 coverage or
approval for real reports. Existing protection remains in force.

## A short clinician-oriented pass

1. Start with a fictional medication event in your own words. Review proposed
   details; correct one value, explicitly accept the right groups and answer applicable
   clinical follow-ups. Check that
   the workflow preserves what you meant and distinguishes unknown/declined
   information from a negative answer. If the first interpretation request
   fails, stop and record its diagnostic reference as a deployment-readiness
   problem; do not repeatedly submit it or count it as clinical product feedback.
2. Leave unfinished text in a clinical update, a field editor and the Reporter
   form. Wait for “Saved in this browser”, close the browser, reopen the exact
   same site/profile. Check your accepted facts, pending review, full submitted
   wording, unsent words and visible workflow step. No input should be submitted
   again automatically.
3. Open a second tab at the same site. It should explain that the first tab owns
   editing; close the owner and explicitly retry the second. Confirm continuity.
4. Enter fictional reporter identity/contact/professional details and remember
   them. Choose a fictional report date different from today, a prior-reporting
   destination and a disclosure
   choice. Save the reporter details to this report separately. Check the PDF
   against the accepted case, including reporter details and date; Wilson never
   submits it to FDA.
5. Start a new case after reading its loss confirmation. Describe and review a
   second fictional case before opening Reporter details. Reporter identity and
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

## Completed evidence and checkpoint checks

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
  The complete attributed findings, fixes and limits are recorded in
  [the PR142 targeted recheck](https://github.com/warblersafety/wilson-next/pull/142#issuecomment-6179846585)
  and [delivery closure](https://github.com/warblersafety/wilson-next/pull/142#issuecomment-6179987711).
- [Exact-source CI38647130355](https://github.com/warblersafety/wilson-next/actions/runs/38647130355)
  and [merged-main CI38647742799](https://github.com/warblersafety/wilson-next/actions/runs/38647742799)
  passed. Successful synthetic checks do not establish live-model reliability,
  Safari/Firefox coverage or real-data privacy readiness.
- Candidate metadata was created after PR142 and targets the exact reviewed
  source. Unsigned HEAD returns 302 to Vercel authentication. Prior successful
  deployment **7078206453**, source `cdb5d6d22324a93cd3d0798ac02af49f4f8e5125`,
  is the [rollback candidate](https://wilson-next-1s21pgdv3-warblersafety.vercel.app);
  its current authenticated accessibility has not been reverified.

The [hosted verification record](../evidence/issue-143/README.md) and
[results](../evidence/issue-143/hosted-result.json) close the five checkpoint gates:

1. Project Vercel Authentication and fork protection are unchanged; no
   project-wide bypass or public exception was added. Exactly one approved,
   seven-day candidate-alias grant exists. Bare candidate and rollback URLs
   still redirect to authentication.
2. The existing fixed candidate alias maps to the exact reviewed deployment.
   Real browser-process restarts on this same origin preserved work. Rollback
   alias/source mapping is verified; no rollback was performed or saved-work
   compatibility with that older application claimed.
3. Authenticated `GET /api/case` returned HTTP200 and runtime
   `provenance.release` exactly `5943e609f9515e4684e66d71df9cd18fd20e2f75`,
   with state versionv10. The expected source is the deployed branch commit,
   not its different squash-merge or later documentation SHA.
4. Hosted synthetic checks passed for raw drafts, accepted state, screen,
   browser restart, tab handoff, reporter remember/forget/reuse and fresh-case
   choice isolation. The actual UI PDF passed independent readback. No
   interpretation request was attempted or allowed through by the test guard.
5. Deployment metadata matches the expected repository/immutable ID, non-main
   branch, Preview environment and PR142. System exposure and provider-variable
   presence are verified without reading secret values. This does not prove
   provider-key validity or live interpretation reliability; no paid live model
   smoke call was made.

The working administration mechanism is the existing bounded Vercel REST/CLI
[handoff](EXPERIMENT-1.md#vercel-deployment-credential-handoff), not desktop
unlock. Earlier native-automation lock errors were not independent proof of OS
lock. Hosted browser checks used the approved URL-scoped grant with installed
headless Chromium; no browser credentials were transferred or admin login
persisted. The private link and grant are not reproduced here.

The originating code review/local/CI gates remain linked above. This publication
records the hosted checks on [issue143](https://github.com/warblersafety/wilson-next/issues/143).
After the grant expires, obtain specifically authorized valid access; do not
reuse an expired grant or silently renew it. No production release, external
clinician participation or real-data authorization is implied.

One cosmetic follow-up from the workspace review remains: a legacy tab can show
an earlier-work notice after importing the same case. It does not lose data and
is unlikely on a fresh origin; see [the PR140 review record](https://github.com/warblersafety/wilson-next/pull/140#issuecomment-6179349318).

Broader work stays open, including [serial test correction identity #105](https://github.com/warblersafety/wilson-next/issues/105),
[qualifiers and narrative omissions #115](https://github.com/warblersafety/wilson-next/issues/115),
[PDF representability #128](https://github.com/warblersafety/wilson-next/issues/128)
and [assistive-technology evidence #108](https://github.com/warblersafety/wilson-next/issues/108).
