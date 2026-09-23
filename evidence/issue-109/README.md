# Issue 109 — separate update groups by validated entity

## Cause and bounded remedy

The preserved September 22 failure (operation
`e7c826d0-1caa-47ea-981a-89f8118a122c`) returned 15 proposals, then failed at
`proposals.4.groupReference`: event relevantHistory reused the ibuprofen group
label. The target itself correctly identified Event. The response was rejected
before proposal-local validation; the accepted case remained at revision 5.
One manual retry succeeded historically, but supplies no fix or reliability evidence.

`preserved-model-output.json` is an exact JSON-value copy of `modelOutput` from
local `evidence/ui-draft4-followup-2026-09-22/update-failure.json`. It contains no
prior context or provider thinking. The original input was explicitly not logged.
`tests/fixtures/grouping-failure.ts` supplies clearly labelled reconstructed
fictional wording with five passages; this is deterministic replay of the actual
output, **not** a reconstruction of the original request or another live model run.

Existing-entity update group IDs now derive from an unambiguous tuple of entity
kind, resolved stable ID and model group label. The map for these groups is
separate from newly declared entity groups. This splits cross-entity label reuse
without merging distinct labels within one entity. It changes no fact target,
value, qualifier, intent, evidence or acceptance status. Opening raw-group and
new-entity declaration checks remain; assembled groups are checked again for a
single entity. Unknown entity references, invalid values/sources and capacity
limits retain their existing quarantine behavior. Duplicate identities and
unusable envelopes still fail atomically. No prompt/schema changes or retries.

The narrower choice preserves the model's within-entity review distinctions.
Removing group labels entirely would also change those units; prompt-only repair
would leave this deterministic failure dependent on a future model response.
Neither is needed for this defect. Attribution itself still requires review.

## Verification

Before the code change, all six initial regression cases failed at the preserved
cross-entity check. The same unchanged output now yields 15 proposals in four
separate groups: ibuprofen, event history, and two independent tests.

- Boundary tests compare every value, intent, target field and source reference,
  and test shared labels across patient/event, separate products, existing/new
  tests, distinct within-entity groups, declaration-label collisions, invalid
  entity/source/value quarantine, duplicates and declaration mismatches.
- Production Anthropic adapter replay exercises one requester invocation, without
  a network/model call. Journey tests retain all previously accepted facts while
  pending; require separate medication/history acceptance, then separate test
  acceptance; retain reporter gating; and reject history without accepting it or
  losing medication proposals. Incompatible alternatives remain conflicted after
  acceptance. A duplicate-identity failure retains the exact accepted case and
  stage, with no retry.
- `accepted.pdf` and `pdf-readback.json` are actual output and independent pypdf
  readback after explicit acceptance. Assertions cover both hemoglobin results,
  dates and ranges, ibuprofen stopping date, improvement Yes, and recurrence
  Doesn't apply. History remains explicitly absent in the accepted semantic case.
- Existing tests now obtain application-assigned group IDs from proposals instead
  of assuming a raw model label is the ID. Clinical assertions are unchanged.

214 deterministic tests, typecheck and production build pass. All eight existing
browser journeys passed; the new grouping journey passed separately after its
final click was made to wait for server-confirmed acceptance.
`local-separate-groups.png` shows the separate history and medication review cards
and still-pending tests. The first browser attempt omitted PYPDF_PYTHON and lost
fixture-queue alignment after its PDF readback failed; it was stopped and rerun
with the existing interpreter. These are harness/setup failures, not model calls.
Independent review, required CI and protected-preview verification are recorded
in the PR and below when complete. No comprehensive user walkthrough is requested.

## Scope and limits

Authorized by Steve's September 23 request, governed by DELIVERY.md. This slice
excludes #94 symptom/medication interpretation, #105 conversational test identity,
UI cleanup, form expansion, registration and #99 richer progress. It establishes
a mechanical grouping fix, not overall extraction reliability or a failure rate.
All local uncommitted documents and mockup archives are preserved; roadmap and
handoff remain local and will be updated at delivery. Private backup hashes were
captured before work. No production deployment or real clinical data.

Application-model calls/spend: **0 / USD 0**. Codex token measurements unavailable.
Implementation started approximately 18:55 UTC on September 23; the requested
three-active-hour checkpoint applies if this slice remains unfinished.

## Protected deployed check

The shared `wilson-next-laboratory-fidelity.vercel.app` alias serves candidate
`2bc8385c6641f662f97ddd344410d120716941f3`, deployment
`dpl_zSpFAhE3mGn819gSa8A2NowjRs5T`, created after PR #110. Existing protection and
share expiry (September 27, 21:15:51 UTC) are unchanged. The private access-bearing
URL stays in `/private/tmp/wilson109-share-handoff.json`, outside the repository.
Rollback deployment `dpl_5EEaK8RjUa3MN9GLJHh2NPFNXSSJ` remains available.

`check-preview.mjs` resumed the local regression's pending synthetic case on the
real deployed application, blocked interpretation calls, and performed separate
medication, history and test acceptance. Reporter gating remained; saving the
fictional reporter then generated the real PDF. All 59 populated AcroForm fields
matched the independent local readback exactly. `preview-results.json` records
fresh anonymous share success, unsigned HTTP 302, zero interpretation requests,
and the acceptance/readback results. `preview-separate-groups.png` shows the
pending deployed state; `preview-accepted.pdf` retains the resulting document.
This verifies deployment/access and downstream actions; exact boundary replay is
covered locally and in CI, not by a fresh live model call.
