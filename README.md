# Wilson Next

Wilson Next is the clean implementation path for Wilson: a clinician-facing
system that turns a natural account into reviewed, traceable case knowledge and
a supported Form FDA 3500 projection.

**Current status:** Experiment 1 completed on 2026-09-08 as a qualified
technical success. Slices 0–4B proved the fixed synthetic browser-to-PDF
journey, protected Git-preview delivery, synthetic-only diagnostics, and the
central semantic-case/write-boundary hypothesis. Issue #40's escaped
correction/conflict defect was repaired and verified in PR #41. General
usefulness remains unproven because the application is still substantially
coupled to one case; Issue #42 defines the documentation-only transition to a
bounded, operator-only Experiment 2 plan.

Experiment 2 remains a draft planning artifact. It authorizes no application
change, model call, deployment, physician involvement, real clinical data, or
production work.

## Active corpus

The repository has six active documents. Each lasting decision has one owner;
other documents link to it or apply it only where their narrower scope requires.

1. [`docs/PRODUCT.md`](docs/PRODUCT.md) owns the product promise, scope,
   interaction contract, and unacceptable outcomes.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) owns the semantic case,
   authoritative write boundary, model role, projections, and falsification
   conditions approved for Experiment 1.
3. [`docs/EXPERIMENT-1.md`](docs/EXPERIMENT-1.md) owns the fixed journey,
   supported and deferred scope, selected stack, implementation slices,
   verification, deployment, and disposal contract.
4. [`docs/EXPERIMENT-2.md`](docs/EXPERIMENT-2.md) owns the draft
   operator-only generalization and usefulness plan; it is not implementation
   authority until reviewed and approved.
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
  approved implementation slices.

Wilson Next remains one application, not a monorepo. Documentation and code
stay together so implementation evidence can correct its owning decision.
Legacy Wilson is evidence and a selective donor, not the foundation to evolve.
Nightjar remains excluded except as historical Wilson evidence recorded in
Recovery.
