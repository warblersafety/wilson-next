# Wilson Experiment 2

**Status:** Draft under Issue #42; planning and review only, not implementation
authority

**Owns:** The operator-only generalization/usefulness decision, supported and
deferred scope, candidate journeys, evidence, staged live-model policy, success
and stopping criteria, and proposed implementation sequence

**Depends on:** [`PRODUCT.md`](PRODUCT.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md), and
[`DELIVERY.md`](DELIVERY.md)

## Decision question

Can Wilson generalize beyond one scripted case across a deliberately small set
of synthetic medication adverse-event journeys while remaining factually
faithful, reviewable, and less burdensome than completing the supported Form FDA
3500 content directly?

The experiment exists to decide whether Wilson deserves further product
investment. It is not a path to production by accumulation.

## Experiment 1 input

Experiment 1 established that the semantic case, one authoritative write
boundary, proposal-before-acceptance rule, correction history, explicit
conflict resolution, and case-to-PDF projection can work together in a
protected real-model browser journey.

It did not establish general usefulness. The implementation remains coupled to
one product catalog and authored sequence. Exact source localization remains
inaccurate under Issue #39, model latency is noticeable, and the repeated
remediation needed to complete one journey creates a real risk that the system
generalizes poorly.

Experiment 2 treats those results as evidence, not assumptions to defend.

## Outcome

Produce one of three explicit decisions:

1. **Continue:** the bounded journeys show a repeatable operator advantage and
   no architectural falsification; propose the next product-completeness step.
2. **Revise:** the product signal remains plausible, but one named premise needs
   another bounded experiment before broader implementation.
3. **Stop:** Wilson requires case-specific branching, produces unacceptable
   semantic failures, or does not reduce effort enough to justify continued
   investment.

No outcome authorizes physician involvement, real clinical data, production,
or the broader V1 roadmap.

## Operators and information boundary

Steve and Codex are the only experiment operators. All people, identifiers,
events, products, and outcomes are fictional. No physician or other external
participant is involved.

The protected Vercel preview remains non-production and synthetic-limited to
approved synthetic cases. Browser-held state and transient Runtime Logs retain
the Experiment 1 limitations. No case persistence, log drain, analytics,
session replay, or additional diagnostic store is added.

## Supported scope

- Adult medication adverse-event reports.
- One or two suspect medicines and at most one concomitant medicine.
- The currently typed patient, event, treatment, outcome, and product facts.
- Form FDA 3500 Sections A, B, D, and F already supported by the semantic
  projection and versioned PDF adapter.
- Natural opening input, case-oriented review, a small number of consequential
  follow-ups, correction or uncertainty where the selected journey requires it,
  explicit acceptance, output inspection, PDF preview, and download.
- Desktop Chromium and the existing protected Git-preview workflow.
- The completed Experiment 1 journey as a deterministic regression, not a new
  usefulness sample.

## Candidate synthetic journeys

Finalize exactly three new journeys during the first planning slice. Each must
be medically plausible enough to exercise the product but remains fictional and
is reviewed only as an experiment fixture.

1. **Information-rich single suspect medicine.** Most supported report facts
   are already present. This tests whether Wilson preserves detail and avoids
   wasteful questions.
2. **Sparse or uncertain report.** Important information is missing, qualified,
   declined, or unresolved. This tests whether Wilson asks only questions that
   earn their turn and produces truthful partial output rather than inventing
   completeness.
3. **Repeated or easily confused product mentions with a later correction.**
   This tests stable entity attribution, correction history, and whether review
   remains understandable without fixture-specific product logic.

Scenario texts, expected semantic results, and direct-form comparison material
are evaluation inputs outside Wilson. They do not become runtime allowlists.

## Deferred scope

- Devices, Section E, reporter Section G, biologics-specific expansion, and
  product-problem-only or medication-error-only reports.
- Pregnancy, congenital, death, no-patient, pediatric, and more-than-two-
  suspect-product paths.
- Arbitrary Form 3500 input or a claim of general coverage.
- Model-generated free-form question planning.
- Accounts, durable sessions, collaboration, submission, analytics, EHR/FHIR
  integration, or real clinical data.
- Mobile, multiple browsers/viewports, broad accessibility certification,
  performance/load infrastructure, or production monitoring.
- A general dialogue engine, ontology, knowledge graph, event store, or reusable
  evaluation platform.
- Physician feedback or any external-participant study.

## Minimum product generalization

The implementation may generalize only the seams that prevent the three
approved journeys from using the same product behavior:

- product, proposal, group, source, and command identities cannot be restricted
  to the Experiment 1 medicine names;
- the model prompt and structured schema must describe the selected domain
  shape without supplying a case-specific answer catalog;
- review, clarification, correction, removal, conflict, and output controls
  must derive labels and targets from semantic case state rather than named
  products or expected values;
- deterministic follow-up selection may cover only the few consequential needs
  exercised by the approved journeys and must not become a general planner;
- the existing semantic case, `applyCaseCommand`, projection boundary, and PDF
  adapter remain authoritative unless evidence falsifies them; and
- synthetic diagnostics may recognize only the approved fixture inputs while
  continuing to redact all other content.

Do not build a scenario framework merely to avoid three small fixture
definitions. Conversely, do not implement three parallel hard-coded journeys.
A small data definition may own fixture text and external oracle data; product
behavior must operate on the semantic case.

## Source evidence and Issue #39

Source evidence is part of the usefulness question because the operator must be
able to detect loss, invention, and wrong attribution. Experiment 2 must choose
and verify the smallest general remedy for Issue #39 before protected live
usefulness runs.

The model should identify supporting text, not perform fragile character
arithmetic as a semantic task. Deterministic code may locate an exact returned
excerpt in the originating input and reject only empty, absent, or ambiguous
matches. The final design must preserve honest verbatim evidence without
turning semantic support into a deterministic hallucination guard.

This paragraph states the required responsibility boundary, not approval for a
specific matching algorithm. The implementation slice must select a small
method and stop if reliable anchoring requires fuzzy search, broad normalization,
or another evidence store.

## Runtime validation and evaluation

Runtime validation remains limited to mechanically provable failures:

- provider or transport did not complete normally;
- structured output cannot be parsed;
- a field or value cannot be represented by the selected domain;
- referenced entities or sources do not exist or are type-incompatible;
- identities are duplicated or internally inconsistent; or
- evidence is empty or cannot be anchored to the originating input.

Runtime code does not compare model proposals with a scenario answer key,
silently repair semantic output, or reject a representable proposal because an
oracle expected another value.

Each scenario has an external, human-readable assessment covering expected
facts, entity/role attribution, evidence support, consequential omissions,
questions, correction/history, unresolved truth, and projected PDF values.
Operator judgment—not runtime validation—determines semantic and usefulness
success.

## Evidence sequence

### Stage 1: deterministic assembly

Before any paid model call:

- preserve the complete Experiment 1 journey as a regression;
- run each new journey end to end with predetermined model responses;
- exercise every selected clarification, change/remove, correction, conflict,
  partial-output, projection, preview, and download path;
- verify case, screen, projection, and PDF agreement; and
- prove that no application behavior imports scenario oracle values.

Use focused tests and one desktop browser path. Do not create a coverage regime,
browser matrix, visual-regression system, or broad failure suite.

### Stage 2: first live pass

After separate authorization of an exact case/call budget, run each of the three
new journeys once through the protected preview. Disable automatic retries and
stop the batch on a material semantic failure or architectural falsification.
Record model, prompt/schema revision, parameters, token use, latency, estimated
cost, operator corrections, and the sanitized final verdict.

### Stage 3: variability pass

Only if all first-pass journeys remain viable, request separate authorization
to run one additional independent sample of each journey. This staged design
avoids spending additional calls to reconfirm an already failed premise.

### Stage 4: direct-form comparison

Steve completes the supported content for the information-rich and sparse cases
both through Wilson and directly in Form 3500. Record elapsed time, avoidable
questions or corrections, review burden, output completeness, and a plain-
English preference. This is formative operator evidence, not a usability study
or statistical claim.

## Success

Continue beyond Experiment 2 only if:

1. No retained live run invents a material fact, silently loses one, assigns it
   to the wrong entity or role, hides incompatible evidence, or disagrees with
   the final PDF.
2. Every journey reaches a truthful reviewed output without case-specific
   product behavior.
3. Sparse and uncertain information remains visibly partial; Wilson does not
   interrogate optional blanks or invent completion.
4. Evidence lets the operator identify the subject and claim without trusting
   proposal metadata.
5. The repeat samples introduce no material instability.
6. In both direct-form comparisons, Wilson provides a clear reduction in total
   effort or a comparably valuable reduction in omission/distortion risk
   without adding greater review burden.
7. Latency is acceptable to Steve for the demonstrated value; exact observed
   latency is recorded rather than optimized speculatively.
8. The result justifies a specific next product-completeness investment.

Do not collapse these dimensions into one score.

## Stop and reconcile

Stop the affected slice and return for a premise decision if:

- supporting the second or third case requires product-name, scenario, or
  expected-value branches in application behavior;
- the semantic case or one write boundary cannot represent a selected journey
  without duplicated authority;
- exact evidence requires fragile model-calculated offsets, fuzzy matching, or
  another store;
- a material invention, silent loss, wrong-entity attachment, hidden conflict,
  or case/PDF disagreement occurs;
- the same general failure recurs after one bounded remediation;
- useful output requires a general question planner, ontology, full Form 3500
  expansion, production architecture, or real data; or
- direct-form comparison shows no meaningful operator advantage.

Ordinary local defects may be fixed once with focused recurrence evidence.
Do not accumulate scenario-specific patches to save the experiment.

## Proposed delivery slices

1. **Slice 0 — fixtures and responsibility boundaries:** finalize the three
   synthetic journeys and external oracles; choose the Issue #39 evidence
   responsibility; map fixed-case coupling; make no application or model call.
2. **Slice 1 — minimum generalization:** remove only the named-product/catalog
   seams required by the approved journeys; preserve the semantic case and one
   write boundary; verify mechanically with focused tests.
3. **Slice 2 — assembled multi-case browser/PDF journeys:** implement the
   selected questions and difficult states, then complete deterministic
   browser-to-PDF evidence for all cases.
4. **Slice 3 — staged protected live operator pilot:** run the separately
   authorized first samples, optional variability samples, and direct-form
   comparisons; produce the continue, revise, or stop decision.

Each slice uses its own issue, branch, draft PR, proportional evidence, and
explicit merge approval. A failed premise stops later slices.

## Review and authorization

Issue #42 and its documentation-only PR define the plan. Because the plan
changes product and experiment authority, one standard fresh-context Claude
Sonnet/high review of the complete planning diff is required after Steve
separately authorizes it. Resolve blocking findings before asking Steve to
approve this document.

Approval of this plan would authorize only creation of the named Experiment 2
implementation issues. Each implementation slice still requires Steve's
explicit go-ahead. Live model batches, physician involvement, real clinical
data, production deployment, paid-plan purchase, and expanded scope require
their own explicit authorization.
