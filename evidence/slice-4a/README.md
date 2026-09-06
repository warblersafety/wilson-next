# Slice 4A Vercel Hobby deployment-path evidence

**Status:** Gate evidence complete 2026-09-06; pending independent review and
Steve's merge approval

**Issue:** [#28](https://github.com/warblersafety/wilson-next/issues/28)

## Outcome

The cheapest workable path is one distinct `warblersafety/wilson-next` Vercel
Hobby project created through the REST API and deployed from a clean local
commit with transient Vercel CLI 59.11.7. It costs USD 0 within the Hobby plan
and needs no application change, repository dependency, Git connection,
persistence service, custom domain, or paid feature.

Direct import of the public `warblersafety/wilson-next` GitHub repository was
attempted first and failed conclusively with HTTP 400: Vercel requires its
GitHub integration to be installed for the repository. The CLI/API fallback
then built the same application successfully. This selects the reusable
fallback for Slice 4B; it does not authorize that slice.

## Scope and non-claims

The gate checked only project/deployment mechanics, build completion, initial
page delivery, generated static assets, protection, reviewer-access options,
current Hobby terms, and cost. It did not exercise `/api/case`,
`/api/case/pdf`, the seven-state journey, process-local case continuity, or any
Change/Remove control. It made no Anthropic request and installed no Anthropic
or preview application secret.

The evidence therefore makes no claim that the existing multi-request journey
works on Vercel. The process-local `Map` remains intentionally unchanged until
Slice 4B moves disposable continuity to the approved browser boundary.

## Observed deployment evidence

The scoped handoff authenticated account `sditeljan-6063` to team
`warblersafety`, whose API-reported plan was `hobby`. Existing projects
`wilson` and `lucy` were not changed or reused. The fallback created project
`wilson-next` (`prj_mR9VxieMIKKAkP4rw2ly72oPAiBP`) with no Git connection.

Clean commit `32afad15db5c1b69c7d4a0969d91459c09e797d4` on
`codex/28-vercel-hobby-path` supplied the first application build evidence:

- Next.js 16.3.3 compiled successfully and its TypeScript check passed;
- the deployment reached Vercel state `READY`;
- an authenticated `GET /` returned 200, 5,987 bytes, and the Wilson app shell;
- one generated CSS asset returned 200 as `text/css`, 127 bytes; and
- one generated JavaScript asset returned 200 as `application/javascript`,
  16,797 bytes.

Vercel Authentication was already enabled by the team default as
`all_except_custom_domains`. Unauthenticated requests to both the initial and
corrected preview URLs returned 302 before reaching Wilson. Vercel CLI's
documented `vercel curl` command generated one Protection Bypass for Automation
without displaying its value. Steve explicitly authorized three GET-only
checks; the bypass was then revoked in memory, its absence was confirmed, and
unauthenticated access again returned 302.

The first deployment was unexpectedly classified as `production` even though
the empty-project command supplied `--target preview`. It was never shared, was
protected throughout, and was deleted after the evidence above; API retrieval
then returned 404. Repeating the deployment with no target flag produced the
expected preview classification (`target: null`):

- deployment: `dpl_sTJtZbss5q8VsKnE5ZAxbN7RGUUS`;
- URL: `https://wilson-next-kabr9bh7c-warblersafety.vercel.app`;
- source: CLI, with no Git source;
- state: `READY`; and
- source attribution: the same branch and commit above.

That preview remains protected and unshared while Slice 4A is reviewed. No
automation bypass remains configured.

## Node runtime variance

The repository and CI remain pinned to Node.js 24.20.0. Vercel supports only a
major Node selection, recorded project setting `24.x`, and controls minor and
patch updates. Both builds used Node.js 24.19.0 and emitted an `EBADENGINE`
warning against the exact repository pin, but completed successfully. Steve
approved retaining the exact local/CI pin and documenting Vercel's managed
24.x runtime as an experiment-only platform variance. No `package.json` or
application change was made.

## Repeatable administration and deployment

Start from the repository root at the exact clean commit to deploy. Create a
fresh, shortest-practical-expiry Vercel access token scoped to `warblersafety`
and place it through the non-revealing handoff in `docs/EXPERIMENT-1.md`. Never
run `vercel login`, `vercel env pull`, `vercel git connect`, or a production
deployment for this path.

Attempt direct Git import first for a newly recreated project:

```sh
set -a
. /Users/sofa-claude/.config/wilson-next/vercel.env
set +a

curl --silent --show-error --request POST \
  'https://api.vercel.com/v11/projects?slug=warblersafety' \
  --header "Authorization: Bearer $VERCEL_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"name":"wilson-next","framework":"nextjs","gitRepository":{"type":"github","repo":"warblersafety/wilson-next"}}'
```

If and only if that import fails, create the project without a Git connection:

```sh
curl --silent --show-error --request POST \
  'https://api.vercel.com/v11/projects?slug=warblersafety' \
  --header "Authorization: Bearer $VERCEL_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"name":"wilson-next","framework":"nextjs","skipGitConnectDuringLink":true}'
```

Deploy a preview from the clean local commit. Omit `--target`; do not pass
`preview` as an explicit target:

```sh
export VERCEL_TOKEN
WILSON_VERCEL_CONFIG="$(mktemp -d /tmp/wilson-next-vercel.XXXXXX)"
npm exec --yes --package=vercel@59.11.7 -- \
  vercel deploy --yes --project wilson-next --scope warblersafety \
  --no-color --json --global-config "$WILSON_VERCEL_CONFIG"
```

The command creates ignored `.vercel/project.json` link metadata. The temporary
global configuration directory and `.vercel/` never enter Git. Verify the
returned deployment through API metadata before treating it as evidence:
`readyState` is `READY`, `target` is null, `source` is `cli`, and the recorded
commit SHA matches `git rev-parse HEAD`.

`vercel curl` may create a project-wide automation-bypass secret automatically.
Do not use it casually. If a bounded protected check is authorized, constrain
the routes and methods, never display or store the bypass, and revoke it
immediately afterward.

## Hobby terms, cost, and reviewer access

Sources were retrieved 2026-09-06:

- [Vercel Terms of Service](https://vercel.com/legal/terms), last updated
  2026-06-01, permits Hobby only for personal or non-commercial use. This
  synthetic, non-commercial experiment qualifies on the facts Steve approved.
  The terms allow Vercel to change or discontinue Hobby and allow Hobby content
  to be used for model training; only public source and synthetic content may
  therefore enter this preview.
- [Vercel Git documentation](https://vercel.com/docs/git) distinguishes the
  prohibited private organization-repository Hobby path from public
  repositories. The observed public-repository failure was the missing GitHub
  integration, not a paid-plan requirement.
- [Vercel Hobby documentation](https://vercel.com/docs/plans) identifies Hobby
  as free and includes CLI deployment, functions, and generated HTTPS URLs.
- [Deployment Protection](https://vercel.com/docs/deployment-protection) makes
  Vercel Authentication with Standard Protection available on Hobby.
- [Shareable Links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links)
  are available on Hobby, with one link total per account.

The practical non-technical Slice 4B candidate is the protected generated
preview URL plus one revocable Shareable Link. The reviewer opens the link in
an ordinary browser; the link itself is bearer access, so it must not be posted
publicly and must be revoked after the session. This avoids a paid password-
protection feature. Slice 4B must test that access path before installing an
Anthropic secret or sharing the preview. If it proves impractical, the already
approved minimal application-level lock remains the fallback.

No plan upgrade, trial, add-on, domain, usage purchase, or payment-method change
occurred. Recorded Slice 4A cost is USD 0.

## Credential and cleanup record

- `.vercel/`, `.env*`, and equivalent local secret material are ignored.
- The local handoff directory was mode `0700`; `vercel.env` was mode `0600`.
- Checks reported only credential presence, account identity, team access, and
  plan; no credential value appeared in output or repository files.
- Vercel CLI was invoked with the sourced token and temporary global config;
  no persistent `vercel login` occurred.
- The temporary automation bypass was revoked and verified absent.
- The accidental first deployment was deleted and cannot be restored through
  Instant Rollback.
- The protected preview above remains for review. Remove it when the approved
  review window ends unless continued access is separately approved.
- Remove the local handoff file after final Vercel administration and record
  only that token revocation or shortest-expiry confirmation passed.
