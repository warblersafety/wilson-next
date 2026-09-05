# Claude review protocol

**Status:** Approved by Steve on 2026-09-04
**Purpose:** Add genuinely independent model review to Wilson without turning
every pull request into a review exercise

This protocol implements the fresh-context technical review required by the
[Wilson development process](DEVELOPMENT-PROCESS.md). Claude is the default
reviewer when Codex implements or coordinates the change. Steve remains the
merge authority.

## Plain-English summary

Once a change and its evidence are complete, a fresh Claude session tries to
find material reasons it should not merge. Claude sees the intended outcome,
the governing Wilson decisions, the complete change, and its evidence, but not
the implementer's conclusions or earlier findings before its first pass.

Claude cannot edit, approve, or merge the work. Its attributed findings are
posted on the pull request. Most changes receive one broad review. Multiple
review perspectives are reserved for changes with distinct, consequential
risks and for the integrated checkpoint before the first physician session.
The standard is Sonnet at high effort; Opus at `xhigh` is the ceiling, and
Fable is never used. Claude does not run a second time without Steve's explicit
permission. Every review uses Steve's Anthropic subscription, never a metered
API call.

## Standard review

Run one standard review after:

1. the implementation is complete at a named commit;
2. the issue's narrow verification has passed;
3. required evidence is attached or linked; and
4. the implementer has reviewed the complete diff.

Run it before the pull request is ready for Steve's approval. Review the full
`main...HEAD` change, not only the latest commit.

The standard reviewer is the current Claude Sonnet model at `high` effort.
This is Wilson's minimum review tier: do not use Haiku, a Sonnet effort below
`high`, or another less-capable configuration for substantive review. Record
the canonical model identifier returned by the run rather than relying only on
the moving `sonnet` alias.

Before every run, confirm that `claude auth status` reports `claude.ai`
authentication and Steve's active subscription, and that `ANTHROPIC_API_KEY`,
`ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_BASE_URL` are unset. Record only that the
subscription preflight passed; never copy account identifiers or credentials to
the repository or GitHub. If the preflight fails, stop. Do not fall back to a
paid Anthropic API call, another API provider, or a gateway.

Give the reviewer:

- the issue and intended outcome;
- included and excluded scope;
- the governing Wilson artifacts;
- the exact commit and complete diff;
- relevant surrounding code; and
- test results, screenshots, traces, model samples, PDFs, or other acceptance
  evidence required by the issue.

Use a fresh Claude session. Do not provide the implementer's expected findings,
self-review conclusions, or another review's findings until Claude completes
its independent first pass. The reviewer may inspect files and run safe,
relevant checks, but it must not edit the worktree, commit, push, approve, post
to GitHub directly, or merge. Enforce that boundary with a read-only tool
allowlist; a separate disposable checkout may provide additional isolation but
does not replace the tool boundary. Do not give the reviewer repository write
credentials or use a permission-bypass mode.

Use this prompt as `wilson-review-v1`, supplying the named inputs without
adding hints about suspected defects:

> Review this exact Wilson change and find material reasons it should not
> merge. Inspect the complete diff, issue, governing artifacts, relevant
> surrounding code, and acceptance evidence. Check correctness, missing
> behavior, regression risk, and whether the implementation hides a faulty
> requirement or architectural premise. Do not edit anything. Report only
> BLOCKING findings and independently valuable FOLLOW-UP findings, with
> evidence and precise locations. State what you inspected and ran, material
> limitations, and explicitly say when no findings remain.

The `wilson-review-v1` label binds to the quoted review directive in this file
at the commit recorded for the prompt source. Changing its review criteria or
instructions requires a new version label. A run may add neutral target
metadata, input locations, and output formatting around the directive. Record
the complete invocation prompt on the pull request; additional evaluation
criteria or suspected-defect hints make it a different prompt and require a
different label. The structured labels organize Claude's result; they do not
constrain what it may investigate.

## Findings and additional review

- A **BLOCKING** finding identifies a material reason the change should not
  merge. Fix it or explicitly resolve the owning premise.
- A **FOLLOW-UP** finding is worthwhile but does not invalidate the delivered
  scope. Create an issue only when it is independently worth doing.
- Style preferences, speculative enhancements, and ceremony are not findings.

If a finding exposes a bad product, interaction, architecture, verification,
privacy, or process premise, apply the stop-and-reconcile rule. Do not patch
around it.

After a finding is addressed, record its disposition and the resolving commit
on the pull request. Do not run Claude again—whether to verify one fix or repeat
the complete review—without Steve's explicit permission for that run. A request
for permission states why the existing review and disposition are insufficient,
the proposed target commit, whether the review is targeted or complete, and the
model and effort.

When Steve authorizes additional review, use a targeted check for a narrow,
local fix. Repeat the complete review only when the response materially changes
behavior, scope, contracts, architecture, privacy, evidence, or another owning
premise. The additional reviewer may see the earlier findings and dispositions.
Never retry, escalate, or multiply an incomplete review automatically.

The pull request records the commit Claude reviewed and every later commit that
resolves findings or otherwise changes the reviewed result. Steve's GitHub
approval of the latest commit remains the final judgment that the review,
dispositions, later changes, evidence, and remaining risk are acceptable.

## Expanded review

Do not use multiple reviewers merely to make a small pull request look more
rigorous. Use an expanded Claude review when the change has more than one
distinct consequential risk, such as:

- privacy, authentication, authorization, or another security boundary;
- a durable data-model change or migration;
- model prompts, extraction semantics, confidence, or evaluation logic;
- consequential conversational behavior or user workflow;
- clinical meaning, projection accuracy, or generated-document correctness;
- a broad architectural change; or
- an integrated product checkpoint before physician use.

Expanded review requires Steve's explicit permission for that run. It may use
Claude Opus at `high` or `xhigh` effort; Opus `xhigh` is the maximum permitted
Wilson review tier. Do not use Opus `max`, Fable, or an unbounded model or effort
setting. A multi-agent review or separate fresh passes also require explicit
permission. Assign perspectives from the actual risks in the issue rather than
maintaining a permanent swarm of generic personas. Consolidate duplicate
findings, but retain disagreement and provenance.

Before the first physician session, review the integrated journey across four
questions:

1. Can a doctor complete the intended task with low friction?
2. Does Wilson capture and represent the right knowledge, including
   uncertainty?
3. Do privacy, failure handling, and retained evidence match their approved
   boundaries?
4. Is the projected output accurate and traceable to the conversation and
   independent data model?

This checkpoint uses the working product evidence, including relevant
Playwright traces, transcripts, screenshots, and generated PDFs. It does not
replace physician feedback.

## Durable review record

Codex posts Claude's actual result to the pull request under an explicit
`Claude review` heading. Do not silently rewrite Claude's judgment as Codex's
own. A separate plain-English summary may accompany it.

The comment and pull-request summary record:

- review mode: standard or expanded;
- reviewed commit SHA;
- Claude model and CLI version reported for the run;
- confirmation that the subscription-authentication preflight passed;
- prompt version, prompt-source commit, and complete invocation prompt;
- inputs inspected and checks run;
- complete findings and their severity;
- material limitations; and
- finding disposition, resolving commits, and any authorized additional-review
  result when applicable.

The pull request is the canonical code-review record. Put a premise challenge
or consequential discovery on the issue as well, and update governing Markdown
when it changes lasting authority. At merge or falsification, add one concise
outcome note; do not repeat the full review.

## Exceptions and learning

Claude is the default, not an invisible availability dependency. If it cannot
run, disclose that on the pull request and obtain Steve's agreement before
substituting another fresh-context reviewer. The substitute still cannot be
the implementer.

Do not routinely review after merge. Use a post-merge review for an escaped
defect, incident, contradicted premise, or other concrete learning event, and
only with Steve's permission. At the end of Experiment 1, compare what Claude
caught, what was noise, elapsed time and reported cost, and what escaped;
simplify or strengthen this protocol using that evidence.
