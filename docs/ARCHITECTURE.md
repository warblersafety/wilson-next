# Wilson Experiment 1 architecture

**Status:** Approved by Steve for Experiment 1; not broader production
architecture authority

**Owns:** Semantic case, write authority, model boundary, projections,
application shape, privacy boundary, and architectural falsification

**Constrained by:** [`PRODUCT.md`](PRODUCT.md)

## Decision

Use a small, server-owned semantic case representing what the clinician knows:
the patient, event, products, uncertainty, conflicts, evidence, and accepted
changes. Form FDA 3500 is projected from that case; its widget identifiers do
not organize upstream knowledge.

Model output remains proposed until clinician review. Every consequential case
change passes through one server-side command boundary. Understanding, review,
clarification, and Form 3500 output are synchronous views of the same case
revision.

Implement this in one modular TypeScript application with model, PDF, and
temporary storage behind narrow adapters. Do not introduce a generic knowledge
graph, event store, distributed CQRS, microservices, durable database, or
framework-independent internal platform for Experiment 1.

The architecture must prove three things:

1. Repeated entities, evidence, correction, and conflict are representable
   without PDF widget identity.
2. Every write path is forced through the same invariants.
3. Conversation, review, and form output remain consistent in a real browser
   journey.

## Semantic case

```text
Case
  id
  revision
  patient
  event
  products[]        # stable ID and suspect/concomitant role
  askedNeeds[]      # small semantic follow-up history
  sources[]         # clinician inputs and exact excerpts
  changes[]         # accepted changes, supersession, and resolution
```

Selected patient, event, and product fields use one small wrapper:

```text
Fact<T>
  state: empty | proposed | resolved | conflicted
  proposedValues[]
  resolvedValue?        # at most one
  conflictingValues[]
  sourceIds[]
  supersededValues[]
```

A resolved value is `known(value, optional precision or qualifier)`, `unknown`,
`explicitly absent`, `inapplicable`, or `declined`. These meanings are mutually
exclusive. No value means `empty`; it does not mean unknown. Whether Wilson has
asked about an empty fact belongs to interaction history, not clinical truth.

Experiment 1 uses explicit typed fields only for its selected patient, event,
and product facts. Product roles are facts, and proposed entities remain
proposed until group review. `Fact<T>` supplies consistent behavior without
claiming a complete Form 3500 ontology.

### Source and change records

A source records only its ID, input ID, input type, exact clinician excerpt and
offsets when applicable, actor, and time recorded. A change records only its
command ID and type, affected entity/fact IDs, source IDs, prior and resulting
revision, and any supersession or resolution.

This is an in-session explanation trail, not a compliance audit graph or an
event source from which the case must replay.

## Authoritative write boundary

Every consequential change uses one server-side `applyCaseCommand`. Browser,
model, projection, and future input paths cannot mutate a case directly. The
first experiment needs only commands to:

- attach grounded proposals from one clinician input;
- review proposals by accepting, correcting, or rejecting semantic groups;
- record a clinician answer or direct correction;
- record incompatible evidence as a conflict; and
- resolve a conflict explicitly.

Each command includes an expected case revision and command ID. It applies at
most once and either commits the complete new case plus change entry or changes
nothing.

The boundary enforces:

1. A model proposal cannot become resolved without clinician review.
2. Every proposed or resolved material value identifies its source.
3. Every fact belongs to an existing, type-compatible stable entity.
4. A correction supersedes rather than silently overwrites the active value.
5. Incompatible accepted evidence creates a conflict with no resolved value.
6. Known, unknown, absent, inapplicable, and declined remain exclusive.
7. Stale or duplicate commands cannot duplicate entities or reverse later work.
8. Read views, projections, and adapters cannot mutate the case.

A natural-language correction identified by the model is still a proposal. The
old value remains active until the clinician explicitly accepts the correction;
the accepted command then activates the new value and retains the old value as
superseded history.

One narrow automated source-boundary assertion must show that application
routes and UI modules cannot import lower-level mutation helpers. It may be a
focused test under the ordinary test command; no general architectural test
framework is required.

## Model responsibility

The model may propose typed patient, event, and product facts, entity links,
qualifiers, exact source spans, and the presence of a correction or unresolved
alternative. It may not:

- confirm, overwrite, or resolve case knowledge;
- choose among conflicting evidence;
- determine report completion;
- choose PDF widget identifiers; or
- create the Form 3500 projection.

Schema, span, type, and entity checks reject malformed proposals before review.
Those checks do not prove that an excerpt supports a claim; clinician review
and the human-scored model sample remain necessary.

Experiment 1 uses one deterministic semantic rule to identify missing
suspect-product indications and authored copy to ask for them. A generic
follow-up planner and model-generated question wording are deferred.

## Views and Form 3500 projection

All user-visible knowledge and output derive from one revision:

```text
Case revision
  -> understanding / clarification / review views
  -> semantic Form 3500 projection + source trace + omissions
  -> versioned PDF widget adapter
  -> PDF bytes
```

The semantic projection knows Form 3500 concepts but not PDF widget names,
coordinates, checkbox encodings, or library details. Only the final versioned
adapter knows those. A projection or rendering error leaves the case unchanged.

The approved authority is Form FDA 3500 (09/2025), OMB expiry 09-30-2027. The
[official PDF](https://www.fda.gov/media/76299/download?attachment=) must be
versioned and checksummed before adapter implementation. The
[FDA instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
are identified by authoritative URL and retrieval date before mapping evidence
is accepted; the live guidance page is not a byte-consumed adapter input.

## Application and data boundary

```text
browser UI -> application commands and queries -> case domain
                                         |-> model adapter
                                         |-> FDA PDF adapter
                                         |-> temporary case repository
```

Use one server process and one temporary in-memory case per random browser
session. Server restart may lose the case. Domain code has no model-provider,
PDF-library, framework, or deployment imports. The browser may hold temporary
interaction state but never authoritative case values.

Experiment 1 accepts synthetic data only. It has no analytics, session replay,
payload logging, audio capture, or retained deployed case state. Operational
logs may contain request IDs, timings, adapter status, token counts, and case
revisions, but not narratives, model payloads, PDFs, or case facts.

## Deferred architecture

- Generic claim/evidence graphs, ontologies, event replay, messaging, separate
  read stores, multiple services, or synchronization.
- Durable sessions, accounts, collaboration, and saved-case storage.
- General import or deterministic-derivation frameworks.
- Full FHIR or ICH E2B compatibility.
- Comprehensive question planning, full Form 3500 coverage, and devices.
- Large package taxonomies or a reusable internal platform.

## Falsification

Stop expansion and reopen the owning premise if:

- a domain fact requires a PDF widget identifier;
- correction or conflict behavior differs by input surface;
- repeated products require positional identity or special projection state;
- conflicting alternatives can both resolve or reach the PDF;
- browser or projection code maintains authoritative case values;
- any consequential write can bypass `applyCaseCommand`; or
- implementation requires duplicated authority, a weakened invariant, hidden
  fallback, or user-visible behavior absent from the approved product and
  experiment.

Approval of this document authorizes only the Experiment 1 architectural
hypothesis. It does not authorize implementation, real clinical data,
production deployment, full Form 3500 coverage, or deferred mechanisms.
