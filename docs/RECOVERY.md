# Wilson recovery record

**Status:** Historical evidence consolidated 2026-09-05

**Role:** Explains why the active Wilson Next decisions exist and preserves
important qualifications and legacy policy. It is not a second product backlog
or competing implementation authority.

Active decisions live in [`PRODUCT.md`](PRODUCT.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md),
[`EXPERIMENT-1.md`](EXPERIMENT-1.md), and [`DELIVERY.md`](DELIVERY.md).

## Recovery verdict

Legacy Wilson deliberately made the PDF's 227 widgets its canonical record.
Model proposals, conversation state, questioning, review, completion, and
export accumulated around that field-keyed record. The code substantially
implemented its governing design; the central failure was product modeling and
sequence, not merely poor execution.

The intended shape was:

```text
clinician account
  -> facts, entities, evidence, uncertainty, and conflicts
  -> evolving case knowledge
  -> Form FDA 3500 and possible later projections
```

Legacy Wilson centered:

```text
clinician account
  -> PDF field proposals
  -> 227-field Agenda record
  -> Form FDA 3500
```

The field inventory and exporter were locally useful. Their schema made
repeated entities, evidence, uncertainty, correction, conflict, applicability,
and exclusive facts awkward or unrepresentable upstream.

Three failure classes remain distinct:

1. **Representation:** the record could not naturally express repeated
   entities, missing-state distinctions, evidence, confirmation, and pending
   conflicts.
2. **Elicitation:** field structure leaked into robotic wording, repeated asks,
   excessive turns, and implementation vocabulary.
3. **Enforcement:** invariants existed in several write paths and repeatedly
   escaped; a semantic model alone would not have fixed this.

## Producing-process lessons

The previous process created bounded units and caught many implementation
defects, but optimized confidence around local contracts. It did not reliably
establish that the foundation modeled the right product or that units composed
into a usable whole.

Consequential failures included:

- operator intent and premise challenges remained in conversation instead of
  becoming durable authority;
- discovery, design, repository setup, and foundational implementation preceded
  representative-journey pressure;
- reviews favored document consistency and local conformance over premise
  challenge;
- frozen criteria made patches easier than reopening a bad shared decision;
- semantic authority fragmented across artifacts and code paths;
- component evidence substituted for assembled-product evidence; and
- real-model and deployed contact reached the formal proof too late.

The operator had warned against a form walker, requested maximum information per
turn, described a knowledge model upstream of the form, challenged review, and
resisted root-cause-hiding patches. The process acknowledged those statements
but did not preserve their consequences. Wilson Next therefore uses one owner
per decision, one unavoidable write boundary, complete journey slices, early
assembled evidence, and stop-and-reconcile.

## What the evidence establishes

- Legacy Wilson did not meet its v1.2 completion condition: registered
  live-model evaluations did not run and no qualifying operator acceptance was
  recorded. It was incomplete and unaccepted; evidence does not prove it could
  never have worked.
- Ad hoc real-model use did occur against deployed builds. Absolute claims of
  zero real-model calls are false outside the registered evaluation system.
  Those ad hoc assembled runs exposed the major product failures.
- Legacy [PR #174](https://github.com/warblersafety/wilson/pull/174) merged
  `dev` to `staging` on 2026-08-29 at 23:54:06 UTC. It waived the second gate,
  disclosed urgent silent-corruption defects, and was not product acceptance.
  Production remained untouched.
- Lucy retained a semantic-case-to-form boundary that Wilson discarded. That
  does not prove Lucy was production-ready or that copying it would have made
  Wilson successful; Lucy had failures and more frequent human contact.
- A round-gate driver's zero exit code proved scripted cases were driveable,
  not that the product was ready. The human evidence record said `NOT READY`.

## Active recovery consequences

The active corpus carries these evidence-backed constraints:

- Work proceeds in this fresh `wilson-next` repository.
- Clinician case knowledge is primary; Form 3500 is an output.
- Models propose; clinicians establish or change accepted truth.
- One authoritative boundary owns consequential writes and invariants.
- Delivery is by complete user-visible journeys with assembled evidence.
- Questions are semantic and consequential, not blank-field traversal.
- UI/UX constrains architecture rather than decorating it later.
- Slice 3 real-model contact occurred in a small capped sample when model
  behavior mattered; deterministic tests could not substitute for it. Later
  operator-initiated use follows Experiment 1's uncapped Wilson runtime policy.
- Severe friction or recurrence challenges the owning premise instead of
  producing path-specific patches.
- Consequential decisions are written once into their owning active document.

These constraints are summarized here only as recovery provenance. Their
operative definitions are in the linked active documents.

## Legacy Wilson and Nightjar policy

Legacy Wilson remains read-only unless Steve separately authorizes an
operational change. Preserve its Git history, issues, pull requests, gate
evidence, `runs/steve` material, and known defects.

Keep the legacy repository's public name until the replacement is accepted so
historical links remain unambiguous. Any rename or cutover is a later controlled
decision.

A legacy asset may be proposed only when it:

1. is independent of the field-keyed canonical record;
2. can be validated against external authority or the active product, not only
   legacy internal contracts;
3. imports no field-centric API or vocabulary upstream; and
4. is cheaper to revalidate than rebuild.

Possible donors still require slice-specific review: the official Form 3500
artifact and field inventory, low-level PDF mapping/filling evidence, synthetic
hard cases, gate regressions, and neutral visual/deployment assets. This is not
approval to copy them.

Do not reuse the Agenda record, field-state machinery, field-keyed proposals,
Talker/ask/derive/gate/open-field orchestration, correction/conflict machinery,
field-based completion, coupled session orchestration, legacy UI composition,
or tests whose contracts assume PDF fields are case knowledge.

Nightjar and related repositories may be read only where they contain
historical Wilson analysis. Nightjar supplies no lifecycle, workflow,
implementation dependency, or authority to Wilson Next. Copy nothing from
Wilson Next into Nightjar.

## Evidence inventory

The integrated retrospective corpus lives primarily in the local
`nightjar-research` repository at clean commit `589aaa3`; it has no configured
remote. Principal sources include:

- `reviews/executive-summary.md` and the Wilson/sofa-claude assessments,
  postmortems, evidence ledgers, and captured traces;
- `meta-review/operator-record.md`, recovering 661 contemporaneous operator
  messages with stated sampling limits;
- the independent meta-review and Slice 0/milestone disposition checks;
- the bounded Lucy comparative assessment;
- legacy Wilson's charter, design, ask-copy, round-gate records, source, tests,
  issues, pull requests, Actions history, and
  [round-gate #1 evidence](https://github.com/warblersafety/wilson/blob/fb00b17/runs/gate/7f8f1bdb2ef990c4fdb6e3f769e7b4abdb51c8bf/README.md);
- the untracked `runs/steve` session bundle and its contemporaneous verdict;
- sofa-claude [issue #49](https://github.com/smansf/sofa-claude/issues/49);
- the complete August 25 Wilson retrospective, recoverable from local Claude
  session `4a6aebbb`; and
- legacy Wilson PR #174 and current GitHub refs used to correct the staging
  chronology.

The postmortem authoring and recovery tasks are provenance, not higher authority
than the inspected evidence or Steve-approved active corpus. Broad archaeology
is complete; reopen it only for a named uncertainty capable of changing a
decision.

## Preservation and unresolved operations

- `nightjar-research` has local history but no remote mirror.
- Raw transcripts and the untracked `runs/steve` bundle may contain credentials,
  private data, or clinical-style narratives; preservation requires privacy
  review, not blind Git import. A count-only inspection found credential-shaped
  text in the retained legacy Vercel builder transcript; no value was inspected
  during Wilson Next planning, so the transcript is not evidence that the old
  token remained secret.
- Original research-authoring sessions were not all located.
- Legacy Vercel administration used a short-lived token placed independently in
  a gitignored local `.env.vercel` file and explicitly sourced for REST API
  commands; it was not ambient builder injection or a persistent Vercel login.
  The file used weaker-than-preferred `0644` permissions, and the August 23 token
  revocation was not verified. Wilson Next must not reuse it; its replacement
  handoff is defined in Experiment 1.
- Legacy Wilson's existing Vercel project proves that the `warblersafety` team
  has hosted this code family on Vercel. It does not prove that a new public
  organization repository can use automatic Git deployments on the current
  Hobby plan; Slice 4A tests that narrow question before changing product code.
- The local legacy `origin/staging` ref is stale; GitHub shows PR #174's merge.
- Legacy Wilson remains public, unarchived, and uses `dev` as default. Its
  deployment, open urgent issues, evidence retention, terminal notice, name
  cutover, and eventual archival need an explicit operational decision.

That legacy operational disposition does not block the isolated synthetic
Experiment 1 PDF proof. A specific reuse decision is made inside the slice that
proposes the asset; no global legacy-reuse phase is required before Slice 0.
