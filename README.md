# Wilson Next

Wilson Next is the clean implementation path for Wilson: a clinician-facing
system that turns a natural account into reviewed, traceable case knowledge and
a supported Form FDA 3500 projection.

**Current status:** Experiment 1 completed on 2026-09-08 as a qualified
technical success. Experiment 2 Stage 3 then replaced the fixed journey with a
state-driven production seed and verified three medication journeys plus the
Experiment 1 regression through browser and PDF in PR #52. The first protected
live passes produced two viable journeys and one safely rejected rich journey,
so Stage 4 is `Revise`. Steve reports that preliminary physician feedback
already established strong preference for Wilson's approach if it works; Issue
#53 refocused the experiment on that condition—reliable semantic and evidence
behavior—rather than repeating a direct-form preference proxy. Experiment 2 now
ends `Revise`, with remediation deferred; Issue #55 preserves the live-model
limitation and its revisit triggers without making it the next product task.
Issue #57 is the next bounded product slice: it adds deterministic, adaptive
completion for the supported adult medication adverse-event path, stable
relevant-test knowledge, reporter entry that bypasses the model, and matching
Sections A, B, and G projection while retaining the earlier deterministic
journeys. It does not call or remediate the deferred live model.

Experiment 2 and Delivery's standing execution authority allow Codex to carry
its remaining bounded implementation, review, protected-preview, and synthetic
model work through review-ready pull requests without repeated permission
steps. Steve retains approval and merge, premise changes, real data, external
participation, production release, destructive actions, expanded review, and
spend above the standing cap. At Issue #42's 2026-09-08 stop-and-reconcile
checkpoint, Steve explicitly required any further experiment both to answer its
bounded questions and to replace the fixed journey with production-seed code
for the supported adult medication adverse-event scope. `docs/EXPERIMENT-2.md`
owns that quality bar and its non-production boundary; `docs/DELIVERY.md` owns
the execution authority.

## Active corpus

The repository has six active documents. Each lasting decision has one owner;
other documents link to it or apply it only where their narrower scope requires.

1. [`docs/PRODUCT.md`](docs/PRODUCT.md) owns the product promise, scope,
   interaction contract, and unacceptable outcomes.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) owns the semantic case,
   authoritative write boundary, model role, projections, and falsification
   conditions proven in Experiment 1 plus the approved production-seed
   amendments for Experiment 2.
3. [`docs/EXPERIMENT-1.md`](docs/EXPERIMENT-1.md) owns the fixed journey,
   supported and deferred scope, selected stack, implementation slices,
   verification, deployment, and disposal contract.
4. [`docs/EXPERIMENT-2.md`](docs/EXPERIMENT-2.md) owns the approved
   operator-only generalization and conditional-reliability plan and the
   authorization boundaries for each slice.
5. [`docs/DELIVERY.md`](docs/DELIVERY.md) owns issues, branches, pull requests,
   independent review, approval, merge controls, and durable traceability.
6. [`docs/RECOVERY.md`](docs/RECOVERY.md) preserves the evidence and lessons
   behind the active decisions. It is historical evidence, not a second
   backlog or competing source of product authority.

When documents interact, Product governs the user outcome, Architecture governs
semantic and authority boundaries, each Experiment document narrows those
decisions for its declared scope, and Delivery governs how changes reach
`main`. A narrower document may specialize a higher-level decision within its
declared scope; it may not contradict it. Stop and reconcile a material
conflict in the owning document before continuing.

## Minimum reading path

- **Slice 0:** this README; the projection and adapter boundary in Architecture;
  the Selected stack, Slice 0 PDF gate, CI and implementation order, and
  Retention sections in Experiment 1; and Delivery.
- **Slices 1–4B:** read Product, Architecture, Experiment 1, and Delivery in
  full.
- **Experiment 2 planning and slices:** read Product, Architecture, Experiment
  2, and Delivery in full; use Experiment 1 as the evidence input named by
  Experiment 2.
- **Premise challenge or legacy reuse:** additionally read the relevant
  evidence and policy in Recovery.

## Repository surfaces

- `docs/` contains the active corpus.
- `.github/` contains the work-item and pull-request templates.
- Application source, tests, package metadata, and CI arrive only in their
  governed implementation slices.

Wilson Next remains one application, not a monorepo. Documentation and code
stay together so implementation evidence can correct its owning decision.
Legacy Wilson is evidence and a selective donor, not the foundation to evolve.
Nightjar remains excluded except as historical Wilson evidence recorded in
Recovery.
