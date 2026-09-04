# Wilson recovery brief

**Status:** Confirmed by Steve on 2026-09-04  
**Recovery repository:** `warblersafety/wilson-next`  
**Prepared:** 2026-09-04  
**Phase:** Product and UI/UX recovery definitions confirmed; architecture and implementation not started

This brief is the governing handoff for Wilson's recovery. It records the
product intent, conclusions, decisions, constraints, evidence, and open
questions that must survive beyond chat history. It does not select a detailed
architecture, implementation plan, framework, provider, or first slice.

The labels below are deliberate:

- **Decision** means Steve explicitly agreed to it in the prior recovery task
  or established it in the current request.
- **Evidence-backed conclusion** is the best current reading of inspected
  evidence. It may change if better evidence appears.
- **Working hypothesis** is promising but unvalidated.
- **Open** means a decision or discriminating investigation is still required.

No hypothesis in this document becomes a decision merely because it is written
here. Material changes to a decision require an explicit write-back and Steve's
confirmation.

## Intended outcome

**Decision.** Wilson is a clinician-facing aid for completing voluntary
adverse-event reports on Form FDA 3500. It should let a clinician describe what
they know naturally, preserve that knowledge and its uncertainty, ask only
useful follow-up questions, support review and correction, and produce a form
the clinician can inspect and submit.

Wilson must be meaningfully easier and less error-prone than completing the
form directly. It is not a diagnostic, clinical classification, submission, or
long-term record system unless later scope decisions explicitly change that.

The recovery is successful only when a production-shaped assembled product—not
just its components—demonstrates a concise, natural clinician journey and a
faithful, traceable Form 3500 output.

## Recovery verdict

### What failed

**Evidence-backed conclusion.** Legacy Wilson deliberately made the PDF's 227
widgets its canonical record. Model proposals, conversation state, follow-up
logic, review, completion, and export all accumulated around that field-keyed
record. The code largely implemented the governing design correctly; this was
primarily a design and sequencing failure, not a good design implemented badly.

The intended problem shape was:

```text
clinician account
  -> facts, entities, evidence, uncertainty, and conflicts
  -> evolving case knowledge
  -> one or more output projections, including Form FDA 3500
```

Wilson instead centered:

```text
clinician account
  -> proposals for PDF field identifiers
  -> 227-field Agenda record
  -> Form FDA 3500
```

The field inventory and thin exporter were locally useful. Making their output
schema the shared knowledge model made repeated entities, provenance,
uncertainty, correction, conflict, applicability, and mutually exclusive facts
awkward or unrepresentable. Recovery then rebuilt those semantics in separate
paths without replacing the core.

Three failure classes must remain distinct because they require different
remedies:

1. **Representation:** the record could not naturally express knowledge such
   as repeated entities, `none` versus `unknown`, pending conflicts, evidence,
   and confirmation.
2. **Elicitation:** form-field structure leaked into robotic wording, repeated
   asks, excessive turns, and raw implementation vocabulary.
3. **Enforcement:** consequential invariants were implemented in several write
   paths and repeatedly escaped. A better semantic model alone would not have
   fixed this.

### How the producing process failed

**Evidence-backed conclusion.** sofa-claude created bounded, traceable work and
found many real implementation defects, but optimized confidence around local
units. It did not reliably establish that the foundational specification
modeled the right product or that accepted units composed into a usable whole.

The most consequential process failures were:

- product intent and operator challenges stated in conversation did not
  reliably become governing authority or premise-reopen conditions;
- bootstrap combined discovery, design, review, repository setup, and
  foundational implementation before representative journeys had constrained
  the model;
- reviews tested conformance and document consistency more reliably than the
  architectural premise;
- frozen acceptance criteria made local patches easier than invalidating a
  shared premise;
- semantic authority migrated into files and code paths outside the review
  routing that matched its importance;
- per-unit tests and reviews substituted for assembled-product evidence;
- real-model and deployed-product contact arrived late in the formal proof;
- findings and recommendations could be recorded without an execution owner.

The operator had explicitly warned against a form walker, called for maximum
information per turn, described an internal knowledge structure that would
eventually populate the form, questioned upstream review, and resisted patches
that might hide a root cause. The process acknowledged those statements but did
not preserve their consequences in authority. The failure was not an absence of
human intent; it was a failure at the conversation-to-authority boundary.

### What the evidence does and does not establish

**Evidence-backed conclusion.** Wilson did not meet its v1.2 completion
condition. Its required registered live-model evaluations did not run and no
qualifying operator acceptance was recorded. The final product's potential
fitness is unknown because it was never evaluated and accepted under that
condition. "Incomplete and unaccepted" is established; "incapable of ever
working" is not.

There was ad hoc real-model use against deployed builds. Therefore, claims of
"zero real-model calls" apply only to Wilson's registered evaluation and
promotion proof, not to its full history. Those ad hoc assembled-product runs
were precisely what exposed the major product failures.

The final no-gate promotion PR, Wilson
[#174](https://github.com/warblersafety/wilson/pull/174), merged `dev` into
`staging` at 2026-08-29 23:54:06 UTC. This corrects the older handoff and
operator-record claim that the intended promotion never happened. The PR
explicitly waived the second round gate, disclosed urgent silent-corruption
defects, and did not constitute product acceptance. Production remained
untouched.

## Decisions already made

1. **Fresh repository.** Recovery will be built in `wilson-next`. Legacy
   `warblersafety/wilson` is evidence and a selective donor, not the foundation
   to evolve in place.
2. **Preserve the public name for later.** Keep the legacy repository's current
   name during recovery so historical issue, PR, commit, and evidence links do
   not become ambiguous. A controlled rename/cutover may happen only after the
   replacement is accepted.
3. **Nightjar is excluded from the redevelopment process.** Nightjar and
   Nightjar-related repositories may be read only when they contain historical
   Wilson analysis. Nightjar supplies no lifecycle, workflow, implementation
   dependency, or authority to this recovery.
4. **Clinician knowledge is primary; Form 3500 is an output.** No upstream
   knowledge representation may be organized around PDF widget identifiers.
   Exact representation remains open.
5. **Consequential writes have one unavoidable enforcement boundary.** Model,
   UI, import, correction, and derived paths may propose changes, but they may
   not bypass the authority that enforces cross-cutting invariants. Exact
   mechanism remains open.
6. **Models propose; they do not silently establish truth.** Model output must
   carry enough evidence and uncertainty for deterministic validation and
   clinician correction. It must not silently overwrite confirmed knowledge,
   erase a conflict, or turn missing information into `unknown`.
7. **Delivery is by complete user-visible journeys.** A slice crosses the real
   interaction, knowledge, correction/review, and output boundaries. A finished
   component is not a finished slice.
8. **The assembled product is exercised during development.** The operator
   must not again be the first person to encounter the assembled build.
9. **Evaluation is lean and risk-directed.** Apply the 80/20 rule. For an
   ordinary user-visible slice, favor focused invariant tests, one headless
   assembled journey, one adverse case aimed at its dominant risk, and a quick
   transcript-to-knowledge-to-output inspection. Broaden only when evidence or
   a milestone warrants it.
10. **Real-model contact occurs when model behavior matters.** Use a small,
    budget-capped set of representative runs when prompts, extraction,
    follow-up selection, or conversational behavior changes. Deterministic
    tests remain necessary but cannot substitute for this evidence.
11. **Fix owning causes, not paths.** Recurrence through another path is an
    architectural signal. Prefer one enforceable invariant to a combinatorial
    catalogue of patches and tests.
12. **Consequential discussion is written back.** Adopted requirements,
    constraints, decisions, divergences, and unresolved challenges must be
    summarized in the repository and confirmed rather than left only in a
    transcript.
13. **UI/UX constrains architecture.** Interaction design may not again arrive
    after foundational machinery. The bounded
    [UI/UX recovery checkpoint](UX-RECOVERY.md) precedes architecture
    comparison, and the first implementation experiment must be an assembled
    browser journey. Mockups and design tokens are inputs, not acceptance
    evidence.
14. **Implementation friction challenges the premise.** When implementing an
    approved decision requires a semantic special case, duplicated authority,
    weakened invariant, hidden fallback, or user-visible behavior not described
    by the governing artifacts, stop the affected work and classify the
    mismatch. Correct an ordinary implementation defect locally; reopen and
    update the owning product, interaction, architecture, experiment, or
    preflight decision before working around a faulty premise.

## Product-quality floor

These are outcome constraints, not an architecture or a claim that every edge
case must be exhaustively tested:

- no clinician-stated fact is silently lost, invented, reversed, duplicated,
  or overwritten;
- every material output value is traceable to clinician evidence or an
  explicit deterministic derivation;
- uncertainty, contradiction, absence, inapplicability, and refusal remain
  distinguishable where the distinction matters;
- corrections work regardless of the input path that introduced the original
  knowledge;
- repeated entities remain distinct and correctly related;
- Wilson does not ask for information it already has without a clear reason;
- the interaction is concise, natural, and free of internal field vocabulary;
- visible controls do not fail silently, and recoverable failures explain what
  happened;
- the reviewed knowledge and generated Form 3500 agree;
- model-dependent behavior is acceptably stable across a small representative
  sample;
- usability claims ultimately require representative clinician evidence.

## Legacy Wilson policy

Legacy Wilson remains read-only during recovery unless Steve separately
authorizes an operational disposition change. Preserve its Git history,
issues, PRs, gate evidence, `runs/steve` material, and known defects.

A legacy asset may be ported only if it:

1. is independent of the field-keyed canonical record;
2. can be checked against an external authority or the recovered product
   intent, rather than only against Wilson's internal contracts;
3. does not import field-centric APIs or vocabulary upstream; and
4. is cheaper to revalidate than to rebuild.

**Likely donors, still requiring review:** the authoritative Form 3500 field
inventory, blank/pinned FDA artifact, low-level PDF filling code and mapping
tests, synthetic hard cases, round-gate regressions, and possibly neutral
visual or deployment assets.

**Presumptively non-reusable:** `AgendaRecord` and field-state machinery,
field-keyed extraction proposals, Talker/ask/derive/gate/open-field orchestration,
existing correction and conflict machinery, field-based completion semantics,
session orchestration coupled to those concepts, the current UI composition,
and tests whose contracts assume PDF fields are the knowledge model.

"Likely" is not approval to copy. Reuse decisions follow product and
architecture work and must name the evidence used to revalidate the asset.

## Evidence basis

The complete source inventory, review status, corrections, and preservation
risks are in [POSTMORTEM-REVIEW.md](POSTMORTEM-REVIEW.md). The confirmed product
definition is [PRODUCT.md](PRODUCT.md), and the bounded product-to-architecture
interaction contract is [UX-RECOVERY.md](UX-RECOVERY.md). The evidence index
supports this brief but is not product or architecture authority.

The main retrospective corpus is the clean local `nightjar-research` commit
`589aaa3`; it has no configured remote. Legacy Wilson's GitHub state was also
checked directly because its local `origin/staging` ref is stale. Raw session
transcripts and the untracked `runs/steve` bundle remain outside repository
history and require privacy-aware preservation decisions.

## Working hypotheses, not decisions

- A claims/evidence model, entity-and-fact graph, event-sourced record, or a
  pragmatic hybrid may fit the canonical knowledge problem. None has been
  selected.
- A deliberately difficult narrow journey may be the cheapest architectural
  discriminator. Its contents and disposal/retention rule are open.
- Some low-level Wilson PDF assets and hard-case fixtures are probably worth
  porting after independent validation.
- Three or four canonical browser journeys may be enough for the early
  regression floor if they cover materially different product shapes.
- Around 10–20% of ordinary slice effort may be an appropriate assembled-test
  budget, increasing only when evidence warrants it.

## Open decisions before implementation

1. Privacy, provider-retention, logging, and synthetic-versus-real
   data boundaries.
2. Candidate canonical representations and the evidence that would falsify
   each one.
3. The single authoritative write boundary and which invariants it must own.
4. Model responsibilities versus authored/deterministic conversation and
   follow-up behavior.
5. The bounded interaction and composition choices required for the first
   browser experiment, including its primary form factor and viewport.
6. The first production-shaped architectural experiment and its success,
   stopping, and disposal criteria.
7. Evaluation metrics, thresholds, run/cost caps, and the minimum evidence for
   completing a slice.
8. Which legacy assets, if any, pass the reuse policy.
9. Technology stack, deployment shape, and repository controls.
10. Legacy Wilson's operational and evidence-preservation disposition.

## Phase boundary

The retrospective review is complete enough to stop broad archaeology. Product
definition and the bounded UI/UX recovery checkpoint are confirmed. The next
phase compares architectural alternatives and defines the first
production-shaped browser experiment; it must not treat the working hypotheses
above as settled design.

No production architecture or implementation has been authorized or performed
by this brief.
