# Issue 30 Git-backed Vercel preview evidence

**Status:** Git delivery evidence complete 2026-09-06; bounded review
remediation pending final commit and merge approval

**Issue:** [#30](https://github.com/warblersafety/wilson-next/issues/30)

## Outcome

The existing `warblersafety/wilson-next` Vercel Hobby project is linked only to
the matching public GitHub repository. A push to the Issue #30 feature branch
created a protected Git-sourced preview at the exact pushed commit. The
repository's `vercel.json` disables automatic Git deployment from `main` while
leaving unspecified feature branches enabled.

This is a Vercel branch-deployment rule stored in the repository. It does not
change or make a claim about GitHub branch-protection rules, which remain
governed by `docs/DELIVERY.md`.

## Project configuration

The Vercel API reported:

- project `wilson-next` was linked to GitHub organization `warblersafety` and
  repository `wilson-next`;
- `main` remained the named production branch;
- preview deployments were enabled;
- fork protection and pull-request comments were enabled, while per-commit
  comments were disabled;
- Vercel Authentication applied to generated deployment URLs;
- zero protection bypasses were configured; and
- no project-level deployment policy was enabled.

The project had only its Vercel-generated `wilson-next-six.vercel.app` alias,
which returned 404 because no current production deployment was assigned. No
custom user domain was added.

An attempt to express the branch distinction through Vercel's centralized
`deploymentPolicy` API returned HTTP 403 with code `pro_plan_required` and the
message that deployment policies require Pro or Enterprise. The project was
unchanged. No trial, upgrade, add-on, domain, or payment change occurred.

## Git preview proof

Pushing configuration commit
`ad26c3242c3f12a384811ba3e537d853ffc395ca` on
`codex/30-vercel-git-previews` produced:

- deployment `dpl_8UQmFqJtJibi4SyzZLKd1NRdGh2a`;
- URL `https://wilson-next-h7j2ey3rh-warblersafety.vercel.app`;
- state `READY`;
- source `git`;
- target `null`, the Vercel preview classification; and
- matching GitHub organization, repository, branch, and full commit SHA.

An unauthenticated `GET /` returned 302 to Vercel Authentication. No protection
bypass was created to inspect application content. This evidence establishes
deployment mechanics and protection only; it does not claim that the current
multi-request case journey works on Vercel.

## Repository and application checks

- `jq` confirmed that `vercel.json` contains only the schema reference and
  `git.deploymentEnabled.main: false`.
- `npm run typecheck` passed.
- `PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test` passed 55 tests.
- `npm run build` passed.
- `npm run test:e2e` passed the one fixed Chromium journey.

The first unconfigured local test invocation used ambient `python3`, which did
not contain `pypdf`; the CI-equivalent configured interpreter passed. The first
sandboxed browser invocation could not bind its local port; the authorized
local rerun passed. Neither failure concerned the deployment configuration.

## Limitation and credential record

The `main` exclusion cannot be observed without merging the file to `main`.
That merge remains Steve's decision. Vercel evaluates `vercel.json` from the
pushed commit, so the merge commit will contain its own exclusion; manual or
CLI production promotion remains technically possible and still requires
separate authorization.

The short-lived administration token was read only from the owner-only local
handoff. No value appeared in command output or repository files, and no
persistent Vercel login was created. Steve directed that this token and its
handoff file not be deleted or revoked; they remain outside the repository to
expire naturally.
