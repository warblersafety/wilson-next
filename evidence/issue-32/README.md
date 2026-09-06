# Issue 32 deployed observability evidence

**Status:** In progress; protected-preview correction and runtime diagnosis
pending

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

## Pending evidence

- Exact corrected preview deployment and commit.
- Protection and production-alias checks after cleanup.
- First-action reproduction and Runtime Log diagnosis.
- Focused defect evidence if an ordinary local defect is found.
- Final automated verification and independent review.
