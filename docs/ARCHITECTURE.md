# Wilson Experiment 1 architecture

**Status:** Approved by Steve for Experiment 1; not broader production
architecture authority

**Owns:** Semantic case, write authority, model boundary, projections,
application shape, privacy boundary, and architectural falsification

**Constrained by:** [`PRODUCT.md`](PRODUCT.md)

## Decision

Use a small semantic case representing what the clinician knows:
the patient, event, products, uncertainty, conflicts, evidence, and accepted
changes. Form FDA 3500 is projected from that case; its widget identifiers do
not organize upstream knowledge.

Model output remains proposed until clinician review. Every consequential case
change passes through one server-side command boundary. Understanding, review,
clarification, and Form 3500 output are synchronous views of the same case
revision. For the synthetic Experiment 1 preview only, the browser may retain
the latest server-returned case and interaction state between stateless
requests; it does not gain a second mutation path.

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
browser UI + retained case/interaction state
                    -> application commands and queries -> case domain
                                                    |-> model adapter
                                                    |-> FDA PDF adapter
```

Use stateless application routes on Vercel. The browser retains the latest
server-returned case, revision, and minimum interaction state in origin- and
tab-scoped `sessionStorage` and supplies them with the next command or query.
The server validates the received shape, expected revision, command, and
resulting case invariants before returning a complete next state. Browser code
stores or discards that result; it does not edit semantic case values directly.

This is deliberately not a secure persistence design. A reviewer can alter or
delete their own browser storage; another tab, browser, or device cannot
reliably recover the case; and closing the tab or clearing site data loses it.
Concurrent-tab use is unsupported. Vercel stores no case contents, encrypted
envelope, revision anchor, or session affinity record. These limits are
acceptable only because the preview is synthetic-only, access-restricted,
non-production, and disposable. Hosted persistence, cross-device recovery,
tamper resistance, and any real-clinical-data boundary require a later
architecture decision.

Domain code has no model-provider, PDF-library, framework, or deployment
imports. The browser-held state is a deployment adapter concern and does not
change `applyCaseCommand` as the sole semantic write boundary.

Experiment 1 accepts synthetic data only. It has no analytics, session replay,
audio capture, or retained deployed case state. For the fixed, protected,
operator-driven experiment, Vercel Runtime Logs are the single diagnostic
location and may contain the complete relevant synthetic request, model output,
proposal, evidence, validation, command, state-transition, response, and caught-
error content needed to reconstruct a run. Events are emitted as each phase
occurs, correlated by one browser-run identifier and one request-operation
identifier, and need not wait for a final journey state. This narrow diagnostic
exception does not authorize real clinical data or another store. Authorization
headers, cookies, API or deployment tokens, environment values, protection
bypasses, and other credential-bearing material are never logged. PDF bytes are
also excluded because they do not help explain model or control-flow behavior.
Each case-route response also emits one in-request reconstruction checkpoint
containing the already-sanitized events from that operation. Immediate phase
events still expose an early crash; the checkpoint makes a completed operation
reconstructable when Vercel's live Runtime Log stream omits individual lines.
It exists only in function memory until that final log call and is not a second
diagnostic or case store.
Browser reporting uses the same pattern within each operation: every event is
sent immediately, while each later report also carries the browser events that
preceded it. A received response or browser-side failure can therefore explain
both the initiating action and what the browser observed even if Vercel omits
one earlier line. This trace exists only in the reporting closure for that
request.

Vercel Hobby's one-hour Runtime Log retention is accepted for this immediate
operator inspection. Logs are not drained, copied into a longer-lived
diagnostic system, or treated as case persistence. Any later real-data boundary
must replace this synthetic-only logging policy before use.

## Deferred architecture

- Generic claim/evidence graphs, ontologies, event replay, messaging, separate
  read stores, multiple services, or synchronization.
- Durable or hosted sessions, cross-device recovery, accounts, collaboration,
  and saved-case storage.
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
- browser code creates or mutates semantic case values outside a complete
  server-returned `applyCaseCommand` result;
- any consequential write can bypass `applyCaseCommand`; or
- implementation requires duplicated authority, a weakened invariant, hidden
  fallback, or user-visible behavior absent from the approved product and
  experiment.

Approval of this document authorizes only the Experiment 1 architectural
hypothesis. It does not authorize implementation, real clinical data,
production deployment, full Form 3500 coverage, or deferred mechanisms.
