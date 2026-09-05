# Wilson development process

**Status:** Approved by Steve on 2026-09-04  
**Purpose:** Preserve useful implementation history and independent review
without recreating sofa-claude's process weight

This process applies to every substantive repository change after the recovery
planning commits. It implements the recovery principles that complete
user-visible journeys matter more than locally finished components, owning
causes matter more than path-specific patches, and consequential discussion
must become durable authority.

## Plain-English summary

Every meaningful change starts with a short issue, happens on its own temporary
branch, and reaches `main` through a pull request. Automated checks and a
fresh-context technical review examine the work. Steve receives a plain-English
summary and the evidence needed to approve or reject the merge. Direct work on
`main` is not allowed.

The issue explains why. The branch isolates the work. The pull request explains
what changed and carries its evidence and review. Governing Markdown records
any lasting product, interaction, architecture, verification, or process
decision.

## Unit of work

Create one issue for each meaningful implementation slice, defect, or
consequential decision. An issue names:

- the intended outcome;
- included and excluded scope;
- the governing artifacts;
- the minimum acceptance evidence; and
- applicable stop conditions.

Small fixes discovered while completing a slice remain in that issue. Do not
open an issue for every file, commit, typo, test, or review comment. A later
regression or an independently valuable follow-up gets its own issue.

Experiment 1 may use one lightweight tracking issue linking its slice issues,
but it does not require a project board, milestone hierarchy, or issue taxonomy.

## Branches

Branch from current `main` using:

```text
codex/<issue-number>-<short-description>
```

Use one short-lived branch per coherent issue. Do not create `dev`, `staging`,
or a long-running Experiment 1 implementation branch. Keep useful
work-in-progress commits on the issue branch; they need not be polished
individually.

Successful branches are deleted after squash merge. If an experiment falsifies
its premise, close its pull request without merging and retain the branch or a
named commit until the experiment review decides its disposition.

## Pull requests

Open a draft pull request after the first meaningful commit so the issue-to-code
relationship and important discoveries remain visible while work proceeds. One
pull request normally resolves one issue and includes:

- a plain-English outcome and linked issue;
- scope and explicit non-scope;
- the important implementation choices;
- exact automated and manual evidence;
- screenshots, trace, model sample, or PDF when the slice requires them;
- deviations, stop-and-reconcile decisions, and unresolved risks; and
- the decision requested from Steve.

Update the pull request at meaningful boundaries. Do not reproduce terminal
logs or post routine progress comments merely to create activity.

## Verification and review

Before a pull request is ready:

1. The implementer reviews the complete diff against the issue and governing
   artifacts.
2. The narrow checks required by the slice pass.
3. A fresh-context technical reviewer inspects the diff, issue, governing
   artifacts, and evidence. The reviewer did not implement the change.
4. Review findings are only `blocking` or `follow-up`. Blocking findings are
   fixed or explicitly resolved; follow-ups become issues only when they are
   independently worth doing.
5. The pull request records the review outcome and presents Steve with a
   concise, non-technical acceptance summary.

The technical review checks both code correctness and whether implementation
has hidden a bad premise. It must not treat conformance to an incorrect local
contract as sufficient evidence.

Steve's required GitHub approval is the merge authorization. It means the
delivered scope, evidence, review result, and disclosed risks are acceptable;
it does not require Steve to perform a line-by-line technical audit. New
material commits after approval require review of the latest change before
merge.

## Stop and reconcile

The [preflight stop-and-reconcile rule](DEPLOYMENT-PREFLIGHT.md#stop-and-reconcile-rule)
applies throughout implementation. When continuing would change user-visible
behavior, semantic truth, authority, scope, privacy, evidence, or a
consequential technical commitment:

1. stop the affected work and preserve the smallest failing example;
2. record expected versus observed behavior, the owning premise, options, and
   recommendation in the issue or pull request;
3. update the owning governing artifact; and
4. obtain approval before resuming that work.

Routine reversible coding choices within an approved seam do not require a new
decision. Tests may change after an owning decision changes; they may not be
weakened to bless a workaround.

## Merge and repository controls

`main` is the protected integration branch. Successful pull requests use squash
merge so `main` receives one understandable commit per logical change while the
pull request retains the detailed development and review record.

Protect `main` with:

- pull requests required;
- one approving review required;
- approval of the latest material change required;
- review conversations resolved;
- linear history required;
- force pushes and deletion prohibited; and
- no routine administrator or application bypass.

Once the initial `verify` GitHub Actions job exists, require that single status
check before merge. Do not invent a placeholder required check before the
application scaffold can run it.

Merge queues, multiple required reviewers, CODEOWNERS, signed-commit
enforcement, deployment approval environments, coverage thresholds, automatic
releases, and a permanent release-branch scheme are deferred until evidence
shows they protect Wilson.

No external deployment, purchase, or production action is implied by a merged
pull request. Those actions retain their separate product and operator approval
boundaries.

## Durable trace

Use each surface for one purpose:

- **Issue:** intent, scope, acceptance evidence, and stopping conditions.
- **Commits:** meaningful implementation checkpoints on the issue branch.
- **Pull request:** implementation summary, evidence, review, and merge
  decision.
- **Issue and review comments:** material discoveries, challenges, and
  dispositions—not routine narration.
- **Governing Markdown:** lasting requirements and decisions.
- **CI and retained experiment artifacts:** reproducible evidence.

At merge or falsification, leave one concise outcome note linking any retained
evidence and follow-up issues. Reassess this process after Experiment 1; remove
steps that produce no useful signal and strengthen only the controls whose
absence caused a real escape.
