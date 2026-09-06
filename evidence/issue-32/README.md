# Issue 32 deployed observability evidence

**Status:** Implementation and protected-preview verification complete;
independent review pending

**Issue:** [#32](https://github.com/warblersafety/wilson-next/issues/32)

## Scope and retention

Issue #32 makes the fixed synthetic journey reconstructable from protected
Vercel Runtime Logs. Complete relevant synthetic diagnostic content may appear
there for Hobby's one-hour retention, but credentials and non-fixture content
may not. Runtime Logs are inspected in place and are not copied into this
artifact or another diagnostic store.

The issue does not add browser-held case continuity, hosted persistence, a live
model, production behavior, or Slice 4B work.

## Verification before deployment

At implementation commit `36dc0e7851b84ddadd0c6cccf199e714834e741d`:

- the focused diagnostics tests passed;
- `npm run typecheck` passed;
- all 62 unit tests passed with the CI-equivalent pypdf interpreter;
- `npm run build` passed;
- the fixed Playwright journey passed; and
- GitHub `verify` passed.

The first sandboxed Playwright invocation could not bind local port 3100. The
approved local rerun passed; this was unrelated to the application change.

## Stop-and-reconcile deployment finding

The first Git push produced Vercel deployment
`dpl_714FeiSjZD2gjHfFCU4JBCajckxX` at the exact commit above. Expected was a
protected feature-branch preview with `target: null`. Vercel instead reported:

- source `git` and the correct repository, branch, pull request, and SHA;
- `target: production` and `readySubstate: PROMOTED`;
- production OIDC claims; and
- the project production aliases assigned.

Read-only project inspection still showed the Git link's production branch as
`main`, Vercel Authentication as `all_except_custom_domains`, no protection
bypass, and the Hobby plan. It also showed that this was the project's only
remaining deployment; the final PR #31 preview returned 404. Vercel documents
that the first deployment of an empty project is marked production. The
repository rule prevents automatic deployment from `main`, but it does not
override that empty-project bootstrap behavior.

No application route was invoked after the unexpected classification. No
live-model call, paid feature, bypass, project-setting change, or credential
disclosure occurred. The finding was recorded on Issue #32 and draft PR #33,
and work paused. Steve authorized removal of the accidental production
deployment and the minimum correction needed to restore protected previews.

The bounded recovery is to create the next meaningful Issue #32 commit through
Git while a deployment target exists, verify that Vercel classifies it as a
protected preview with no production aliases, and only then remove the
accidental production deployment. The protected issue preview must remain for
the approved review window; deleting every deployment would recreate the empty-
project bootstrap condition.

## Corrected protected preview

The recovery produced preview deployment
`dpl_EQXcDK7r39B75VFk9TRACPtPPyji` from Git commit
`5b14c0548e73b97da5911074bd0987a48cb52bfc`. Vercel reported the feature
branch `codex/32-runtime-diagnostics`, `target: null`, `READY`, `STAGED`, and
only the branch preview alias. The accidental production deployment was then
removed under Steve's approval. A subsequent read found no production target,
and the replacement preview remains protected by the project's Vercel
Authentication setting.

## First-action reproduction and Runtime Log finding

Three fresh Chromium contexts opened the protected branch preview and selected
**Review Wilson's understanding** using only the fixed synthetic account. Each
initial page and opening action returned HTTP 200 and reached the
`understanding` state. The previously reported first-action failure therefore
did not reproduce at the current commit; no speculative application fix was
made.

The first bounded Runtime Log stream captured run
`067c1840-0937-459c-b0ea-830dd3e96cdc`. Correlated entries exposed the browser
request and response, route handling, fixed model request and response,
schema/domain acceptance, case commands, resulting case state, state
transition, and response body. The complete model proposal, sources, product
roles, field values, and final synthetic case state were inspectable in Vercel
and were not copied into this artifact.

The emitted sequence numbers also exposed a delivery limitation: even after a
35-second collection window, Vercel's live deployment stream omitted several
individual `console.log` entries without setting `messageTruncated`. The
successful action was still understandable from the remaining entries, but an
omitted early-failure entry could defeat the issue's stronger reconstruction
requirement. The bounded correction keeps the immediate phase events and adds
one final, in-request checkpoint containing every already-sanitized event for a
completed case-route operation. This is transient function memory followed by
one Runtime Log call, not another store. An early crash still leaves the
immediate events that preceded it.

Commit `f0d4e49d616b29d736cb88bffc0b0733a96279f0` deployed through Git as
`dpl_EKeAYi9pKz32hXZEmx99gMq6CE2Z`. Vercel reported the exact Git SHA and
feature branch, `target: null`, `READY`, `STAGED`, and the protected branch
alias. An unauthenticated request returned HTTP 302.

The final deployed Chromium run was
`ef94f6a8-1e94-4a78-9fbb-bcd4bff21833`; its opening operation was
`ae98e534-4d04-46a3-8ed4-3ee10adf8502`. The page and opening action returned
HTTP 200 and reached `understanding` at revision 2. Vercel delivered the
operation's checkpoint without truncation at 109,227 bytes. It contained all
14 preceding events with contiguous sequence numbers and the full relevant
fixed synthetic input and output for route validation, model request and
response, proposal validation, both case commands and resulting state,
transitions, and final response.

Newly generated automation bypasses were not consistently usable after a fixed
delay. The final procedure therefore polled a protected GET until it actually
returned Wilson before opening Chromium; the deployment remained protected
throughout. Attempts that stopped at Vercel's access page did not invoke an
application route and were not treated as application failures.

For each browser run, an automation bypass was generated only long enough to
drive the protected preview and revoked immediately afterward. Read-only
project checks found zero bypasses before and after. Exact-value scans of the
captured stream found neither the Vercel access token nor the generated bypass.
No credential value was printed, retained, committed, or copied into evidence.

## Pending evidence

- GitHub `verify` for the final branch head.
- Independent review of the final material diff.
