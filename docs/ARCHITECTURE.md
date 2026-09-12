# Wilson semantic architecture

**Status:** Experiment 1 hypothesis completed with qualified technical success;
Experiment 2's production-seed amendments were approved through Issue #42 and
PR #43; Issue #57 adds the bounded adaptive-completion amendment after
Experiment 2 concluded `Revise`; Issue #62 adds the bounded single-device and
product-quality generalization; Issue #64 adds combined report types,
semantic device-detail applicability, and stable-device correction/uncertainty
without changing the deferred live-model risk; Issue #37 restores fail-closed
live application-model selection for the protected Git-preview path; Issue #67
keeps the provider wire simple and visibly quarantines proposal-local faults
without weakening accepted case or output authority; Issue #66 makes the
bounded supported facts directly correctable and preserves withdrawn reviewed
products or tests as inactive history; Issue #78 retains incomplete reviewed
products for direct repair, adds explicit output-readiness policy, and makes
branch-dependent product facts and responsive operator controls truthful

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
revision. For the synthetic Experiment 1 and approved Experiment 2 previews
only, the browser may retain the latest server-returned case and interaction
state between stateless requests; it does not gain a second mutation path.

Implement this in one modular TypeScript application with model, PDF, and
temporary storage behind narrow adapters. Accepted Experiment 2 runtime changes
are production-seed code for its bounded scope, while browser-held storage,
synthetic diagnostics, and preview protection remain explicitly temporary
adapters. Do not introduce a generic knowledge graph, event store, distributed
CQRS, microservices, durable database, or framework-independent internal
platform.

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
  products[]        # stable ID, product category, and suspect/concomitant role
  relevantTests[]   # stable ID; result, ranges, and date stay together
  reporter          # direct clinician entry; never model-proposed
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

The implemented slices use explicit typed fields only for their selected
patient, event or product-problem, product, relevant-test, and reporter facts.
Product category and role are facts, and proposed products and tests remain
proposed until group review. A reviewed product or relevant test may become
`withdrawn` through one authoritative command; its stable identity, facts,
sources, and change record remain, while completion, model context, and output
exclude it from the active report. One bounded suspect-device shape shares the same
stable product identity and fact invariants while projecting to Section E. Its
explicit implanted fact determines whether implant and explant timing can earn
a clarification turn but is not itself a Form 3500 field; non-device suspects
continue to project to Section D.
Reporter facts enter directly from the clinician through `applyCaseCommand` and
never pass through the model. `Fact<T>` supplies consistent behavior without
claiming a complete Form 3500 ontology.

A reviewed product is not deleted merely because proposal-local quarantine
leaves its name, role, or category incomplete. It remains in the semantic case,
appears in the reviewed-case UI under a stable collection-ordinal label such as
`Product 2`, and can be repaired through the same direct typed command path as
other reviewed facts. Rejecting or withdrawing an earlier product does not
renumber later products. Zero retained products is a distinct state whose
operator action is to begin a new case, not to navigate to a nonexistent card.

### Stable entity identity

The application owns stable opaque case entity IDs. On opening input, the model
may group mentions under response-local product or relevant-test references;
the model boundary validates those groups and assigns case IDs before proposals
reach `applyCaseCommand`. A later model input receives the relevant reviewed
product and test IDs and may reference only those IDs for supported updates.
Stable identity is never derived from medicine or test name, list position,
fixture data, or a PDF row. The model proposes mention linkage; it does not own
case identity.

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
- resolve a conflict explicitly; and
- withdraw one reviewed product or relevant test without deleting its history.

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

Issue #66 adds no second correction boundary. Multiple typed changes drafted
inside one opening proposal group are submitted together to the existing group
review command. Once a group is reviewed, direct typed additions and corrections
use `record-clinician-facts`; the server derives fact versus correction intent
from the current fact, and a correction retains the previous resolved value as
superseded history. Report type and reporter facts use this same path. The UI's
explicit field-control registry supplies labels and input shapes only; the
domain-owned target/value contract remains authoritative.

One narrow automated source-boundary assertion must show that application
routes and UI modules cannot import lower-level mutation helpers. It may be a
focused test under the ordinary test command; no general architectural test
framework is required.

## Model responsibility

The model may propose typed patient, event, product, and relevant-test facts,
mention grouping or links to application-supplied entities, qualifiers, exact
verbatim supporting text, and the presence of a correction or unresolved
alternative. It may not propose reporter identity or contact facts. It may not:

- confirm, overwrite, or resolve case knowledge;
- choose among conflicting evidence;
- determine report completion;
- choose PDF widget identifiers; or
- create the Form 3500 projection.

A model may propose `unknown`, `explicitly absent`, `inapplicable`, or `declined`
only when the current clinician input states that meaning explicitly and the
proposal cites it. Those proposals remain unaccepted until ordinary review.
Absence of a proposal remains empty and never acquires one of those meanings.

The provider receives generated target/value guidance from the same domain-owned
value contract used by local decoding and the final command boundary. The
provider wire remains the simple proposal shape already exercised successfully;
provider guidance improves yield but is not accepted-case authority. A medicine
or other product named only as treatment administered in response to the event
belongs in the event treatment fact. It is proposed as a report product only
when the clinician separately describes it as suspect, concomitant, or
otherwise involved in the report.

The runtime model boundary classifies mechanically decidable contract faults
before review. Response-level faults reject the complete response and leave
accepted knowledge unchanged:

- the provider did not complete normally;
- returned content is not valid structured output;
- a proposal omits the minimum response-local reference, group, target, or exact
  citation needed to identify and display a truthful quarantine notice;
- proposal or source identities are duplicated or internally inconsistent; or
- every proposal is unrepresentable.

A response that preserves that minimum may contain a proposal-local
representation, target, resolved-identity, or exact-evidence fault. That
proposal is quarantined before source or proposal identity is created and never
enters the semantic case or Form FDA 3500. The remaining valid proposals attach
in one atomic command, and the clinician sees the omitted target, the exact text
the model cited, and a plain-language reason throughout the disposable tab
session. Declarations that lose every proposal are pruned, including product
declarations beyond the supported three-product limit; a relevant test is also
pruned when its required test-and-result proposal is quarantined. No value is
coerced, repaired, guessed, or retried.

The required-result pruning rule is an invariant, not a fixture convention:
tests must prove that a relevant-test declaration cannot survive when its
result proposal is quarantined. Exact-citation differences in capitalization,
punctuation, or spacing remain operator-visible quarantine failures. Record
such failures as evidence about the exact-location contract; do not tune the
fixture, add normalization, or sample a live model to make them disappear.

These checks are finite application-input validation, not a hallucination
guard. The model returns a self-contained exact quotation rather than character
offsets. Deterministic code locates its single exact occurrence, assigns source
identity, and records the resulting offsets. A successful match proves only
where the clinician's words appear; deterministic code does not establish that
the excerpt semantically supports the proposal. An absent or ambiguous match
quarantines that proposal as described above. Do not add fuzzy matching, broad
normalization, or fixture-specific source repair without a new approved premise.

The runtime boundary must not compare live proposals with an experiment's
expected proposal set, values, or source clauses. A structurally valid but
incorrect, omitted, unexpected, or unsupported proposal whose evidence anchors
successfully remains visibly proposed for operator review and cannot become
resolved without the ordinary clinician-review command. External semantic
oracles and human scoring determine whether an experiment run passes.

The supported adult medication adverse-event path uses one bounded,
deterministic completion policy. After opening proposals are reviewed, it asks
in order about missing suspect-product indications, unestablished serious
outcomes, death date only when death applies, missing relevant tests and medical
history, and reporter details. Accepted narrative facts suppress matching
questions; related outcome and clinical-context needs are grouped; every group
has authored wording and a plain-language reason. Unknown, declined,
explicitly-absent, and inapplicable answers close the recorded need without a
loop. A later reviewed correction may reopen a need only for a newly applicable
semantic target. Direct answers use `applyCaseCommand` without a model call.
This is not a generic follow-up planner, and model-generated question wording
remains deferred.

The Layer 2 generalization keeps that medication ordering unchanged. A selected
adverse-event report with one suspect device skips medication-indication needs
but retains applicable serious-outcome, clinical-context, and direct-reporter
needs. A selected product-problem-only report skips adverse-event and
medication-specific clarification and proceeds to direct reporter details once
its proposals are reviewed. Product availability is accepted as a semantic
report fact and projected to Section C. These are two bounded applicability
branches, not a general report-completion rules engine.

Layer 3 retains that ordering and adds two bounded branches. A clinician may
select adverse event and product problem together as one reviewed semantic
report-type value; both Form 3500 boxes then derive from that value, and the
adverse-event completion needs remain applicable. For one resolved suspect
device, an accepted implanted value makes empty implant and explant dates one
authored device-detail question, and accepted reprocessed-single-use status
makes an empty reprocessor identity part of the same question. Unknown,
inapplicable, and declined answers close those targets without a loop. A later
device correction or incompatible alternative continues to use its stable
opaque product ID and the existing supersession/conflict invariants. This is
not a generic device completion planner.

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

The production seed replaces the authored Experiment 1 sequence with
state-derived work. Pending opening proposals require review; the next
applicable bounded need requires clarification; a proposed correction or
conflict requires attention; otherwise the reviewed projection is inspectable.
The UI may offer actions only for semantic targets represented in the current
revision. It may not infer the stage from fixture input, product names, expected
values, or a fixed turn number.

For the bounded directly-correctable paths, typed controls cover the existing
text, age, date, boolean, enum, string-list, weight, reporter-destination, and
resolved missing-value shapes. A proposed product or relevant test may be
rejected during opening review. A reviewed product or test may be withdrawn
only after the case reaches output; it remains visible as inactive history and
is omitted from subsequent projection and PDF generation.

Output readiness is application-owned and separate from question completion.
For these bounded paths, output requires at least one retained product and at
least one complete suspect product whose name, role, and category are known.
Every retained incomplete product is named in the readiness explanation and
navigable for repair. A direct repair that makes a clarification newly
applicable returns the case to clarification with an explicit transition
notice; it does not call the model or bypass the command boundary. Multiple
suspect devices and a device in the concomitant role are outside the supported
projection and therefore block output explicitly.

A missing product category is never treated as implicitly non-device. The
projection omits category-dependent Section D, E, and F fields until category is
known. Once category is known, the reviewed-case card and semantic projection
show the selected branch while retaining any accepted or historical facts from
the other branch with an explicit not-carried-forward explanation. This keeps
clinician evidence visible without silently projecting it into an inapplicable
form section.

For the selected adult medication, single-device adverse-event,
product-problem-only, and bounded combined-report journeys, unresolved optional facts remain
omitted and visible but do not block output after proposals, corrections, and
applicable bounded needs have received their required review or direct answer.
Conflicting alternatives never project. The semantic projection supplies
omission reasons; the PDF adapter does not decide completion. A broader
report-completion policy remains deferred.

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

PDF preview and download use the same state boundary. They are client-initiated
non-GET requests carrying the complete versioned browser-held state; the server
validates that state, derives a fresh semantic projection, and returns only the
PDF response or a no-store error. The browser opens the returned bytes for
preview or downloads them without putting case state in a URL. A static PDF
link, cookie-derived case identity, server revision anchor, or process affinity
may not stand in for the complete state. This request-shape change is limited to
the disposable preview and does not create a second write path: PDF generation
remains a read-only projection of validated case knowledge.

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

The browser-held interaction state also retains any proposal-quarantine notices
for the life of the disposable tab so an acknowledged omission cannot disappear
after another review action. Those notices are not semantic case knowledge and
cannot project to the form. The bounded three-product, eight-relevant-test, and
ten-asked-need collection limits are domain-owned and enforced at the command
boundary as well as during browser restore, so an accepted write cannot create
unrestorable browser state.

Live application-model selection is fail-closed at the deployment adapter.
Explicit predetermined responses select the deterministic test adapter before
any live-model decision and never construct the Anthropic adapter. Otherwise,
the live adapter is available only when Vercel classifies the runtime as a
preview and supplies matching GitHub provider, owner, repository name,
immutable repository ID, non-`main` branch, and pull-request metadata for
`warblersafety/wilson-next`. Local development, CI, production, non-Git,
incomplete, and unknown contexts refuse before constructing Anthropic. This
gate governs the assembled application route; a separately authorized operator
model-evidence tool remains governed by its issue and Delivery's call controls.
The Vercel project must keep **Automatically expose System Environment
Variables** enabled for the preview; if those values are unavailable, the gate
fails safely by refusing the live adapter.

Vercel Authentication remains the access-control boundary for that preview;
the application gate is defense in depth and does not attest to Vercel's
independently mutable protection setting. Before any approved live preview
call, the operator verifies that deployment protection still covers the exact
deployment and that no public protection exception or bypass exists. A future
requirement for application-verifiable request authorization would reopen the
security architecture rather than treating Git or environment metadata as an
authentication claim.

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

Diagnostic classification follows the phase that actually occurred. A provider
or transport failure emits a model-response failure and no schema/domain
rejection. Once returned model content exists, diagnostics emit the returned
content before the precise provider-stop, JSON parse, structured-schema, or
domain-boundary rejection. An outer route catch may record route and response
failure, but it may not relabel a model/transport failure as schema/domain
rejection. This ordering applies at both the model-service and case-route
boundaries and preserves the same credential and synthetic-only content rules.

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
- Comprehensive question planning, full Form 3500 coverage, multiple devices,
  concomitant-role device projection, and device-depth behavior beyond the
  selected Layer 3 applicability and correction facts.
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

Experiment 1 evidence supports retaining the semantic case, single write
boundary, and case-to-projection separation as hypotheses worth testing again.
It does not automatically authorize their Experiment 2 generalization or
production use. Any follow-on experiment must name the retained and changed
architecture explicitly and still does not authorize real clinical data,
production deployment, full Form 3500 coverage, or deferred mechanisms.

Issue #62 supplies that named bounded follow-on for one device adverse event and
one product-quality-only report. Its deterministic evidence may support those
selected paths without establishing live extraction reliability, comprehensive
device coverage, real-data readiness, or production use.

Issue #64 supplies the next bounded follow-on for one combined device report,
one applicable-detail path, and one stable-device correction/conflict path. Its
deterministic evidence may support only those single-device paths and does not
establish multiple-device behavior, live extraction reliability, comprehensive
device coverage, real-data readiness, or production use.
