# Wilson Next

Wilson Next is the clean implementation path for Wilson: a clinician-facing
system that turns a natural account into reviewed, traceable case knowledge and
a supported Form FDA 3500 projection.

**Current status:** Product, interaction, Experiment 1 architecture, execution,
verification, deployment, and delivery decisions are approved as amended.
Steve authorized and completed Experiment 1 Slices 0–3 under Issues #11, #15,
#17, and #23. Slice 4A established the Vercel Hobby deployment path under Issue
#28 and was merged in PR #29. Git-backed protected previews and deployed
observability followed under Issues #30 and #32. Slice 4B is defined as an
operator-only live-model checkpoint under Issue #35; Steve authorized
implementation after the required pre-implementation review and approved its
planning remediation on 2026-09-06.

## Active corpus

The repository has five active documents. Each lasting decision has one owner;
other documents link to it or apply it only where their narrower scope requires.

1. [`docs/PRODUCT.md`](docs/PRODUCT.md) owns the product promise, scope,
   interaction contract, and unacceptable outcomes.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) owns the semantic case,
   authoritative write boundary, model role, projections, and falsification
   conditions approved for Experiment 1.
3. [`docs/EXPERIMENT-1.md`](docs/EXPERIMENT-1.md) owns the fixed journey,
   supported and deferred scope, selected stack, implementation slices,
   verification, deployment, and disposal contract.
4. [`docs/DELIVERY.md`](docs/DELIVERY.md) owns issues, branches, pull requests,
   independent review, approval, merge controls, and durable traceability.
5. [`docs/RECOVERY.md`](docs/RECOVERY.md) preserves the evidence and lessons
   behind the active decisions. It is historical evidence, not a second
   backlog or competing source of product authority.

When documents interact, Product governs the user outcome, Architecture governs
semantic and authority boundaries, Experiment 1 narrows those decisions for the
current experiment, and Delivery governs how changes reach `main`. A narrower
document may specialize a higher-level decision within its declared scope; it
may not contradict it. Stop and reconcile a material conflict in the owning
document before continuing.

## Minimum reading path

- **Slice 0:** this README; the projection and adapter boundary in Architecture;
  the Selected stack, Slice 0 PDF gate, CI and implementation order, and
  Retention sections in Experiment 1; and Delivery.
- **Slices 1–4B:** read Product, Architecture, Experiment 1, and Delivery in
  full.
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
