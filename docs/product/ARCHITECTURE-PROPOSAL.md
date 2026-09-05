# Wilson architecture proposal

**Status:** Approved by Steve on 2026-09-04 for Experiment 1; not broader
product implementation authority

**Prepared:** 2026-09-04

**Authority:** Constrained by `RECOVERY-BRIEF.md`, `PRODUCT.md`, and
`UX-RECOVERY.md`

## Executive summary

Wilson should keep one clear account of what the clinician knows about the
case: who was affected, what happened, which products were involved, what is
uncertain, and where each piece of information came from. The FDA form should
be filled from that account at the end; its boxes should not determine how
Wilson understands the case.

The model may draft what it thinks the clinician said, but the clinician must
check it before it becomes accepted case information. Later corrections should
replace the active value everywhere while preserving what was previously said.
If two sources disagree, Wilson should show the disagreement and leave the
answer unresolved until the clinician decides.

All changes will pass through one common checkpoint so that these rules cannot
be applied differently on different screens. The browser, model, and PDF will
otherwise remain simple parts of one application. More elaborate machinery—such
as a general knowledge graph, event-sourcing system, multiple services, or
saved-case database—is deliberately deferred until Wilson demonstrates a real
need for it.

This proposal is only the minimum foundation for the first experiment. That
experiment must still prove that the approach works in an assembled browser
journey before WN builds more of the product.

## Decision requested

Approve a small, server-owned semantic case model with:

- stable patient, event, and product identities;
- typed facts that retain status, source, conflicts, and superseded values;
- model output held as proposals until clinician review;
- one mandatory function for every case change;
- synchronous review and Form 3500 views from the same case revision; and
- model, PDF, and storage integrations behind narrow adapters in one modular
  TypeScript application.

This is not a PDF-field record, generic knowledge graph, event-sourced system,
distributed CQRS system, or final production architecture. Approval authorizes
only the bounded experiment in `EXPERIMENT-1-PROPOSAL.md`.

## 80/20 boundary

The first architecture must prove three things:

1. Wilson can represent repeated entities, evidence, correction, and conflict
   without using PDF widget identifiers.
2. Every write path can be forced through the same invariants.
3. Understanding, review, and form output can remain consistent in a real
   browser journey.

Defer until a later slice demonstrates need:

- a generic claims or ontology system;
- event replay, an event store, messaging, or separate read storage;
- durable sessions, accounts, multiple users, or synchronization;
- generic import and deterministic-derivation frameworks;
- full FHIR or ICH E2B compatibility;
- a comprehensive question-planning engine;
- general Form 3500 and device coverage; and
- a framework-independent internal platform or large package taxonomy.

## Research assessment

The external evidence supports the simplified direction but cannot prove its
fitness for Wilson. The browser experiment remains the deciding evidence.

- Domain-driven design treats an aggregate as a consistency boundary and its
  root as the only update entry point. It also recommends keeping aggregates
  small and including only state that must remain consistent in one
  transaction. See Microsoft's [aggregate guidance](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/microservice-domain-model)
  and [tactical DDD guidance](https://learn.microsoft.com/en-ca/azure/architecture/microservices/model/tactical-ddd).
- Microsoft's [CQRS guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
  supports task-oriented commands and view-specific reads but warns that event
  sourcing, separate stores, messaging, and eventual consistency add material
  complexity. WN therefore uses only synchronous command/read separation in
  one process and repository.
- AWS's [hexagonal architecture guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/improve-software-quality.html)
  supports keeping domain logic independent of model, storage, and output
  adapters while testing the domain, adapters, and end-to-end path at their
  appropriate boundaries.
- Shopify found that folder conventions and social agreements did not prevent
  cross-domain coupling; it added static boundary checks, then documented the
  indirection and tradeoffs those checks introduced. See
  [Enforcing Modularity with Packwerk](https://shopify.engineering/enforcing-modularity-rails-apps-packwerk)
  and [A Packwerk Retrospective](https://shopify.engineering/a-packwerk-retrospective).
  WN should enforce a few important boundaries mechanically without creating a
  general modularity platform.
- [W3C PROV](https://www.w3.org/TR/prov-overview/) and
  [FHIR Provenance](https://hl7.org/fhir/provenance.html) support identifying
  source entities, transforming activities, responsible actors, and revisions.
  Wilson needs only a minimal subset for the first experiment.
- FHIR's [AdverseEvent resource](https://hl7.org/fhir/adverseevent.html) uses
  repeated suspect entities, while its
  [data-absent reasons](https://hl7.org/fhir/valueset-data-absent-reason.html)
  distinguish unknown, not asked, declined, inapplicable, unsupported, and
  error. ICH E2B(R3) likewise uses distinct references for reactions/events and
  drugs. See the [ICH specification index](https://admin.ich.org/node/348).
  These standards validate the problem shape; they are references, not Wilson's
  schema or submission target.

## Alternatives considered

| Alternative | Benefit | Why not now |
|---|---|---|
| Mutable case object with ordinary properties | Fastest implementation | Provenance, conflicts, and correction become path-specific flags and direct writes can bypass invariants |
| Full event sourcing | Complete replayable history | Requires event evolution, replay, snapshots, and projected current truth before Wilson has proven the model |
| Generic claim/evidence graph | Flexible relationships and alternatives | Adds ontology and query complexity and can leak graph mechanics into simple product behavior |
| Distributed CQRS or microservices | Independent scaling and deployment | Wilson has one user journey and requires immediate agreement; distribution adds stale views and operations without a current benefit |
| **Typed semantic case with fact wrappers and a change list** | Direct typed UI reads plus the evidence and conflict behavior Wilson needs | **Recommended minimum** |

The recommendation is a modest domain model with ports and adapters, not an
attempt to implement every named pattern in the research.

## Proposed case model

```text
Case
  id
  revision
  patient
  event
  products[]        # stable id and suspect/concomitant role
  asked needs[]     # the small semantic follow-up history
  sources[]         # known clinician inputs and exact excerpts
  changes[]         # accepted in-session changes and supersession
```

Patient, event, and product fields use the same small wrapper:

```text
Fact<T>
  state: empty | proposed | resolved | conflicted
  proposed values[]
  resolved value?     # at most one
  conflicting values[]
  source ids[]
  superseded values[]
```

A resolved value is either:

```text
known(value, optional precision or qualifier)
unknown
explicitly absent
inapplicable
declined
```

No value means `empty`; it does not mean unknown. Whether Wilson asked about an
empty fact belongs to interaction history, not the clinical value.

The first implementation uses explicit typed fields for the selected patient,
event, and product slice. Product roles are typed facts, and model-proposed
entities remain proposed until group review. It does not use a generic
subject/predicate registry. The reusable `Fact<T>` behavior provides a
consistent path for later fields without claiming to have designed the full
Form 3500 domain.

### Minimal source and change records

A source record needs only:

- source ID and input ID;
- source type, such as opening account, follow-up, or direct correction;
- exact clinician excerpt and offsets where applicable;
- actor; and
- time recorded.

A change record needs only:

- command ID and type;
- affected entity and fact IDs;
- source IDs;
- prior and resulting case revision; and
- which value was superseded or conflict was resolved, when applicable.

This is an in-session explanation trail. It is not a generic provenance graph,
an audit-compliance system, or an event source from which the case must replay.

## Authoritative write boundary

Every consequential change goes through one server-side `applyCaseCommand`
boundary. The browser, model adapter, FDA PDF-filler adapter, and future input
paths cannot mutate a case directly.

The first experiment needs only these command shapes:

- attach grounded proposals from one clinician input;
- review those proposals by accepting, correcting, or rejecting each semantic
  group;
- record a clinician answer or direct correction;
- record incompatible evidence as a conflict; and
- resolve a conflict explicitly.

Starting a new case may use a separate session-level operation later; it does
not need to expand the first case command vocabulary.

Each command includes an expected case revision and command ID. One command is
applied at most once. The boundary either commits the complete new case and
change entry or changes nothing.

### Boundary-owned invariants

1. A model proposal cannot become a resolved value without clinician review.
2. Every proposed or resolved material value identifies its source.
3. Every fact belongs to an existing, type-compatible stable entity.
4. A correction supersedes rather than silently overwrites the active value.
5. Incompatible accepted evidence produces a conflict with no resolved value.
6. Known, unknown, absent, inapplicable, and declined are mutually exclusive.
7. Stale or duplicate commands cannot create duplicate entities or reverse a
   later decision.
8. Projection and other adapters cannot mutate the case.

Tests and automated dependency checks must demonstrate that application routes
and UI modules cannot import lower-level mutation helpers. This is the minimum
enforcement needed to avoid repeating Wilson's path-by-path invariant failures.

## Model responsibility

The model may propose typed patient, event, and product facts, entity links,
qualifiers, and exact source spans. It may identify that text contains a
correction or unresolved alternatives.

The model may not:

- confirm, overwrite, or resolve case knowledge;
- choose between conflicting evidence;
- determine report completion;
- select Form 3500 widget identifiers; or
- generate the PDF projection.

Schema, span, type, and entity checks reject malformed proposals before they
reach review. Those checks do not prove that an excerpt supports a claim; the
clinician's explicit review and the experiment's human-scored model sample are
still required.

For Experiment 1, one deterministic semantic rule identifies the missing
suspect-product indications and authored copy asks about them. A generic
follow-up planner and model-generated question wording are deferred.

## Read views and Form 3500 projection

Understanding, review, and output views are pure synchronous functions of one
case revision. They are not separately persisted projections.

```text
Case revision
  -> understanding view
  -> review view
  -> semantic Form 3500 projection + source trace + omissions
  -> versioned PDF widget adapter
  -> PDF bytes
```

The semantic projection knows Form 3500 concepts but not PDF widget IDs, page
coordinates, or checkbox export values. Those implementation details exist
only in the final versioned adapter. A projection or rendering error leaves the
case unchanged.

The current authority is Form FDA 3500 (09/2025), OMB expiry 09-30-2027. Its
[PDF](https://www.fda.gov/media/76299/download?attachment=) must be versioned
and checksummed before the adapter is implemented. The accompanying
[FDA instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
must be identified by their authoritative URL and retrieval date before mapping
decisions are accepted. The live guidance page is not a byte-consumed adapter
input and does not require an artificial checksum.

## Application shape

Use ports and adapters inside one modular TypeScript application:

```text
browser UI -> application commands and queries -> case domain
                                         |-> model adapter
                                         |-> FDA PDF-filler adapter
                                         |-> case repository
```

The bounded architecture, semantic data model, authority flow, and proposed
implementation sequence are shown in the
[Experiment 1 system diagrams](../experiment-1/experiment-1-system-diagrams.md). Those
diagrams distinguish what the experiment builds from replaceable seams and
explicitly excluded future scope.

The experiment uses one server process, one in-memory case per random session,
and no durable database. Server restart may lose the case, which is within the
confirmed product boundary. Domain code has no model-provider, PDF-library,
framework, or deployment imports.

The proposed stack direction is supported Node LTS, strict TypeScript, React,
runtime boundary validation, Playwright, and focused domain tests. The exact
full-stack framework, PDF library, model provider, and preview host are selected
together after approval; they are not architectural commitments here.

## Privacy and legacy boundary

Experiment 1 accepts synthetic data only. It has no analytics, session replay,
payload logging, audio capture, or retained deployed case state. Operational
logs may contain request IDs, timings, adapter status, and case revisions, but
not narrative or PDF content.

No legacy case state, orchestration, completion logic, correction machinery, or
UI composition is reusable. After approval, the official PDF may be compared
with the legacy artifact and the low-level filler may be tested as a replaceable
adapter. The experiment cannot depend on either asset passing review. Nightjar
remains excluded except as historical Wilson evidence.

## Falsification and approval consequence

The architecture fails the first experiment if:

- any domain fact requires a PDF widget identifier;
- the correction or conflict logic differs by input surface;
- two products require positional identity or special-case projection state;
- conflicting values can both become resolved or reach the PDF;
- the browser or projection maintains its own authoritative case values; or
- a write can bypass `applyCaseCommand`.

Any such result stops expansion and reopens the owning architectural premise.

Approval settles only this minimal representation, write boundary, model role,
and application shape for Experiment 1. It does not authorize broader product
implementation, real clinical data, production deployment, general Form 3500
coverage, or any deferred mechanism listed above.
