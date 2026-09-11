# Wilson Experiment 2

**Status:** Complete with a `Revise` disposition and remediation deferred. Stage 3 completed in
PR #52, Issue #53 refocused the outcome on conditional reliability, and Issue
#55 preserves the live-model limitation and explicit revisit triggers. No
immediate remediation or further Experiment 2 model sampling is planned.

**Owns:** The single bounded investment decision, its separate evidence
dimensions, the production-seed quality bar, supported and deferred scope,
exact synthetic journeys, evidence, staged live-model policy, success and
stopping criteria, and lean implementation sequence

**Depends on:** [`PRODUCT.md`](PRODUCT.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md), and
[`DELIVERY.md`](DELIVERY.md)

## Decision and evidence dimensions

Experiment 2 answers one falsifiable investment question:

> Does evidence from the bounded synthetic journeys justify further Wilson
> investment after accounting separately for technical generalization,
> model/evidence reliability, assembled operator viability, and the remaining
> clinician validation boundary?

Steve reports that preliminary physician feedback obtained before this
experiment already established a strong preference for Wilson's approach if it
works. Experiment 2 accepts that as directional evidence about the conditional
product proposition; it does not treat the feedback as a study of this build,
proof of clinician usability, or production-readiness evidence. Repeating the
comparison through Steve would be a weaker proxy for an already-answered
question. The remaining investment question is whether Wilson can satisfy the
condition reliably enough to warrant broader product work.

Record four evidence dimensions separately:

1. **Technical generalization and production-seed quality:** can one
   production-quality implementation run the selected medication journeys
   without fixture, medicine, expected-value, or authored-sequence behavior in
   runtime product code, while leaving maintainable seams for the supported
   scope?
2. **Model and evidence performance:** can the bounded model contract discover
   and attach supported facts and exact evidence without an answer catalog?
3. **Assembled operator viability:** can Steve complete the selected journeys
   with intelligible evidence, proportionate review burden, acceptable latency,
   and recoverable failure when the model is wrong?
4. **Clinician validation boundary:** what remains unproven until a separately
   approved, sufficiently complete product is evaluated by representative
   clinicians?

The investment decision considers all four dimensions without treating them as
interchangeable. Experiment 2 is not a production release by accumulation, but
every accepted runtime change must meet the approved production-seed quality bar
for the declared adult medication adverse-event scope rather than become
disposable experiment scaffolding.

### Authority reconciliation

Issue #42 requires a stop and return for direction if the minimum experiment
would require production or real-data architecture. During planning on
2026-09-08, Steve explicitly decided that any further experiment must both
answer its decision question and evolve the codebase toward production-quality
code, then authorized the corresponding plan revision and this reconciliation.

That decision sets a code-quality and reuse bar inside the bounded experimental
scope. Together with Delivery's standing execution authority, this plan now
authorizes its remaining in-scope implementation and synthetic evaluation
without per-stage permission. It does not authorize production infrastructure
or release, durable data, real clinical data, external participation, or
broader product scope. Here, `production-seed` means maintainable shared domain
and workflow seams retained after the experiment; the temporary preview,
synthetic diagnostic, and browser-held-state adapters remain temporary by
design.

## Experiment 1 input

Experiment 1 established that the semantic case, one authoritative write
boundary, proposal-before-acceptance rule, correction history, explicit
conflict resolution, and case-to-PDF projection can work together in a
protected real-model browser journey.

It did not establish general reliability or whether the current build satisfies
the condition in the reported preliminary physician preference. Its
implementation remained coupled to one product catalog and authored sequence.
Exact source localization was inaccurate under Issue #39, model latency was
noticeable, and the repeated remediation needed to complete one journey created
a real risk that the system would generalize poorly.

Experiment 2 treats those results as evidence, not assumptions to defend.

## Outcome

Produce one of three explicit investment decisions and record the four evidence
dimensions above independently:

1. **Continue:** after the permitted bounded remediation, the required model
   samples expose no recurring material instability, the assembled workflow is
   viable for the operator, the retained code is a credible production seed,
   and no architectural premise is falsified; propose the next
   product-completeness step.
2. **Revise:** the product signal remains plausible, but one named premise needs
   another bounded experiment before broader implementation. That experiment
   may be deferred until a named revisit trigger is reached.
3. **Stop:** Wilson requires case-specific runtime behavior, repeats a general
   semantic failure after one bounded remediation, imposes operating friction
   that defeats the conditional value, or leaves no credible production seed.

No outcome authorizes physician involvement, real clinical data, production
deployment or release, or the broader V1 roadmap.

### Final disposition — 2026-09-09

Experiment 2 ends `Revise`, with remediation deferred:

1. **Technical generalization and production-seed quality — qualified pass.**
   The state-driven browser application and one authoritative semantic case ran
   all selected deterministic journeys plus the Experiment 1 regression through
   aligned reviewed output and PDF without runtime fixture or oracle behavior.
2. **Model and evidence reliability — revise.** Two protected journeys were
   semantically viable. The rich journey safely rejected a target/value shape
   error, and its returned response also confused event treatments with
   concomitant report products. This bounded sample is insufficient to claim
   reliability.
3. **Assembled operator viability — qualified pass.** Steve completed the
   viable sparse and repeated journeys, including an additional correction and
   explicit conflict resolution. The rich failure was recoverable but prevented
   completion; live opening latency ranged from about 11 to 36 seconds. The
   viable live PDF routes returned successfully, but their bytes were not
   retained for independent agreement readback; Stage 3 supplies the retained
   deterministic PDF-agreement evidence.
4. **Clinician validation boundary — unchanged.** Steve reports strong
   preliminary physician preference for Wilson if it works. That directional
   evidence removes the need for an operator direct-form proxy but does not
   validate this build or authorize new participation.

Steve chose not to tune the prompt or redesign the provider schema against this
single failed sample. Issue #55 retains the exact limitation, impact, and
revisit triggers. Later product planning may proceed independently, but it may
not assume live extraction reliability or expand live model use on the strength
of this result. The sanitized Stage 4 observation record is retained in
[`evidence/experiment-2/stage-4/README.md`](../evidence/experiment-2/stage-4/README.md).

## Operators and information boundary

Steve and Codex are the only experiment operators. All people, identifiers,
events, products, and outcomes are fictional. No physician or other external
participant is involved in Experiment 2; the preliminary feedback reported by
Steve predates it and authorizes no new participation.

The protected Vercel preview remains non-production and synthetic-limited to
approved synthetic cases. Browser-held state and transient Runtime Logs retain
the Experiment 1 limitations. No case persistence, log drain, analytics,
session replay, or additional diagnostic store is added.

## Supported scope

- Adult medication adverse-event reports.
- One or two suspect medicines and at most one concomitant medicine.
- The existing typed patient, event, treatment, outcome, and product facts
  exercised by the selected journeys; no broader clinical ontology.
- Form FDA 3500 Sections A, B, D, and F already supported by the semantic
  projection and versioned PDF adapter.
- Natural opening input, case-oriented review, a small number of consequential
  follow-ups, correction or uncertainty where the selected journey requires it,
  explicit acceptance, output inspection, PDF preview, and download.
- Desktop Chromium and the existing protected Git-preview workflow.
- The completed Experiment 1 fixture as a regression for semantic identity,
  correction, conflict, projection, and final PDF agreement, not its authored
  stage order or fixed pre-resolution download gate.

## Exact synthetic journeys

These are the only three new evaluation journeys. They are deliberately concise,
fictional, and reviewed only by the experiment operators. Their texts, expected
results, and identifiers remain outside runtime product behavior.

### Rich single-product journey

Opening account:

> Patient TEST-68 is a 68-year-old man. He began cephalexin 500 mg by mouth
> twice daily on 01-Aug-2026 for cellulitis. On 04-Aug-2026 he developed diffuse
> hives and facial swelling and was hospitalized. Cephalexin was stopped, he was
> treated with epinephrine and diphenhydramine, and he recovered and was
> discharged on 05-Aug-2026. I suspect cephalexin.

Wilson preserves one suspect product and all stated patient, event, treatment,
outcome, and product facts; asks no follow-up; and produces an aligned reviewed
case and PDF.

### Sparse and explicitly unknown journey

Opening account:

> Patient TEST-31 is a 31-year-old woman. She developed nausea and vomiting
> while taking metformin. I suspect metformin. She does not know the dose, when
> metformin began, or when the symptoms started. She was not hospitalized.

Wilson preserves the dose, product start, and event onset as explicitly unknown,
not empty or absent. It asks exactly one indication question. The operator marks
the indication unknown through an attributed semantic control; Wilson does not
ask again. Outcome, treatment, and stop information remain empty. Review and
output explain the omissions, and the partial PDF remains available after all
proposals have been reviewed.

### Repeated alias, correction, and unresolved conflict journey

Opening account:

> Patient TEST-44 is a 44-year-old man. He began acetaminophen (Tylenol) 1,000 mg
> by mouth twice daily on 01-Jul-2026 for back pain and ibuprofen 400 mg by mouth
> twice daily on 03-Jul-2026 for back pain. On 05-Jul-2026 he developed nausea
> and right upper abdominal pain and was hospitalized. Tylenol and ibuprofen
> were stopped, he received intravenous fluids, and he recovered and was
> discharged on 07-Jul-2026. I suspect acetaminophen and ibuprofen.

Later update:

> Correction: the ibuprofen dose was 200 mg twice daily, not 400 mg twice daily.
> My medication list says acetaminophen began 02-Jul-2026 rather than
> 01-Jul-2026. I cannot resolve which date is correct.

Wilson represents acetaminophen and Tylenol as one stable product, preserves
ibuprofen as the other product, asks no follow-up because both indications are
known, and proposes the later update against the correct stable entities. The
operator explicitly accepts 200 mg, leaving 400 mg only in history, and leaves
the two acetaminophen dates unresolved. Neither date reaches the projection;
the conflict remains visible and does not block the truthful partial PDF.

Scenario texts and expected semantic results are evaluation inputs outside
Wilson. They do not become runtime allowlists,
prompt catalogs, stage definitions, or product configuration. Operators paste
the text into the ordinary input. A temporary synthetic diagnostic adapter may
recognize environment-configured fixture digests solely to decide whether
synthetic content may be logged; those digests never affect product behavior or
semantic validation.

Across all three oracles, every explicitly stated material fact representable
by the supported types is proposed once with the correct entity and exact
self-contained evidence; no unstated fact is proposed. Routine normalization
uses ISO dates and `oral` for “by mouth” without changing meaning. The detailed
expected values stay in test/evidence fixtures rather than the model request or
runtime validation.

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
- New physician feedback or any external-participant study.

## Production-seed implementation

Every accepted implementation slice must leave behind maintainable product
code for the supported scope. Runtime product code must not import or recognize
fixture text, scenario identifiers, medicine names, expected values, oracle
data, or predetermined journey numbers. Each slice removes more fixed behavior
than it adds; it may not preserve the current journey behind a scenario switch.

Generalize only the seams required for the selected journeys to use the same
product behavior:

- product, proposal, group, source, and command identities cannot be restricted
  to the Experiment 1 medicine names;
- the application owns stable opaque case entity IDs; the model proposes mention
  grouping and refers to application-supplied IDs on later inputs, but product
  names never become identity;
- the model prompt and structured schema must describe the selected domain
  shape without supplying a case-specific answer catalog;
- review, clarification, correction, removal, conflict, and output controls
  must derive labels and targets from semantic case state rather than named
  products or expected values;
- journey stage and action availability must derive from pending proposals,
  unanswered consequential needs, requested updates, correction/conflict
  attention, and output readiness rather than a prescribed turn sequence;
- the indication follow-up uses one question with one labelled semantic answer
  control per target product plus explicit unknown and declined choices; those
  values enter through `applyCaseCommand` without a model call;
- deterministic follow-up selection may cover only the few consequential needs
  exercised by the approved journeys and must not become a general planner;
- the existing semantic case, `applyCaseCommand`, projection boundary, and PDF
  adapter remain authoritative unless evidence falsifies them; and
- browser-held storage, protected preview access, and synthetic diagnostics stay
  isolated behind their existing temporary adapters and do not become
  production architecture.

Do not build a scenario framework merely to avoid three small fixture
definitions. Conversely, do not implement three parallel hard-coded journeys.
Fixture definitions and external oracle data live only in tests and retained
evaluation evidence; product behavior operates only on the semantic case.

### Partial-output rule

For these journeys, output remains unavailable while opening proposals or a
proposed correction await review. An empty, explicitly unknown, declined, or
conflicted optional fact is omitted with its semantic reason and does not block
preview or download once the review decisions are complete. Conflicting
alternatives never project. At least one accepted suspect product with an
accepted name and role, the accepted adverse-event report type, and at least one
accepted fact contributing to the Section B event description are required for
output. This Experiment 2 rule replaces the Experiment 1 fixture's authored
pre-resolution `409` gate; it does not claim a complete Form 3500 validation
policy.

## Source evidence and Issue #39

Source evidence is part of the reliability question because the operator must be
able to detect loss, invention, and wrong attribution. Experiment 2 implements
and verifies the smallest general remedy for Issue #39 before any protected
live reliability run.

The model returns the exact verbatim supporting text, not character offsets.
Deterministic code accepts a quotation only when it has one exact non-empty
occurrence in the originating input and then records that occurrence's offsets.
An absent or ambiguous quotation rejects the proposal batch before attachment,
shows a recoverable evidence-localization failure, and leaves accepted case
knowledge unchanged. Exact occurrence proves only where the clinician's words
appear; the operator still judges whether they semantically support the
proposal. Stop and reconcile if this small method requires fuzzy search, broad
normalization, fixture-specific correction, or another evidence store.

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
Operator judgment—not runtime validation—determines semantic and assembled
operator-viability success.

## Evidence sequence

### Stage 1: production model/evidence boundary

Before any paid model call:

- implement Issue #39's exact-quotation anchoring, application-owned stable
  product identity, a case-agnostic model schema, and generic reviewed-case
  context for later inputs;
- remove the fixed proposal catalogs and fixed-input rejection from production
  behavior;
- prove exact, absent, and ambiguous quotation handling and generic entity
  attachment with focused deterministic tests; and
- prove production modules cannot import fixture or oracle definitions.

After implementation evidence and the required standard review are complete,
run the early live gate within Delivery's standing synthetic-model authority
and the narrower cap defined for the gate.

### Stage 2: early live model/evidence gate

Use the production model and case boundaries on the rich opening and the
repeated-product opening plus its later update: two cases and three calls total.
Use the smallest existing operator runner; build no evaluation framework or
temporary application path. The model receives no scenario oracle or catalog.
Disable automatic retries and stop on the first material semantic failure or
architectural falsification. Record the ordinary model metadata and one
sanitized verdict per run. Passing establishes only that the core
boundary is viable enough to justify assembled-product implementation.

#### Stage 2 disposition — 2026-09-09

Stage 2 is complete as a qualified result. Across the initial three-call batch
and one stopped confirmation call, the generalized model and case boundaries
produced the selected patient, event, product-identity, correction, and
unresolved-alternative behavior without an answer catalog in runtime. The
initial rich opening omitted the modifier `diffuse`; the one authorized general
prompt/schema remediation preserved it on confirmation.

Exact quotations nevertheless remained dependent on nearby context in some
places. In particular, patient and event excerpts using pronouns such as `he`
did not independently name the patient, and the initial repeated-product date
excerpt omitted the adjacent sentence that established unresolved uncertainty.
The complete observations, metrics, costs, and stopped confirmation are
retained in
[`../evidence/experiment-2/stage-2/result.md`](../evidence/experiment-2/stage-2/result.md).

Steve accepts this as a known, non-blocking limitation for proceeding toward
the remaining synthetic operator experiment. It is not an unqualified model or
evidence pass and does not waive the issue for future external-participant,
clinical, or production readiness. No further Stage 2 prompt iteration or live
model call is planned. Reconsider the limitation only if the assembled workflow
causes practical evidence confusion or wrong attribution, or when a later
readiness decision makes independently understandable evidence necessary. This
disposition did not itself authorize Stage 3 implementation at that checkpoint.
Remaining in-scope implementation now proceeds under Delivery's standing
authority; external participation, real data, production deployment, and
release remain outside it.

The separately authorized narrow final review of `54c0211...65c7dca` reported
no blockers and two non-blocking follow-ups confined to the completed one-time
runner recovery. Their durable dispositions defer work unless that recovery
mechanism is reused; see
[`../evidence/experiment-2/reviews/65c7dca/dispositions.md`](../evidence/experiment-2/reviews/65c7dca/dispositions.md).

### Stage 3: deterministic assembled product

Replace the fixed journey service and UI with state-driven product behavior,
then run the three new journeys and the retained Experiment 1 semantic
regression end to end with predetermined model responses. Exercise the selected
clarification, unknown/declined controls, change/remove, correction, conflict,
partial-output, projection, preview, and download behavior. Verify case, screen,
projection, and PDF agreement and prove no runtime product behavior imports an
oracle. Use focused tests and one desktop browser path; add no coverage regime,
browser matrix, visual-regression system, or broad failure suite.

#### Stage 3 disposition — 2026-09-09

Stage 3 completed in PR #52. One state-driven application ran all three new
journeys and the retained Experiment 1 regression through review, correction,
conflict, projection, preview, and PDF using predetermined responses. Focused
tests, one desktop Chromium path, independent PDF readback, and the required
standard review passed. This established assembled mechanics and
production-seed quality, not live-model reliability.

### Stage 4: protected live operator evidence

After assembled implementation evidence and the required standard review, run
each new journey once through the protected preview within Delivery's standing
synthetic-model limits. Stop the affected path on a material semantic failure or
architectural falsification. If all first passes remain viable and the remaining
issue budget fits, run one additional independent sample of each journey. The
second samples are required for a Continue decision but unnecessary for an
earlier Revise or Stop decision.

For every run, record model, prompt/schema revision, parameters,
token use, latency, estimated cost, operator corrections, and a sanitized final
verdict. Zero observed failures in this sample establishes no general failure
rate or clinical reliability.

#### Stage 4 first-pass disposition — 2026-09-09

The sparse and repeated journeys produced semantically viable reviewed output.
The rich journey was safely rejected because `symptoms` arrived as a scalar
instead of a list; the same response also treated acute event treatments as
concomitant products. Accepted case knowledge remained unchanged. The overall
first-pass result is `Revise`; no second samples ran.

Steve deferred remediation rather than tune the prompt or redesign the provider
schema against one failed sample. Issue #55 preserves both failure classes and
reopens work only if another independently valuable journey exposes the same
class, a selected product investment requires live extraction, or Wilson
approaches external evaluation, clinical-data approval, or production
readiness. Any later remediation remains limited to one general attempt;
recurrence stops the affected direction.

### Stage 5: outcome decision

The final disposition above records the four dimensions and chooses `Revise`,
with remediation deferred. No Steve-versus-form comparison, immediate
remediation, or second live sample is required. The reported preliminary physician preference
supplies directional evidence for the conditional product proposition; the
completed synthetic journeys show that this implementation has not yet
established its reliability condition. This remains operator evidence, not
validation of clinician use or production readiness.

## Success

Continue beyond Experiment 2 only if:

1. If the deferred reliability direction is reopened, no confirmation or
   required second sample invents a material fact, silently loses one, assigns
   it to the wrong entity or role, hides incompatible evidence, or disagrees
   with the final PDF.
2. Every journey reaches a truthful reviewed output through production-seed
   code containing no fixture-, medicine-, oracle-, or sequence-specific
   product behavior.
3. Sparse and uncertain information remains visibly partial; Wilson does not
   interrogate optional blanks or invent completion.
4. Evidence lets the operator identify the subject and claim without trusting
   proposal metadata.
5. The required second samples introduce no material instability; this is
   recorded as bounded observation rather than a reliability claim.
6. Steve can complete each selected journey without review burden or failure
   handling that makes the conditional physician preference implausible.
7. Latency is acceptable to Steve for the demonstrated value; exact observed
   latency is recorded rather than optimized speculatively.
8. The retained implementation is a credible production seed for the supported
   scope and the result justifies a specific next product-completeness
   investment.

Record technical generalization and production-seed quality, model/evidence
reliability, assembled operator viability, and the eventual clinician-validation
boundary separately. Do not collapse them into one score or allow one dimension
to substitute for another.

## Stop and reconcile

Stop the affected slice and return for a premise decision if:

- supporting any case requires product-name, scenario, expected-value, fixture,
  or predetermined-sequence branches in runtime product behavior;
- the semantic case or one write boundary cannot represent a selected journey
  without duplicated authority;
- exact evidence requires fragile model-calculated offsets, fuzzy matching, or
  another store;
- a material invention, silent loss, wrong-entity attachment, hidden conflict,
  or case/PDF disagreement occurs;
- the same general failure recurs after one bounded remediation;
- useful output requires a general question planner, ontology, full Form 3500
  expansion, deferred production infrastructure, or real data; or
- assembled review burden, latency, or failure handling defeats the conditional
  value reported in the preliminary physician feedback.

Ordinary local defects may be fixed once with focused recurrence evidence.
Do not accumulate scenario-specific patches to save the experiment.

## Value discipline

Every planned activity must directly protect a Product invariant, enable one of
the selected journeys through shared production code, resolve an observed
failure, or answer the investment decision. Otherwise defer it. Do not add a
generic workflow engine, general question planner, broad domain model, eval
platform, browser matrix, visual-regression service, load work, analytics,
persistence, speculative performance optimization, unrelated refactoring, or
preview-infrastructure polish. Repeated review or live runs require a new
decision question; Codex may execute it under Delivery's standing authority
when it remains within existing premises and spending limits.

## Proposed delivery slices

1. **Completed planning change:** documentation-only Issue #42/PR #43 defines
   the exact journeys, production-seed contract, evidence order, and stopping
   rules. It makes no application or model call.
2. **Completed core boundary slice:** resolve Issue #39 while generalizing source
   evidence, model input/output, stable identity, and later-input context. Run
   deterministic evidence, the required standard review, and only then the
   bounded early live gate.
3. **Assembled product slice:** replace fixed orchestration and UI with
   state-driven behavior, then complete deterministic browser-to-PDF evidence
   for all cases and the required standard review.
4. **Completed conditional-reliability outcome:** record the first protected
   samples and the separate findings, then close `Revise`, with remediation
   deferred, without immediate remediation or further sampling. Issue #55 preserves any later
   bounded revisit independently of Experiment 2 completion.

Each implementation slice uses one coherent issue, branch, draft PR,
proportional evidence, and Delivery's objective merge controls. Pure
evidence/outcome work retains a durable issue/PR record but requires no
automatic independent review when it changes no behavior or governing premise.
A failed premise stops later work. Do not split work further unless an
independently valuable defect or decision cannot be resolved coherently inside
its slice.

## Review and execution authority

Issue #42 and PR #43 define the plan; Issue #49 applies Delivery's standing
execution authority to its remaining work. Codex may create and complete the
named implementation issues, run required standard Sonnet reviews, exercise
protected synthetic preview, and make bounded synthetic application-model
calls without repeated permission. Ordinary defects and their remediation stay
inside the slice; the pull request records the complete outcome and remaining
risk before Codex merges it under Delivery's objective controls.

Issue #53 records Steve's conditional-reliability refocus. Steve explicitly
waived independent review for that minor documentation correction only. The
waiver does not apply to the subsequent model-contract remediation, which
requires the ordinary standard review.

Issue #55 records Steve's later decision to defer that remediation and complete
Experiment 2 as `Revise`. Any future work triggered from #55 is a new
unit under Delivery. Its approved issue must define a new bounded sample rather
than inherit Experiment 2's historical sample design; once defined, Delivery's
ordinary execution and merge authority applies.

Delivery exclusively owns development execution and merge authority. This
completed experiment does not define future physician participation, real
clinical data, or production deployment/release; those remain outside its
scope. Historical Stage 2 authorization records remain accurate.
