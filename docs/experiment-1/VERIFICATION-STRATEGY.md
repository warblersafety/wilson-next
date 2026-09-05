# Wilson verification strategy

**Status:** Approved by Steve on 2026-09-04

**Prepared:** 2026-09-04

**Applies to:** `EXPERIMENT-1-PROPOSAL.md`

## Executive summary

Wilson's most valuable early test is a real doctor using the assembled product.
Automated testing should get that session here sooner and make it worth having;
it should not become a substitute for it.

Before the doctor sees Wilson, we need only enough evidence to know that the
fixed synthetic journey works, that obvious case-integrity failures are not
being hidden, and that the downloaded form says the same thing as the reviewed
case. That means a small group of domain tests, one repeatable browser journey,
a few inspected real-model runs, an operator smoke test, and a PDF comparison.

If those checks pass, Wilson goes to one physician for an observed synthetic-
case session and candid feedback. This is formative product discovery, not a
clinical validation study or a production-readiness claim. What the physician
finds determines the next work.

Coverage targets, a reusable simulated-clinician harness, a large eval corpus,
an LLM judge, a browser matrix, and a general testing platform are deferred.

## Decision requested

Approve this minimum evidence floor before the first physician session:

1. A few focused tests protect the six critical case behaviors below.
2. One deterministic headless-browser test completes the fixed journey using
   predetermined model responses instead of calling the live model.
3. The selected real model is tried on the fixed inputs no more than four times
   or USD 5, whichever comes first, and every result is inspected.
4. One operator smoke test completes the journey in the protected deployed
   preview; this may count as one of the real-model runs.
5. The final PDF is compared programmatically with the supported projection and
   inspected visually.
6. If no stopping failure appears, one physician uses the preview with synthetic
   information and gives observed, qualitative feedback.

This selects the evidence needed to reach the physician. It does not select the
framework, model, PDF library, or preview host; deployment preflight does that.

## The doctor-first rule

Before the first physician session, proposed work must do at least one of these:

- protect case integrity;
- enable the complete browser-to-PDF journey; or
- make the physician's feedback safer or easier to interpret.

If it does none of those, defer it. This rule applies to architecture, testing,
infrastructure, UI polish, and documentation—not just evals.

## Minimum automated evidence

### 1. Critical deterministic tests

The initial suite needs to prove only these behaviors:

- model proposals cannot become accepted facts without review;
- products retain stable identities and correct suspect/concomitant roles;
- a correction makes the old value inactive while retaining its history;
- a conflict has no active value and cannot reach the form until resolved;
- a duplicate or stale command cannot duplicate or reverse accepted work; and
- the reviewed case, semantic projection, and supported PDF values agree.

Use table-driven examples where that saves code. Test behavior, not every
function or component. A runtime-schema rejection test should also show that a
malformed model response fails before it reaches review.

No architectural test framework or broad dependency-rule system is required for
Experiment 1. Slice 1 does require one narrow automated dependency assertion
showing that application routes and UI modules cannot import lower-level case
mutation helpers. It may run as a focused Vitest/source-boundary test under
`npm test`; it does not require a separate framework or CI step. The
implementation must also keep the single write boundary clear enough to inspect
directly.

### 2. One deterministic browser journey

Playwright drives the approved seven-state journey with the fixed fixture and
predetermined model responses. The scripted responses stand in only for the
live model call; all browser, review, case, correction, conflict, projection,
and PDF behavior remains real. The test uses visible labels and accessible roles
and checks the important user-visible results:

- all three products remain distinct;
- the one follow-up group is asked exactly once and no other question appears;
- the corrected naproxen dose appears everywhere it should;
- the unresolved apixaban date remains visible but absent from the form;
- resolving the date updates review and output together; and
- a PDF downloads successfully.

The retained trace records the number of Wilson question groups, whether any
known information was requested again, and whether every question belongs to
the slice's declared budget. This is a simple trace assertion, not an analytics
system or a universal turn-count target.

Keep the trace and key screenshots when diagnosing a failure or recording the
experiment; do not build a visual-regression service. Playwright supports
[API mocking](https://playwright.dev/docs/mock) and retains browser evidence in
its [Trace Viewer](https://playwright.dev/docs/trace-viewer-intro).

The scripted responses prove that Wilson behaves predictably when given known
proposals. They test rendering, flow, and deterministic safeguards around model
output; they do not test whether the real model understood the case or reasoned
well. The real-model samples and physician preview use the live model.

### 3. A very small real-model check

Use the fixed opening account and correction/conflict update. Run no more than
four complete samples or spend USD 5, whichever comes first. Do not retry a bad
result invisibly.

For each run, record only what helps make a decision:

- model and prompt/schema revision;
- whether required facts were found;
- any invented fact or wrong product/role attachment;
- whether every material proposal has supporting text; and
- approximate latency and cost.

Any invented material fact, wrong entity or role, unsupported material value,
or missing projection-required fact stops the experiment and reopens the model
boundary. A single aggregate score is unnecessary.

OpenAI's
[evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
supports task-specific examples and human review. Wilson does not need an eval
platform: a small versioned script or test fixture and a short report are enough.
This also avoids depending on OpenAI's hosted Evals platform, which the current
guidance says will shut down on 2026-11-30.

### 4. Operator deployment smoke test

After local checks pass, the operator completes the same synthetic journey in
the protected deployed preview at 1440 x 900 using the selected real model and
the real FDA PDF filler. If it uses the same inputs and configuration, count it
as one of the permitted model samples.

The operator confirms only that the journey can be completed without coaching,
the important states are understandable, the PDF agrees with the reviewed case,
and no severe integrity or interaction failure is visible. Detailed analytics
and formal usability scoring are not required.

## First physician session

The physician session happens as soon as the minimum evidence above is green.
It uses synthetic information only and clearly identifies Wilson as an
experimental, incomplete tool that must not be used for a real report.

The physician exercises the assembled journey and then discusses the current
Form FDA 3500 experience. We want a few high-value observations:

- What was confusing or unexpectedly effortful?
- Did Wilson's understanding feel faithful and reviewable?
- Did the one follow-up earn the interruption, and were its question and
  correction interactions natural?
- Was anything important missing or given the wrong emphasis?
- Would this direction be preferable to completing the form directly, and why?

Record observations and short notes, not a pseudo-scientific score. One
physician can expose a bad premise and guide the next slice; one physician cannot
establish general usability, safety, or clinical validity.

The experiment's primary outcome is the decision their feedback enables:
continue, revise the interaction or architecture, or stop the direction.

## PDF and retained evidence

For the supported fields only, compare the semantic projection with the PDF's
programmatic values and check the rendered PDF visually. Unsupported sections
must remain visibly out of scope rather than appearing complete.

Retain only:

- the synthetic fixture and expected case result;
- the focused test result;
- the useful browser trace/screenshots;
- the short real-model run table and cost;
- the checked PDF; and
- the operator and physician notes.

Do not retain credentials, real clinical data, or an active preview beyond its
approved lifetime.

## Deferred until evidence creates a need

- Any line or branch coverage target. Coverage can be added later as a map of
  untested code, not a proxy for quality; see Martin Fowler's
  [Test Coverage](https://martinfowler.com/bliki/TestCoverage.html).
- A reusable simulated-clinician or persona harness. Lucy and interactive
  benchmarks such as
  [tau-bench](https://proceedings.iclr.cc/paper_files/paper/2025/file/1b126cc38b8638e07bef37e7b2bb72bf-Paper-Conference.pdf)
  show its potential, but the real physician is the higher-value next actor.
  Reconsider it after physician feedback, adaptive questioning, or an observed
  behavior worth replaying.
- Broad adapter matrices, property-based testing, mutation testing, an LLM
  judge, a large eval corpus, scheduled model runs, a visual-regression service,
  multiple browsers/viewports, load testing, and production monitoring.
- Browser tests for the deferred model/PDF failure UI.

Deterministic regression tests should be added later when a real defect is found
and a small test can prevent its return. The suite grows from evidence, not from
a desire to look complete before anyone has used the product.

## Approval consequence

Approval makes this the complete verification requirement for getting
Experiment 1 in front of one physician. The deployment preflight is now
approved and the identified planning topics are closed. Steve's explicit
implementation go-ahead is still required before work begins.

### Approval record

On 2026-09-04, Steve approved the simplified doctor-first strategy, including
the minimum automated evidence, early formative physician session, explicit
deferrals, and the rule that pre-physician work must protect integrity, enable
the complete journey, or make the physician's feedback interpretable. Steve
also approved the later trace assertions enforcing Experiment 1's one-question
budget on 2026-09-04.
