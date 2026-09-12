# Wilson delivery and independent review

**Status:** Approved by Steve through 2026-09-10, including standing authority
for bounded agent work through objective, autonomous merge

**Owns:** Work items, branches, pull requests, verification, independent review,
execution authority, merge controls, stop-and-reconcile, and durable trace

## Purpose

Preserve useful implementation history and independent challenge without
recreating the process weight that obscured legacy Wilson's assembled product.
Every meaningful change is isolated, checked, independently reviewed when
needed, and merged when its objective readiness criteria pass. Durable product
or technical decisions live in their single owning active document.

## Unit of work

Create one issue for each meaningful implementation slice, defect, or
consequential decision. It names the outcome, included/excluded scope, governing
documents, minimum acceptance evidence, and stopping conditions. Small fixes
found within the slice stay there; later regressions or independently valuable
work get separate issues.

For work already covered by an approved product direction, experiment, or user
request, Codex may create the issue and begin the branch without another
permission step. The issue is the durable scope record, not a second approval
gate.

Experiment 1 may have one lightweight tracker, but needs no project board,
milestone hierarchy, or issue taxonomy.

## Branch and pull request

Branch from current `main` as:

```text
codex/<issue-number>-<short-description>
```

Use one short-lived branch per coherent issue. Do not create long-running
development or experiment branches. Open a draft pull request after the first
meaningful commit. Codex may create, update, publish, mark ready, and merge the
PR as part of normal delivery. The PR records:

- plain-English outcome and linked issue;
- included and excluded scope;
- important implementation choices;
- exact automated and manual evidence;
- required screenshots, traces, model samples, or PDFs;
- deviations, stop-and-reconcile decisions, and unresolved risk; and
- the final disposition and remaining risk.

An automatic Git preview can be created from the first branch push before the
draft pull request exists. When an application gate requires pull-request
metadata, that pre-PR deployment is not an operator-ready preview even if the
hosting deployment itself succeeds. After opening the draft PR, push the next
meaningful commit before handing the preview to an operator. If the material
change is already complete, one explicitly labelled empty deployment-trigger
commit is permitted instead. Verify that the replacement deployment targets
that post-PR commit and was created after the PR; do not relax the application
gate to make the earlier deployment usable.

Update it at meaningful boundaries, not with routine terminal narration.
Successful branches are deleted after squash merge. If an experiment falsifies
its premise, close without merging and retain a named branch or commit until its
disposition is decided.

## Standing execution authority

Once Steve has approved an outcome, experiment plan, or concrete request, Codex
may complete the ordinary work needed to deliver and merge it without asking
permission again at each step. Within the governing documents and the issue/PR
scope, this includes:

- creating and updating issues, branches, commits, pull requests, comments, and
  review-ready state, then squash-merging a ready pull request and completing
  its issue/branch disposition;
- implementing the change, fixing ordinary defects, and running local, CI,
  browser, PDF, protected-preview, and other proportionate checks;
- running each standard Claude Sonnet review required below, continuing the
  same session to complete an incomplete inspection, and running one targeted
  Sonnet recheck when material remediation needs it;
- running bounded application-model experiments with synthetic data, judging
  them against external assessments, and collecting later independent evidence
  after a non-invalidating failure; and
- recording results, costs, limitations, and dispositions in the smallest
  durable location that later work will actually consult.

The issue or owning experiment defines the synthetic inputs, call count,
evidence handling, retry policy, and any narrower limit. A pre-execution update
is notification, not a request for permission. The default autonomous
application-model allowance is **USD 5 per batch and USD 20 total per issue**.
Estimate or reserve enough capacity before each call, never split work to evade
a limit, and record exposed calls, tokens, latency, and actual or estimated
spend afterward. A narrower experiment cap still wins.

Stop and reconcile rather than extending the work when it would require:

- changing a material product, architecture, privacy, security, clinical-data,
  or experiment premise beyond existing authority;
- using real clinical data;
- a new paid-plan purchase or spend above the standing limit;
- destructive or difficult-to-reverse action outside ordinary branch work; or
- expanded review with Opus, multiple independent reviewers, or another
  exceptional review program.

Production deployment/release and physician or other external participation are
not actions in Wilson's development lifecycle. This document neither defines
nor authorizes them; their future relevance would require a new owning product
or experiment decision rather than a routine delivery approval.

A later direct instruction from Steve may narrow or expand authority for that
specific task. Routine execution should otherwise continue through verified
merge; do not turn the controls in this document into repeated requests to
follow the document. Status updates that preview authorized review, model, Git,
or GitHub work do not create approval gates.

This authority governs what Codex may do. Host filesystem, network, credential,
and application permission settings govern what it can do. A host restriction
may block an authorized action, but it does not create a new Wilson approval
requirement. Record the exact platform limitation and stop only when the host
provides no authorized path forward.

## Verification and review flow

Before a PR is ready:

1. The implementer reviews the complete diff against the issue and owning
   documents.
2. The narrow checks required by the slice pass.
3. A fresh-context technical reviewer who did not implement the change inspects
   the complete change and evidence when this document requires a new review.
4. Blocking findings are fixed or explicitly resolved. Follow-ups become issues
   only when independently worth doing.
5. The PR records a concise acceptance summary and remaining risk.

Review checks code correctness and whether implementation hides a bad premise;
local conformance is not enough. It runs against the exact final material
change. Codex determines merge readiness from the delivered scope, acceptance
evidence, review disposition, required checks, and remaining risk. When those
criteria and the merge controls below pass, Codex marks the PR ready and
squash-merges it without a separate approval step.

New material commits after the recorded review require proportionate review of
the latest change before merge.

### Proportional closure without recursive model runs

Independent review is required for implementation and new material product or
technical premises, not automatically for every edit to instructions. An
originating independent review may cover its bounded remediation, and an
editorial consolidation may rely on its approved source decisions, when the PR:

- links the attributed review or source approvals;
- maps findings or source authority to the final diff;
- introduces no unapproved behavior, semantics, architecture, privacy, scope,
  evidence, or process premise, and removes or weakens no approved decision
  without naming that change in the PR;
- passes an implementer audit and its narrow checks; and
- satisfies the objective merge controls below.

No new Claude run is required merely to confirm its own dispositions or to
restate approved decisions more coherently. A change beyond those bounds needs
fresh independent review. Steve may request another review at any time.

## Claude review

When Codex implements or coordinates a substantive change requiring a new
review, Claude is the default fresh-context reviewer and the run is covered by
the standing authority above. The standard review sends the private repository
diff, governing documents, relevant issue/PR records, surrounding code, and
acceptance evidence to Anthropic through Steve's authenticated Claude CLI; that
bounded disclosure is part of the approved review, not a separate permission
step. If Claude is unavailable, record the limitation and stop rather than
silently substituting another reviewer. Claude cannot edit, post to GitHub, or
merge.

### Standard review

Use the current Claude Sonnet model at `high` effort after implementation and
narrow evidence are complete. Record the canonical model ID and CLI version.
Review the full `main...HEAD` diff, not only the latest commit.

Before every run, confirm `claude auth status` reports `claude.ai` and Steve's
active subscription, while `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and
`ANTHROPIC_BASE_URL` are unset. Stop on failure; never fall back to a paid API,
gateway, or alternate provider. Record only that the preflight passed.

Do not impose budget, token, turn, or wall-clock ceilings. A required run
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

Codex may continue the same review session when required inspection was
incomplete and may run one targeted Sonnet recheck when bounded remediation
materially changes reviewed code. State why the existing result is insufficient
and pin the exact delta. Do not run a second independent reviewer or repeat a
complete review merely for reassurance. Repeat the complete standard review
only when remediation materially changes behavior, contracts, architecture,
privacy, scope, evidence, or another owning premise.

Expanded review is exceptional and must be separately requested. Use it
for multiple distinct consequential risks such as security/privacy, durable
data migration, model semantics, consequential workflow, clinical/output
accuracy, broad architecture, or the integrated pre-physician checkpoint. It
may use Claude Opus at `high` or `xhigh`; Opus `xhigh` is the maximum. Do not use
Opus `max`, Fable, or a model/effort outside these bounds. Multiple reviewers,
agents, or fresh passes require separate permission and risk-specific roles.

### Review record

Post Claude's actual result under an explicit `Claude review` heading without
silently rewriting its judgment. Record:

- review mode, exact commit, model, effort, and CLI;
- subscription preflight;
- prompt version/source and material inputs and checks;
- complete findings, limitations, and severity;
- dispositions and resolving commits; and
- any additional or expanded review.

The PR comment is normally sufficient. Retain the complete prompt or a separate
repository review bundle only when an experiment requires it, a review incident
needs reconstruction, or the PR cannot hold the material record. Do not commit
verbose internal event streams or duplicate the same narrative across the
issue, PR, active documents, and evidence tree.

The PR is the canonical code-review record. Put premise challenges on the issue
as well and update the owning active document when authority changes.

## Stop and reconcile

Stop only the affected work when continuing would change user behavior,
semantic truth, authority, scope, privacy, evidence, or a consequential
technical commitment. Preserve the smallest failing example and record expected
versus observed behavior, owner, options, and recommendation in the issue/PR.

A failure does not by itself require Steve's intervention. Continue useful
independent checks or experiment calls within scope and budget when the failure
does not invalidate their interpretation, increase consequential risk, or cross
the standing authority or issue evidence bounds above. Record the limitation
and use the remaining evidence to make the eventual decision better.

Fix an ordinary defect locally with focused recurrence evidence. If an owning
premise is wrong or ambiguous, stop the affected work with evidence and a
recommendation rather than forcing a decision. Tests may follow an approved
decision change; they may not be weakened to bless a workaround. Reversible
naming, organization, refactoring, library adaptation, and visual polish within
approved behavior remain implementation discretion.

## Merge controls

`main` is protected. Require:

- pull requests;
- acceptance evidence and required independent review against the latest
  material change, with no unresolved blocking finding;
- resolved review conversations;
- linear history;
- no force push, deletion, or bypass; and
- the single `verify` status check after it exists.

Codex marks the pull request ready and uses squash merge as soon as these
controls pass. Merge queues, CODEOWNERS, multiple routine reviewers, signed
commits, coverage thresholds, release branches, and automatic releases remain
deferred until evidence shows value. Wilson has no production deployment or
release step.

## Durable trace

- **Issue:** intent, scope, evidence, and stopping conditions.
- **Commits:** meaningful branch checkpoints.
- **Pull request:** delivered result, evidence, attributed review, dispositions,
  and merge decision.
- **Comments:** material discoveries, challenges, and outcomes—not routine
  narration.
- **Active documents:** one owner for every lasting decision.
- **CI and retained experiment artifacts:** reproducible evidence.

### Effort and value record

Experiment 2 keeps one compact stage ledger at
`evidence/experiment-2/effort-ledger.json`. Commit one entry at each meaningful
stage or decision boundary and link it from the existing PR. Record start and
finish time; cumulative Codex task tokens at start and finish plus the delta;
external model input/output tokens, latency, cost, and call count when exposed;
review model and effort; concrete result; and durable value as product code,
decision evidence, or process-only work. Mark unavailable measurements rather
than estimating them.

This is a retrospective 80/20 aid, not per-turn narration, product analytics,
time tracking infrastructure, or a reason to continue low-value work. The final
outcome identifies stages whose effort did not proportionally improve the code
or decision so later work can remove them.

Fold routine review, publication, retries, and process corrections into the
stage entry they served. Do not create separate ledger entries or commits for
bookkeeping that does not change the product or decision.

## Experiment 1 process disposition

Experiment 1 retained useful signal from isolated issues/branches, protected
main, focused deterministic checks, fresh-context review of consequential
premises, and exact deployed evidence. Keep those controls for Experiment 2;
replace its historical human merge decisions with the objective controls above.

Recursive review, repeated live runs without a new decision question, runner
ceremony that obscures the product result, and attempts to convert the fixed
oracle into runtime validation did not improve confidence proportionally. Do
not carry them forward. One originating independent review may cover its
bounded remediation under the proportional-closure rule above; evidence-only
updates do not trigger another review or live run.

This section records the required post-Experiment 1 reassessment. At merge or
falsification, leave one concise outcome note. Post-merge review is reserved for
escaped defects, incidents, or contradicted premises; a standard Sonnet review
needed for that bounded work remains covered by standing authority.
