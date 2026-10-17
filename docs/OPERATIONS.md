# Protected preview and host procedures

This guide owns non-secret procedures, not new access, credentials, purchases,
participation or live-call authority. [Delivery](DELIVERY.md) owns standing limits
and narrower task precedence; [Architecture](ARCHITECTURE.md#data-deployment-and-diagnostics)
owns fail-closed runtime/data contracts. Use existing installed tools and inspect
current help rather than guessing command syntax. Never print secrets or auth caches.

## Protected preview and provenance

The preview is fictional-data-only and not a production release. Keep Vercel
Authentication, fork protection and the fail-closed application gate. Verify the
exact deployment's metadata/system-variable exposure and protection before an
approved live call; metadata is not authentication and a successful build does
not establish provider-key validity or semantic reliability. Do not pull hosted
secrets or add a public exception/project-wide bypass. No paid plan is authorized.
Vercel chooses the Node major's patch release; the repository/CI exact pin remains.

An automatic branch preview can predate its PR and fail the app's PR-metadata gate.
After opening the draft PR, push the next meaningful commit; if already complete,
Delivery permits one explicitly labelled empty deployment-trigger commit. Verify
post-PR deployment provenance rather than relaxing the gate. Main Git deployments
remain disabled; retaining one protected unshared preview avoids Vercel's empty-project
first-deployment production bootstrap. It does not grant reviewer access.

The approved shared synthetic link follows meaningful verified candidates, with
previous working deployment retained for rollback. Moving an existing single-share
grant between approved candidates is covered by Delivery, not permission to create
public access or buy a plan. An issue-scoped Shareable Link must name purpose,
exact deployment, synthetic data/call limits, secret handling and platform expiry.
Never publish bearer URLs in Git/chat evidence. Remove access at the end of its
approved window unless continued access is authorized; expired grants are not
silently renewed. Check actual accessibility, do not recycle an old checkpoint URL.

Verify authenticated `GET /api/case` release/state-version provenance against the
served branch commit (which can differ from its squash-merge SHA), plus repository,
immutable deployment ID, Preview/non-main/PR metadata and protection. A fixed
protected origin matters: changing hostname changes browser storage. Test actual
same-origin save/restart/handoff and compatible upgrade/rollback before claiming
continuity. Keep older incompatible records for a compatible release; no silent
clearing or migration inference. A rollback deployment's existence alone is not
saved-work compatibility evidence. [Coverage](COVERAGE.md) retains acceptance limits.

## GitHub broker

Use the existing absolute executable with `CODEX_GITHUB_APP_ID=4665307`, account
`warblersafety`, repository `wilson-next` and a stable task session. Inspect help:

```sh
/Users/sofa-claude/.local/libexec/github-app-broker --help
```

Choose the named read/delivery envelope and operation, exact branch for branch-push,
and supported payload location. Never use inherited GitHub tokens, copy credentials,
change authentication, bypass protection or expand grants. Use body files for
multiline issue/PR/review records. Reconcile uncertain write outcomes before retry.
The canonical guarded merge is:

```sh
gh pr merge NUMBER --repo warblersafety/wilson-next --squash --delete-branch --match-head-commit SHA
```

Run it through the scoped broker after required exact-head review/CI and resolved
conversations. Compare complete reviewed/merged trees, confirm branch disposition
and main CI; a different squash commit ID alone is expected, not tree equivalence.

## Subscription review

Steve's user-level allow rule covers the fixed installed `wilson-review` review,
recheck and check operations. Invoke its absolute executable directly so the rule
matches; do not wrap it in a shell/Python launcher or bypass clean-checkout checks.

```sh
/Users/sofa-claude/.local/libexec/wilson-review check
/Users/sofa-claude/.local/libexec/wilson-review review --issue NUMBER
/Users/sofa-claude/.local/libexec/wilson-review recheck --run RUN_ID
```

`check` is model-free preflight. The fixed runner accepts committed tracked files
from the original Wilson checkout and read-only issue context, copies a bounded
payload excluding credentials/config paths/symlinks, removes inherited write
credentials, and gives subscription Claude Opus high only scoped Read access.
No arbitrary prompt/provider/model/repository override. Keep local configuration
outside the repo; the user rule supplements process authority, not general sandbox
settings. Rule changes require app reload, not permission bypass.

Before every review, `claude auth status` must report claude.ai/active subscription
and ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL must be unset.
Record only preflight success. Do not run in the application-credential tmux shell.
No paid API/gateway/provider fallback. Do not impose token/turn/time/budget ceilings,
wrap in timeout, retry automatically or silently multiply reviewers. [Delivery](DELIVERY.md#claude-review)
preserves the exact review directive, source/diff scope, records and proportionate
recheck/expanded-review rules; this guide changes none of them.

## Application-model operation and credentials

CI, ordinary builds/deterministic tests and subscription review make no paid
application-model call. Delivery's default autonomous experiment allowance is
separate from operator-initiated runtime use; narrower task/issue caps win.
The completed Slice3 four-sample gate does not cap later authorized runtime use.
For operator-initiated Wilson operation, provider-default adaptive thinking/effort
and full provider-supported output capacity are default: no Wilson-imposed token,
thinking-token, cost, sample, turn or wall-clock ceiling. Steve chooses the practical
runtime budget and may explicitly supply supported effort/output settings. Quality
is primary; measure extraction/correction effects before reducing them. Disable
automatic retries; record exposed model/parameters/prompt/schema/tokens/latency/cost.
Human external scoring checks material facts/relationships and sources; no fixed
answer rejection path. Comparative model/effort experiments require their own
scope/budget authorization and never follow automatically from failure. Severe
invented, lost, wrong-entity or unsupported material facts stop affected expansion.
A passed sample establishes no general reliability rate.

The existing Mini-local model credential is in sofa-claude's login keychain via
namespace `wilson-next` / variable ANTHROPIC_API_KEY and per-user envchain. It is
Wilson Next-only, not review authentication or a credential for legacy Wilson.
Only the named persistent tmux session receives it; never ordinary dev shells or
another machine. The non-secret route is tmux socket/session `wilson-next`, pane
`wilson-next:0.0`. An authorized interactive Mini terminal can establish it with:

```sh
envchain wilson-next tmux -L wilson-next new-session -d -s wilson-next \
  -c /Users/sofa-claude/code/warblersafety/wilson-next
```

First check existing sessions; inside that pane check presence only, never raw
values. Headless execution cannot unlock this file-based keychain. If recovery
is needed, the interactive account unlocks its login keychain using a hidden
password prompt; intentional key rotation/removal is handled through envchain's
hidden input, not chat. The named process loses credentials on tmux exit/reboot.
Do not use sudo, change /opt/homebrew ownership, print environments, inspect tmux
environment, reveal envchain values or enable shell tracing. This documentation
is not authorization for credential rotation/recovery or new grants in a task
that excludes them.

Vercel administration uses the separate bounded non-ambient handoff file
`/Users/sofa-claude/.config/wilson-next/vercel.env`, directory owner-only/file0600,
never repository `.env` or persistent login. The original handoff uses a new
short-lived token (one day by default), team-scoped where adequate; broader scope
needs explicit approval after narrower failure. Steve enters the value privately,
not in chat. Source only for authorized CLI/REST operations, no tracing/environment
printing. After the authorized session remove the handoff and verify revocation
or expiry; prior access alone does not pass lifecycle verification. Do not reuse
a legacy or expired token or create new credentials if task scope forbids it.

Runtime secrets are installed directly through Vercel's secret interface; check
names/presence only, never retrieve values or `vercel env pull`. Keep `.vercel/`,
local credential files and project-link metadata uncommitted. Local application
keys never enter deployed/review environments or logs. Real clinical data remains
unapproved. [Architecture](ARCHITECTURE.md#data-deployment-and-diagnostics) specifies
the narrow synthetic diagnostics exception, immediate inspection and one-hour
retention; do not export raw runtime logs or create another diagnostic store.

## Local archive and historical guidance

Pre-consolidation tracked documentation originals are preserved, with repository-relative
paths, baseline provenance, sizes and verified SHA-256, at:

```text
/Users/sofa-claude/code/warblersafety/wilson-local-archive/2026-10-17-documentation-cleanup/
```

Use its manifest/restore instructions; verify hashes and compare newer files
before restoring. The existing housekeeping bundle/private originals are separate
and untouched. Never upload the archive wholesale. It is same-disk local storage,
not a verified off-device backup. Essential current contracts and meaningful
reproducible evidence remain in Git. [Evidence navigation](../evidence/README.md)
links removed tracked documents in their original pinned Git context, so another
clone does not depend on this machine. Historical imperatives apply only to their
original scope/time; current guides and explicit user instructions govern now.
