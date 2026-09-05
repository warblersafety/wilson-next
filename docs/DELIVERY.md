# Wilson delivery and independent review

**Status:** Approved by Steve; consolidated and amended 2026-09-05

**Owns:** Work items, branches, pull requests, verification, independent review,
approval, merge controls, stop-and-reconcile, and durable trace

## Purpose

Preserve useful implementation history and independent challenge without
recreating the process weight that obscured legacy Wilson's assembled product.
Every meaningful change is isolated, checked, independently reviewed when
needed, and approved by Steve before merge. Durable product or technical
decisions live in their single owning active document.

## Unit of work

Create one issue for each meaningful implementation slice, defect, or
consequential decision. It names the outcome, included/excluded scope, governing
documents, minimum acceptance evidence, and stopping conditions. Small fixes
found within the slice stay there; later regressions or independently valuable
work get separate issues.

Experiment 1 may have one lightweight tracker, but needs no project board,
milestone hierarchy, or issue taxonomy.

## Branch and pull request

Branch from current `main` as:

```text
codex/<issue-number>-<short-description>
```

Use one short-lived branch per coherent issue. Do not create long-running
development or experiment branches. Open a draft pull request after the first
meaningful commit. The PR records:

- plain-English outcome and linked issue;
- included and excluded scope;
- important implementation choices;
- exact automated and manual evidence;
- required screenshots, traces, model samples, or PDFs;
- deviations, stop-and-reconcile decisions, and unresolved risk; and
- the exact decision requested from Steve.

Update it at meaningful boundaries, not with routine terminal narration.
Successful branches are deleted after squash merge. If an experiment falsifies
its premise, close without merging and retain a named branch or commit until its
disposition is decided.

## Verification and review flow

Before a PR is ready:

1. The implementer reviews the complete diff against the issue and owning
   documents.
2. The narrow checks required by the slice pass.
3. A fresh-context technical reviewer who did not implement the change inspects
   the complete change and evidence when this document requires a new review.
4. Blocking findings are fixed or explicitly resolved. Follow-ups become issues
   only when independently worth doing.
5. The PR presents Steve with a concise acceptance summary and remaining risk.

Review checks code correctness and whether implementation hides a bad premise;
local conformance is not enough. It runs against the exact final material
change. Steve's required GitHub approval is merge authorization: the delivered
scope, evidence, review disposition, and risk are acceptable. It does not
require Steve to perform a line-by-line technical audit.

New material commits after approval require review of the latest change and a
renewed approval before merge.

### Proportional closure without recursive model runs

Independent review is required for implementation and new material product or
technical premises, not automatically for every edit to instructions. An
originating independent review may cover its bounded remediation, and an
editorial consolidation may rely on its approved source decisions, when the PR:

- links the attributed review or source approvals;
- maps findings or source authority to the final diff;
- introduces no unapproved behavior, semantics, architecture, privacy, scope,
  evidence, or process premise;
- passes an implementer audit and its narrow checks; and
- receives Steve's explicit approval of the final result.

No new Claude run is required merely to confirm its own dispositions or to
restate approved decisions more coherently. A change beyond those bounds needs
fresh independent review. Steve may request another review at any time.

## Claude review

When Codex implements or coordinates a substantive change requiring a new
review, Claude is the default fresh-context reviewer. Substitution requires
Steve's agreement. Claude cannot edit, post to GitHub, approve, or merge.

### Standard review

Use the current Claude Sonnet model at `high` effort after implementation and
narrow evidence are complete. Record the canonical model ID and CLI version.
Review the full `main...HEAD` diff, not only the latest commit.

Before every run, confirm `claude auth status` reports `claude.ai` and Steve's
active subscription, while `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and
`ANTHROPIC_BASE_URL` are unset. Stop on failure; never fall back to a paid API,
gateway, or alternate provider. Record only that the preflight passed.

Do not impose budget, token, turn, or wall-clock ceilings. An authorized run
continues until verdict or genuine tool, authentication, or service failure. Do
not pass `--max-budget-usd`, wrap the run in a timeout, retry automatically, or
silently multiply reviewers.

Give the reviewer the issue, scope, owning documents, exact commit and complete
diff, surrounding code, and required evidence. Use a fresh session and do not
prime its first pass with implementer conclusions or earlier findings. Enforce
read-only repository/Git access with no write credentials or permission bypass.

The standard `wilson-review-v1` directive is:

> Review this exact Wilson change and find material reasons it should not
> merge. Inspect the complete diff, issue, governing artifacts, relevant
> surrounding code, and acceptance evidence. Check correctness, missing
> behavior, regression risk, and whether the implementation hides a faulty
> requirement or architectural premise. Do not edit anything. Report only
> BLOCKING findings and independently valuable FOLLOW-UP findings, with
> evidence and precise locations. State what you inspected and ran, material
> limitations, and explicitly say when no findings remain.

`wilson-review-v1` binds to that text at the prompt-source commit. Neutral target
metadata and output formatting may be added; changing criteria or adding
suspected-defect hints requires a new label. Style preferences, ceremony, and
speculative enhancements are not findings.

### Additional and expanded review

No additional Claude run occurs without Steve's explicit permission. A request
states why existing review/disposition is insufficient, target commit, targeted
or complete scope, model, and effort. Use a targeted check for a narrow local
fix. Repeat a complete review only when the response materially changes
behavior, contracts, architecture, privacy, scope, evidence, or another owning
premise.

Expanded review is exceptional and also requires explicit permission. Use it
for multiple distinct consequential risks such as security/privacy, durable
data migration, model semantics, consequential workflow, clinical/output
accuracy, broad architecture, or the integrated pre-physician checkpoint. It
may use Claude Opus at `high` or `xhigh`; Opus `xhigh` is the maximum. Do not use
Opus `max`, Fable, or a model/effort outside these bounds. Multiple reviewers,
agents, or fresh passes require separate permission and risk-specific roles.

Before the first physician session, integrated review—if separately
authorized—asks whether the doctor can complete the task with low friction,
knowledge and uncertainty are correct, privacy/failure evidence matches the
boundary, and the PDF is accurate and traceable. It uses working-product traces,
transcripts, screenshots, and PDFs but never replaces physician feedback.

### Review record

Post Claude's actual result under an explicit `Claude review` heading without
silently rewriting its judgment. Record:

- review mode, exact commit, model, effort, and CLI;
- subscription preflight;
- prompt version/source and complete invocation prompt;
- inputs and checks;
- complete findings, limitations, and severity;
- dispositions and resolving commits; and
- any separately authorized additional review.

The PR is the canonical code-review record. Put premise challenges on the issue
as well and update the owning active document when authority changes.

## Stop and reconcile

Stop only the affected work when continuing would change user behavior,
semantic truth, authority, scope, privacy, evidence, or a consequential
technical commitment. Preserve the smallest failing example and record expected
versus observed behavior, owner, options, and recommendation in the issue/PR.

Fix an ordinary defect locally with focused recurrence evidence. If an owning
premise is wrong or ambiguous, update its active document and obtain approval
before resuming. Tests may follow an approved decision change; they may not be
weakened to bless a workaround. Reversible naming, organization, refactoring,
library adaptation, and visual polish within approved behavior remain
implementation discretion.

## Merge controls

`main` is protected. Require:

- pull requests and one approving review;
- approval of the latest material change;
- resolved review conversations;
- linear history;
- no force push, deletion, administrator, or application bypass; and
- the single `verify` status check after it exists.

Use squash merge. Merge queues, CODEOWNERS, multiple routine reviewers, signed
commits, coverage thresholds, release branches, automatic releases, and
deployment approval environments remain deferred until evidence shows value.
Merge never implies external deployment, purchase, or production authorization.

## Durable trace

- **Issue:** intent, scope, evidence, and stopping conditions.
- **Commits:** meaningful branch checkpoints.
- **Pull request:** delivered result, evidence, attributed review, dispositions,
  and merge decision.
- **Comments:** material discoveries, challenges, and outcomes—not routine
  narration.
- **Active documents:** one owner for every lasting decision.
- **CI and retained experiment artifacts:** reproducible evidence.

At merge or falsification, leave one concise outcome note. Reassess this process
after Experiment 1 and remove steps that produce no signal. Post-merge review is
reserved for escaped defects, incidents, or contradicted premises and still
requires Steve's permission when Claude is used.
