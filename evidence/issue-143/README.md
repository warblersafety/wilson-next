# Hosted continuity checkpoint — 15 October 2026

Application source `5943e609f9515e4684e66d71df9cd18fd20e2f75`, provider deployment
`dpl_BjSQCQga75zhEcSXyP4YWynjjemk` (GitHub deployment7078695904), Preview/READY,
PR142. The existing fixed test origin is
`https://wilson-next-git-codex-141-reusable-reporter-warblersafety.vercel.app`.
The bare URL remains protected; the approved private Shareable Link is delivered
separately and is deliberately absent from repository files and logs.

## Access and platform checks

Steve approved one candidate-alias Shareable Link for seven days in the private
operator conversation on 15 October 2026: “Yes create the link for 7 days not
24 hours”. [The owning issue records that approval, recipients and call limits](https://github.com/warblersafety/wilson-next/issues/143#issuecomment-6183131222),
superseding its earlier unexecuted 24-hour proposal. The approved grant uses
`ttl:604800`. Exactly one was created, then reconciled by GET. Vercel calls its
expiry field `expires`; the first reconciliation expected `expiresAt`, so it
stopped before using the grant. A subsequent **GET-only** reconciliation verified
expiry **2026-10-22 02:17:33 UTC**. No creation request was repeated.

Before and after testing: the alias still mapped to the exact source/deployment;
project Authentication remained `all_except_custom_domains`, fork protection
remained enabled, project-wide bypass count stayed zero and alias grant count
was one. Unsigned HEAD requests to the candidate alias, immutable deployment URL
and rollback alias still returned302 to Vercel authentication. Secret-scanning
the local test logs/artifacts found no bearer leakage. Admin credentials were
used only by bounded API request processes through the existing documented
handoff, never copied to the browser or repository.

GitHub integration metadata matched warblersafety/wilson-next and immutable
repository1357402525, non-main branch codex/141-reusable-reporter and PR142.
System environment exposure was enabled, and required Git/system variable names
and the preview provider variable were present. Provider secret values were not
retrieved/displayed. No live model request was attempted or allowed through.

Rollback metadata: READY Preview `dpl_GE1UfYt7sCRZ5z6tYBnvHxBuFFZp`, source
`cdb5d6d22324a93cd3d0798ac02af49f4f8e5125`, existing codex/139 branch alias maps
to it. Its authenticated application and saved-work compatibility were not
exercised. No traffic/alias retarget or rollback occurred.

## Hosted synthetic evidence

[hosted-result.json](hosted-result.json) records the successful run, completed
2026-10-15T02:36:07.037Z under exact Node24.20.0 and installed Chromium, one
hosted journey **PASS in7.8seconds**:

- Authenticated `GET /api/case`: HTTP200, `provenance.release` exactly5943e60,
  state version `wilson-browser-state-v10`.
- Real browser-process shutdown/relaunch of the same temporary profile/origin:
  opening/report selection, then accepted case, current Reporter screen and
  independent unfinished reporter/update text retained. No actions replayed.
- Remembered fictional identity/professional defaults exclude report date,
  destinations and disclosure; remembering accepts no case facts.
- Explicit reporter acceptance, actual UI PDF download **1,051,426bytes** with
  `%PDF-` signature, independent pypdf readback confirms fictional name/email.
- Second tab excluded, owner closes, waiting tab explicitly retries and resumes.
- Forget cancel/confirm leaves current draft and accepted case unchanged.
- New case reuses remembered defaults in its editable draft, resets case-specific
  choices and accepts no reporter facts implicitly.

Interpretation requests were guarded before every browser navigation and after
both restarts. Only resume and explicitly allowlisted direct case actions were
permitted; submit-opening/update and other unexpected POST actions abort and
fail the run. There were **zero interpretation attempts**; no paid live model
calls, real data or application source/configuration changes. Temporary browser
profiles were removed. These are functional synthetic checks, not timing SLO,
interpretation reliability, complete Form3500 or real-data readiness evidence.

## Harness corrections and reproducibility

The first fixture POST used a request client without an Origin header and got
HTTP403. The harness now uses an actual same-origin browser fetch, satisfying
rather than weakening the application's Origin boundary. Its expected200 and
case assertions remain. The network-response PDF body observation returned zero
bytes while the actual UI download was valid. The same signature/content checks
and independent readback now use that real user-facing artifact, matching the
existing browser-test Save PDF approach. Both observations remain recorded; no
product patch or timeout/assertion weakening was used.

The opt-in [test](check-hosted.spec.ts) and [configuration](playwright.config.ts)
reproduce the hosted journey with an existing approved owner-only private JSON
handoff. They never load admin credentials or create/renew grants. Supply its
path via `WILSON_PREVIEW_HANDOFF_PATH`, and optionally a private output directory
via `WILSON_HOSTED_EVIDENCE_DIR` and existing `PYPDF_PYTHON`. Run the installed
Playwright CLI with this explicit configuration. Do not run after expiry or
against a different source/origin; the harness rejects those conditions. Traces,
video and automatic screenshots are disabled. Authentication is bootstrapped
through the same disposable context’s request client; pages navigate only to the
clean origin, so browser failure snapshots cannot capture the bearer URL. The
normal local/CI suite does not automatically run this live-hosted test.

The original application gates remain 336unit tests/44files,60mock Chromium
journeys, typecheck/build and successful exact-source/merged-main CI from PR142.
This evidence adds deployed functional checks; it does not rerun or replace
those gates. Independent review and protected publication of this evidence still
follow Delivery. The private grant must expire automatically; no renewal or
external invitation is implied.

## Independent-review limits and follow-ups

The candidate alias is fixed for this seven-day test window, not a durable
cross-release storage address. Browser data does not transfer to another
candidate/rollback hostname. Before later promotion, decide on one protected
shared origin and verify same-origin upgrade/rollback continuity; neither is
claimed here. Keep this approved alias pinned during its grant.

Administration-token expiry and end-of-session disposal have **not** been
verified. The existing owner-only handoff worked, but that does not establish
conformance with the short-lived-token/session-cleanup requirements in
[Experiment 1](../../docs/EXPERIMENT-1.md#vercel-deployment-credential-handoff).
No token was created, revoked or deleted in this evidence slice; the current
no-auth-change scope leaves cleanup/expiry confirmation to the operator. Do not
report this as a passed credential-lifecycle check or reuse it in another session
without resolving that requirement. This does not change the verified preview
grant expiry or application authentication.
