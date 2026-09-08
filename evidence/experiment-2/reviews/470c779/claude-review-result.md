# Claude review

**Review mode:** Standard fresh-context review, directive `wilson-review-v1`
(`docs/DELIVERY.md`, "Standard review" section), read-only, no implementation.

**Exact commit reviewed:** `470c7792397c67cf42d3556a73294b92f8a23be8`
(local `codex/42-experiment-2-plan`).

**Base:** local `main` at `aed8f58e1f3fc2c08b238999fc493192ab2e65b5`.

**Model/effort:** Claude Sonnet 5, effort as configured by the harness for this
session (not independently surfaced to me as a numeric/label value; per
`docs/DELIVERY.md` this should be `high`).

## What I inspected

- The complete `wilson-final-review-470c779-material.diff` (129,538 bytes) and
  `wilson-final-review-470c779-full.diff` (157,041 bytes), read start to end,
  before and after forming an independent first-pass judgment.
- Current-state governing corpus in the checked-out worktree (which matches the
  target commit per the supplied git status): `README.md`, `docs/PRODUCT.md`,
  `docs/ARCHITECTURE.md`, `docs/EXPERIMENT-1.md`,
  `docs/EXPERIMENT-2.md`, `docs/DELIVERY.md`.
- Retained evidence: `evidence/issue-40/README.md` (to verify the Experiment 1
  disposition's "9 of 29 / 0 of 2" exact-source claim),
  `evidence/experiment-2/effort-ledger.json`, and the earlier review's evidence
  bundle at `evidence/experiment-2/reviews/f17c5a0/` (prompt, result, run record)
  — inspected only after completing an independent first pass on the material
  diff.
- Surrounding application code: `src/domain/case/model-boundary.ts` (to confirm
  current offset-based source handling is unchanged, consistent with Issue #39
  remaining open and deferred to Experiment 2 Stage 1), and a full file listing
  under `src/` (to confirm zero application-code touch by this diff).
- Issue #42, Issue #39, and draft PR #43 text as supplied, per the instructed
  evidentiary weight (PR #43 treated as delivery context for the earlier,
  superseded commit, not as acceptance evidence for `470c779`).

## What I ran

No shell/Git tool was used or needed. I did not run `npm run typecheck`,
`npm test`, or `npm run build`, because this is a documentation/evidence-only
change; I independently confirmed via `Glob` that no `src/**` file is touched by
the diff, so no build/test regression risk applies.

## BLOCKING findings

None. Independently working from the material diff first, I traced the same
substantive risk the retained earlier review found (the "production-seed"
quality bar in `README.md`, `docs/ARCHITECTURE.md`, and
`docs/EXPERIMENT-2.md` measurably enlarges Issue #42's "minimum generalization"
scope) — but this commit resolves it correctly rather than merely retaining the
finding: `docs/EXPERIMENT-2.md`'s new "Authority reconciliation" section,
cross-referenced from `README.md` and `docs/ARCHITECTURE.md`'s status lines,
durably records Steve's explicit operator decision that any further experiment
must evolve the codebase toward production-quality code, while explicitly
preserving the distinction between that code-quality bar and the production
infrastructure/release/persistence/real-data/expanded-scope items Issue #42's
stop condition actually names. That is a legitimate, non-circular resolution:
Issue #42 stops on "production or real-data **architecture**," not on
code-quality standards for the same bounded feature surface, and the document
is explicit that the bar authorizes no infrastructure, release, data, or scope
expansion. I checked this against the exact operator quotes supplied and found
the paraphrase faithful.

The earlier review's follow-up finding (inconsistent "four decision questions"
vs. Issue #42's "one falsifiable decision question," and a stray fifth
dimension in the Success section) is also fully reconciled:
`docs/EXPERIMENT-2.md`'s "Decision and evidence dimensions" section now states
one investment question with four separately-recorded evidence dimensions, and
the Success section's closing paragraph now names the identical four dimensions
with matching wording — no remaining inconsistency.

I independently verified the Experiment 1 disposition's specific factual claim
("9 of 29 opening excerpts and 0 of 2 correction excerpts matched the oracle
exactly") against `evidence/issue-40/README.md:169-172`, which states the
identical figures — the evidence record is accurate, not merely asserted.

## FOLLOW-UP findings (independently valuable, not blocking)

### 1. Review-disposition traceability gap

`docs/DELIVERY.md`'s "Review record" section requires recording "dispositions
and resolving commits" for each finding. The retained evidence at
`evidence/experiment-2/reviews/f17c5a0/` records one blocking and one follow-up
finding from the prior review, but nothing in the repository explicitly maps
each finding to where/how it was resolved (the Authority reconciliation
subsection for finding 1; the rewritten decision-dimensions framing for finding
2). A reader encountering only the retained review evidence has to reconstruct
that mapping themselves. Recommend a short disposition note (in the PR body
once pushed, or a small addition to the evidence bundle) explicitly linking
each finding to its resolving section/commit, matching the delivery process's
own stated requirement.

### 2. Production-seed bar creates real pressure against "small implementation slices"

Issue #42 asked for "small implementation slices that do not assume the result."
The now-authorized production-seed bar (`docs/EXPERIMENT-2.md`,
"Production-seed implementation" section and Success criterion 8) requires
generalized stable entity identity, a case-agnostic model schema, state-derived
UI/command availability, and a general Issue #39 evidence remedy — all built to
a "maintainable, not disposable" standard — before Stage 2's early live evidence
exists. This is explicitly what Steve authorized and is not a defect in the
document, but it materially enlarges the "Core boundary slice" and "Assembled
product slice" relative to a purely minimal-generalization plan. The document's
own "Value discipline" and "Stop and reconcile" sections are the intended
guardrail against this pressure; I recommend Steve and the implementer stay
attentive to actual slice size in practice, since a quality bar and a small-slice
discipline can pull in opposite directions even when both are legitimately
authorized.

## No other findings

Aside from the two follow-ups above, I found no further material reasons this
change should not merge. Physician-completion language is consistently removed
across `README.md`, `docs/EXPERIMENT-1.md`, and `docs/PRODUCT.md`, with only
forward-looking, correctly-deferred mentions of a later physician milestone
remaining. The three Experiment 2 journeys map cleanly onto Issue #42's three
candidate dimensions and their internal cross-references (indication-question
logic, partial-output rule, correction/conflict handling) are self-consistent
when traced against each other. The Issue #39 remedy described matches Issue
#39's own governing scope. No application source is touched, so there is no code
regression risk from this change itself.

## Material limitations

- No shell/Git tool was available or used; I relied on the two supplied diff
  artifacts plus direct reads of the checked-out worktree, which the provided
  git status indicates is already at the target commit. I did not independently
  recompute the stated SHA-256 hashes of the diff artifact files.
- I could not independently confirm this session's `claude auth status`/
  subscription preflight or the exact configured effort label; I report Sonnet
  5 as observed.
- Per instructions, I read the earlier review evidence only after forming an
  independent first-pass judgment from the material diff and governing corpus;
  that independent pass reached the same substantive conclusions the retained
  evidence records, which increases my confidence but does not eliminate the
  possibility of shared blind spots between this review and the retained one.
- `docs/RECOVERY.md` and legacy Wilson material were not reviewed in depth,
  consistent with the instructions identifying them as historical evidence
  outside this change's governing corpus.

No findings remain beyond the two follow-ups above; neither is blocking.
