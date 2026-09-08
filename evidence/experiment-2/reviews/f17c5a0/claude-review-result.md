Note: the plan-file Write tool isn't available in this session, so I'm
delivering the review directly as my response below.

# Claude review

**Review mode:** Standard fresh-context review, directive `wilson-review-v1`
(docs/DELIVERY.md, "Standard review" section), read-only, no implementation.

**Exact commit reviewed:** `f17c5a05d146012a1fd04983171d0a547ab5773c`
(local `codex/42-experiment-2-plan`, ahead of draft PR #43's remote head
`0e84743`).

**Base:** local `main` at `aed8f58e1f3fc2c08b238999fc493192ab2e65b5`.

**Model/effort:** this agent session (Claude Sonnet 5, effort as configured by
the harness for this task). I could not independently execute
`claude auth status` or otherwise confirm the CLI/subscription preflight
described in docs/DELIVERY.md; see Limitations.

## What I inspected

- Full current-state text of the governing corpus at the target commit:
  `README.md`, `docs/DELIVERY.md`, `docs/PRODUCT.md`,
  `docs/ARCHITECTURE.md`, `docs/EXPERIMENT-1.md`,
  `docs/EXPERIMENT-2.md`, and (partially, for cross-reference only, since it is
  not the owning document for this change) `docs/RECOVERY.md`.
- `evidence/experiment-2/effort-ledger.json`.
- The complete supplied text of Issue #42 and Issue #39.
- The complete supplied text of draft PR #43 (treated strictly as delivery
  context describing the earlier commit `0e84743`, not as acceptance evidence
  for `f17c5a0`, per the task's own instruction).
- Confirmed via `Glob` that `evidence/experiment-2/` contains only the effort
  ledger, and that `src/**/*.ts` application files exist but show no evidence
  of being touched by this change.

## What I ran

No shell/git tool was available in this session. I did not run
`git diff main...HEAD`, `git log`, `npm run typecheck`, `npm test`, or
`npm run build`. I read the complete current-state files at the target commit
directly and cross-referenced them against Issue #42, Issue #39, and the draft
PR #43 body, inferring what was newly introduced in `f17c5a0` primarily from
the draft PR body's silence on "production-seed" language and from the effort
ledger's self-description of its "planning-revision" stage. See Limitations
for what this does not prove.

## BLOCKING findings

### 1. An unauthorized "production-seed" premise has been embedded as a core requirement of Experiment 2, in direct tension with Issue #42's own stop condition

**Evidence:**

- `README.md:16-20` — "Its proposed implementation must both answer the bounded
  experiment questions and replace the fixed journey with production-seed code
  for the supported adult medication adverse-event scope."
- `docs/ARCHITECTURE.md:3-5` (status line) and `:27-28` — "Accepted Experiment
  2 runtime changes are production-seed code for its bounded scope."
- `docs/EXPERIMENT-2.md:6` (Owns line), `:19-21` (decision question 1: "can one
  production-quality implementation run the selected medication journeys ..."),
  `:31-34` ("every accepted runtime change must be production-seed quality for
  the declared adult medication adverse-event scope rather than disposable
  experiment scaffolding"), the entire "Production-seed implementation"
  section (`:186-224`), and Success criterion 8 (`:364-366`, "The retained
  implementation is a credible production seed for the supported scope ...").
- `evidence/experiment-2/effort-ledger.json:28` — the "planning-revision"
  stage's own `result` field: "Reframed Experiment 2 as a lean production-seed
  experiment with separate technical, model/evidence, operator, and future
  clinician questions ..."

**Why this is material:** Issue #42's text never requests, mentions, or
authorizes a production-quality/"production-seed" code mandate. Its Included
list asks only for "the minimum application generalization needed to exercise
[the journeys]" — a deliberately minimal bar. Its Excluded list explicitly
excludes "Application implementation or refactoring." The only appearance of
"production" in Issue #42 is in its closing stop condition: "Stop and return
for direction if ... the proposed Experiment 2 requires production or
real-data architecture." The plan as written does not stop and return for that
direction; it silently adopts a production-quality mandate as part of decision
question 1, as a named success criterion (#8), and as a repeated architectural
rule across three of the four changed documents.

Making "credible production seed" quality a success gate (rather than
"minimum generalization to exercise three journeys") measurably enlarges what
the next implementation slices must deliver — generalized stable entity
identity, a fully case-agnostic model schema, state-derived command/control
availability, and a general Issue #39 evidence-anchoring remedy, all held to a
"maintainable ... not disposable experiment scaffolding" standard. That is
close to exactly the kind of premise Issue #42 said should be surfaced back to
Steve rather than adopted directly.

The effort ledger's own record shows this reframing carried `"review": null` —
it happened without independent review or a recorded return to Steve, even
though `docs/DELIVERY.md` requires independent review for "new material product
or technical premises," and this is one.

**Disposition needed before merge:** either remove the production-seed mandate
from the four documents and confine Experiment 2 to Issue #42's "minimum
generalization" bar, or explicitly return to Steve per Issue #42's own
stop-and-reconcile clause to obtain authorization for the larger scope.

## FOLLOW-UP finding (independently valuable, not blocking)

### 2. "Four decision questions" versus Issue #42's "one falsifiable decision question"

`docs/EXPERIMENT-2.md:15-29` labels four items as "Decision questions" and
states "Experiment 2 answers four questions separately," while Issue #42's
Acceptance section requires "Experiment 2 has one falsifiable decision
question." The Outcome section (`:51-67`) does resolve to a single three-way
Continue/Revise/Stop decision, and the four items read plausibly as
separately-recorded findings feeding that one decision rather than four
independent gates — so this may be a defensible reading rather than a scope
violation. But the document never reconciles the "four questions" framing with
the issue's explicit "one" wording, and the Success section's closing paragraph
(`:368-371`) separately lists "production-seed quality" as a fifth dimension
not present in the four-item Decision-questions list — an internal inconsistency
between the two sections of the same document. Recommend stating explicitly
that these are evaluation dimensions feeding one investment decision, and
reconciling the count with the Success section.

## No other findings

- Physician-completion requirement removal is applied consistently across
  `README.md`, `docs/EXPERIMENT-1.md`, and `docs/PRODUCT.md`; no stale
  physician-gate language found.
- The three proposed Experiment 2 journeys map directly onto Issue #42's three
  named candidate dimensions and are scoped to the named operators only,
  consistent with "operator-only."
- The Issue #39 remedy in `docs/EXPERIMENT-2.md` matches Issue #39's own
  governing scope and acceptance criteria.
- No application source (`src/**`) is touched by this change; regression risk to
  the running Experiment 1 application does not apply here.
- Delivery-process mechanics described by the PR match `docs/DELIVERY.md`'s own
  requirements.

Aside from Finding 1 (blocking) and Finding 2 (follow-up), I found no further
material reasons this change should not merge.

## Material limitations

- No shell/git tool was available in this session, so I could not run
  `git diff main...HEAD`, `git log`, `git show`, or the `verify` CI commands. I
  read the complete current-state documents at the target commit rather than a
  line-level diff, and inferred what was newly introduced in `f17c5a0` from the
  draft PR body's silence on "production-seed" and from the effort ledger's
  self-description. I cannot independently confirm the exact line-level diff
  boundary between `0e84743` and `f17c5a0`.
- I could not run or independently confirm the `claude auth status` /
  CLI-and-subscription preflight that `docs/DELIVERY.md`'s "Standard review"
  section requires before a run.
- I did not execute `npm run typecheck`, `npm test`, or `npm run build`; this is
  a documentation/evidence-only change with no source diff, so I accepted on
  inspection (rather than independently re-running) the claim that application
  source and dependencies are unchanged.
