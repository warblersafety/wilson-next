# Wilson Next

Wilson Next is the clean implementation path for Wilson: a clinician-facing
system that turns a natural account into reviewed, traceable knowledge and a
supported Form FDA 3500 projection.

**Current status:** Product, interaction, architecture, Experiment 1,
verification, deployment preflight, and delivery-process decisions are
approved. Application implementation has not begun and still requires an
explicit go-ahead.

This README is a navigation aid, not a separate source of product authority.
The linked documents contain the approved decisions and evidence.

## Start here

For a concise understanding of what Wilson is and what happens next, read:

1. [Product definition](docs/product/PRODUCT.md) — the problem, user, outcome,
   and product boundary.
2. [Experiment 1 proposal](docs/experiment-1/EXPERIMENT-1-PROPOSAL.md) — the
   first fixed journey and what it must teach us.
3. [Architecture proposal](docs/product/ARCHITECTURE-PROPOSAL.md) — the semantic
   case, authority boundary, and deliberately small application shape.
4. [Deployment preflight](docs/experiment-1/DEPLOYMENT-PREFLIGHT.md) — the
   selected stack, implementation order, and stop-and-reconcile rule.
5. [Development process](docs/process/DEVELOPMENT-PROCESS.md) — how changes are
   scoped, reviewed, approved, and merged.

## Documentation index

### Product and design

| Artifact | Purpose |
|---|---|
| [Product definition](docs/product/PRODUCT.md) | Defines Wilson's intended user, problem, outcome, boundaries, and product principles. |
| [UI/UX recovery](docs/product/UX-RECOVERY.md) | Defines the approved interaction direction and identifies which prior-Wilson design ideas help or hinder it. |
| [Architecture proposal](docs/product/ARCHITECTURE-PROPOSAL.md) | Defines the semantic case, write authority, model boundary, projections, and application shape. |

### Experiment 1

| Artifact | Purpose |
|---|---|
| [Experiment proposal](docs/experiment-1/EXPERIMENT-1-PROPOSAL.md) | Defines the supported synthetic journey, success criteria, stopping conditions, and physician-feedback goal. |
| [System diagrams](docs/experiment-1/experiment-1-system-diagrams.md) | Shows the bounded components, data model, authority boundary, and major flows. |
| [Visual checkpoint](docs/experiment-1/visual-checkpoint/README.md) | Indexes the four realistic mockups and explains what each screen is meant to test. |
| [Mockup generation record](docs/experiment-1/visual-checkpoint/GENERATION.md) | Records how the visual checkpoint was produced and what it does and does not prove. |
| [Verification strategy](docs/experiment-1/VERIFICATION-STRATEGY.md) | Defines the smallest useful deterministic, browser, model, PDF, operator, and physician evidence. |
| [Deployment preflight](docs/experiment-1/DEPLOYMENT-PREFLIGHT.md) | Selects the initial stack and orders the five implementation slices. |

### Delivery process

| Artifact | Purpose |
|---|---|
| [Development process](docs/process/DEVELOPMENT-PROCESS.md) | Defines issues, branches, pull requests, review, approval, merge controls, and durable traceability. |
| [Claude review protocol](docs/process/CLAUDE-REVIEW.md) | Defines independent model review, permitted model and effort bounds, subscription-only authentication, and additional-review approval. |

### Recovery record

| Artifact | Purpose |
|---|---|
| [Recovery brief](docs/recovery/RECOVERY-BRIEF.md) | Records the governing recovery principles and the transition from prior Wilson to Wilson Next. |
| [Postmortem review](docs/recovery/POSTMORTEM-REVIEW.md) | Preserves evidence about prior implementation failures and the lessons that constrain this effort. |

Recovery material explains why the current direction exists; it is not a
second product backlog. Legacy Wilson is evidence only. Nightjar remains
excluded except where the recovery record discusses historical Wilson evidence.

## Repository surfaces

- `docs/` contains approved definitions, the bounded experiment, process, and
  recovery evidence.
- `.github/` contains the issue and pull-request templates used to create the
  implementation audit trail.
- `src/`, tests, package metadata, and build configuration will be introduced
  by the approved implementation slices. Empty application scaffolding is not
  created merely to make the repository look complete.

The repository remains one application, not a monorepo. Documentation and code
stay together so a pull request can update an owning decision when
implementation evidence shows that it is wrong.
