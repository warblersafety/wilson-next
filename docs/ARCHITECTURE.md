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
branch-dependent product facts and responsive operator controls truthful;
Issue #83 adds one expiring, exact-deployment Shareable Link for a designated
synthetic-only cofounder walkthrough without creating a production release;
Issue #96 replaces model-copied quotations with code-owned source references
and permits conversational correction and test recovery before initial acceptance;
Issue #129 adds the bounded browser-local persistence foundation and the restore
contract required before future save/resume integration.

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
CQRS, microservices, server-side durable database, or framework-independent internal
platform. Issue #129 permits a bounded browser-local IndexedDB adapter for the
approved artificial-data target.

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
  relevantTests[]   # stable ID; identity, result, ranges, and date stay together
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

### Report metadata and medication quantities (Issue #90)

The report date is a directly entered event fact, excluded from model targets.
The reporter step visibly defaults it to the browser's local calendar date;
submitting either provided or declined reporter identity also records the
selected date through the command boundary. Clearing the date leaves it
unsupplied. It is separately correctable, and PDF generation never updates it.
Existing cases with no report date retain an empty fact, not an inferred date.

Dose and product strength are independent reviewed text facts including their
units. Dose describes the administered amount; strength describes the stated
amount per dosage form or concentration. Neither is calculated from the other.
The PDF adapter separates a simple numeric quantity and a recognized unit into
FDA controls. Descriptive quantities, qualified quantities, compound expressions and unsupported
units stay intact in the text control with the unit blank; no unit conversion
or concentration arithmetic occurs. The adapter generates the selected unit's
appearance and retains the FDA export value in the original dropdown options.

Browser state v8 adds these facts. A narrowly validated v7 upgrade supplies only
empty report-date and strength facts, preserving every existing fact, source,
change, revision and interaction notice. Other incompatible or malformed state
still fails visibly in the current disposable preview. For durable browser-local
integration, the Issue #129 restore contract below supersedes that preview-only
compatibility limit: retain migrations for every state version actually persisted
by supported releases, preserving accepted facts and history.

The output explicitly discloses remaining Section D other-category, purchase,
identifier, expiration, ongoing-therapy, reduction-date and duration gaps.
Download readiness remains the supported-path condition, not a claim of
complete FDA-form coverage.

### Medication history (Issue #92)

Suspect drug/biologic products receive a grouped task for missing stopping or
reduction history, with conditional stop date, improvement, restart and
recurrence answers. Reviewed supplied facts suppress questions. Partial
conversational answers keep newly applicable details in that same task;
unknown/declined answers close their needs without a loop. A later prerequisite
correction can create a newly applicable question. Other product categories
receive no new proactive medication questions.

D5 accepts explicitly supplied brand, generic/biosimilar, OTC and compounded
flags, including combinations. Category and medication label type are distinct;
no label type is inferred from a molecule name or asked by default. D7 requires
explicit improvement/no improvement after known stopping or reduction; known
neither selects Doesn't apply. D8 requires known restart and explicit
recurrence/no recurrence; never restarted selects Doesn't apply. Unresolved,
pending or declined applicability/outcomes leave corresponding checkboxes blank
with disclosures. These are temporal observations, not causality judgments.
Explicitly supplied supported facts can also project for non-device other
products; concomitant support is unchanged.

Authoritative acceptance invalidates a known outcome when its prerequisite
becomes false/inapplicable, preserving it as superseded history. Unknown/declined
outcomes remain. Changing the prerequisite back never resurrects old outcomes.
Projection also checks applicability, and review surfaces an unresolved
prerequisite for a supplied outcome. Grouped-need reconciliation uses settled
facts (resolved with no pending proposals) across conversation and direct input.

Browser state v10 adds five empty medication facts to validated v7-v9 drafts,
preserving facts, sources, histories and revisions. Asked-need storage has 24
entries: five ordinary groups, six medication groups, nine correction entries
and four headroom entries. This finite storage bound is separate from the
interaction budget; it does not authorize extra questions.

### Laboratory observations

Each relevant test has independent reviewed `testName` and `testResult` text
facts, plus ranges and an explicitly supplied test date. Identity includes the
stated specimen/context; result retains numeric or qualitative wording and any
stated units. Partial observations remain representable even if identity or
result is missing or rejected by the model boundary. No clinical vocabulary,
unit, range or date is inferred. Unfamiliar dictated terms remain verbatim for
source review; broad ambiguity detection is deferred, not a clinical validator.

Review shows missing identity and permits conversational correction or addition
before initial acceptance; existing direct fact controls remain a fallback. It does not block partial output or create repeated
completion questions. B6 combines reviewed identity and result, explicitly
marking missing identity/result, with both facts' source trace retained. Other
missing details stay blank with their existing omission reasons. Corrections
address the same stable test ID and leave other fields and tests unchanged.

Browser state v9 adds empty test identity facts to validated v7/v8 drafts,
retaining all combined legacy result text and its history verbatim. It never
splits that text into inferred clinical facts. New direct entries offer separate
identity/result controls and permit partial information.

### Stable entity identity

The application owns stable opaque case entity IDs. On opening input, the model
may group mentions under response-local product or relevant-test references;
the model boundary validates those groups and assigns case IDs before proposals
reach `applyCaseCommand`. A later model input receives the relevant reviewed
product and test IDs, including explicitly labelled pending interpretations,
and uses those IDs for supported updates. It may declare a genuinely additional
or wholly omitted test using a response-local reference; code assigns its stable
ID. An exact supplied ID echoed in the declaration list still links to the
existing observation and never allocates another entity. It must not declare a
new response-local identity to correct an existing observation. Later product
declarations remain unsupported and are quarantined locally.
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
mention grouping or links to application-supplied entities, qualifiers,
supporting passage references, and the presence of a correction or unresolved
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

For later relevant-test proposals, correction intent requires an application-
supplied existing test ID, including a still-pending or unnamed observation. A
response-local declaration cannot turn an unmatched correction reference into a
new observation. That declaration's dependent facts are quarantined with their
source excerpts; independent valid observations remain reviewable. This is
allocation containment, not clinical identity matching or proof that the model
selected the right valid ID. Genuine additions still use separate fact or
alternative proposals. A new observation and a correction against its own local
reference in the same response are not accepted through this path; the supplied
wording remains visible for restatement. The provider wire stays unchanged.

For later inputs, the model's review-group label is scoped to each validated
target entity kind and stable ID. Reusing one label for event history and a
medication therefore creates separate review groups; different labels within
one entity remain separate. This is mechanical group assembly, not clinical
reinterpretation: targets, values, qualifiers, intents and evidence are unchanged.
Opening patient/event groups are code-owned and do not use model group labels;
reused labels cannot merge those review units. Product/test declaration linkage
and distinct declared-entity groups remain required, and
the assembled groups are checked again to contain only one entity. Every group
still requires explicit acceptance; an unresolved target is quarantined rather
than assigned an entity from its group label. This bounded repair does not solve
incorrect model attribution or conversational test identity.

The interpretation contract distinguishes patient manifestations (symptoms) from
actual product-quality complaints (problemDescription), including reports with
both. Compatible manifestations and specific denials form one symptoms list;
a specific denial is not whole-list absence. Supplied medication count/form
wording and stated total are retained together in dose, independently of strength,
without arithmetic. These instructions guide extraction, not runtime clinical
normalization. Known-value qualifiers remain visible during review, and B5
symptom/product-complaint and D6 dose/strength output carries their accepted
qualifiers. Existing accepted facts are not silently reinterpreted or repaired.
Non-carried symptoms and product-complaint facts are individually disclosed in
output omissions, including absent, unknown, unmentioned and conflicted states;
they are not invented as positive B5 narrative. The contract guidance has bounded
synthetic evidence, not an established reliability rate; clinician review remains
necessary. Qualifier output for other field families and individual omissions for
other non-known B5 narrative fields remain follow-up #115.

The runtime model boundary classifies mechanically decidable contract faults
before review. Response-level faults reject the complete response and leave
accepted knowledge unchanged:

- the provider did not complete normally;
- returned content is not valid structured output;
- a proposal omits the minimum response-local identity, group or target needed
  to identify and display a truthful quarantine notice;
- proposal or source identities are duplicated or internally inconsistent; or
- every proposal is unrepresentable.

A response that preserves that minimum may contain a proposal-local
representation, target, resolved-identity, or source-reference fault. That
proposal is quarantined before source or proposal identity is created and never
enters the semantic case or Form FDA 3500. The remaining valid proposals attach
in one atomic command, and the clinician sees the omitted target, the exact text
resolved from its selected references (or a notice that supporting text could
not be identified), and a plain-language reason in a concise expandable
disclosure throughout the disposable tab session. Restating missing information
through Clinical update is available during understanding, clarification and
output; a wholly omitted test can be recovered without restarting. Declarations that lose every proposal are pruned, including product
declarations beyond the supported three-product limit. No value is coerced,
repaired, guessed, or retried.

Issue #91's approved partial-observation support supersedes the former
required-result pruning rule. A relevant-test declaration survives when at
least one supported detail remains, even if identity and result are both
missing: for example, an independently grounded test date stays attributable
and repairable with its source. Tests must prove that the invalid proposal
stays quarantined, surviving facts do not gain inferred identity/result, and
B6 explicitly marks both missing details rather than silently losing the date.
A declaration with no surviving detail is still pruned. This can consume one
of the bounded eight test rows; the clinician can repair or withdraw it.
Historical `incomplete-relevant-test` notices remain readable when restoring
older preview state but are no longer emitted by current extraction.

### Code-owned source references and initial-review recovery (Issue #96)

The application preserves the original input and segments it into sentence
passages with code-assigned references and offsets. The model receives the
ordered passage text and returns one or more references per proposal. Code
resolves them against that same original input and builds the existing Source
records with exact slices and offsets. Repeated wording has distinct references;
missing, duplicate or invented references quarantine only the affected proposal.
Multiple passages preserve subjects, shared dates, negation and corrections that
span sentences. A sentence may contain several claims; reference selection and
clinical attribution still need clinician review.

These are finite input checks, not a hallucination guard. A valid reference
proves source existence, not semantic support. Values are never unconditionally
decoded, normalized or clinically repaired. The model no longer reproduces
supporting quotations or computes offsets. Source-reference tables are transient
extraction inputs; stored excerpts, sources, review history and PDF machinery
retain their existing representation. Valid legacy drafts remain readable.

During initial understanding review, conversational updates receive stable IDs
and explicitly labelled pending values as linkage context, never as current
input evidence or accepted truth. Review update groups before the remaining
opening groups. Accepting a correction supersedes the older pending interpretation
of that fact without accepting it, retaining its value and source history.
Rejecting the update leaves the original proposal available. Other facts on the
same entity remain unchanged. A new test retains the normal proposed-entity
review and eight-test capacity bound; excess additions do not discard valid
siblings. Source references do not establish overall extraction reliability.

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
history, medication treatment history, and reporter details. Accepted narrative facts suppress matching
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

Issue #126 aligns readiness with the bounded PDF's two non-device suspect slots
and one concomitant slot. Exceeding either blocks export with an explicit
capacity notice while retaining every product, fact, source and history entry.
Readiness and the adapter share these output limits; the adapter guards remain.
The existing one-suspect-device and unsupported-concomitant-device rules remain.
Only an explicit clinician change can alter roles or withdraw products; capacity
checks never make those changes. This is limitation disclosure, not continuation
pages or complete overflow support.

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

## Browser-local persistence amendment — Issue #129

The approved artificial-data target adds durable browser-local recovery of one
active case, for one user per browser, without accounts, server storage or a
cross-device requirement. All patient, reporter and contact information remains
fictional. This amendment supersedes the blanket storage deferral below for
that bounded target, not the real-data/security boundary.

Issue129 established a native IndexedDB adapter with one active-case record,
initially without UI wiring. Issue139 integrates that foundation as described
below; prerequisites alone did not deliver end-user save/resume.
A separate envelope version and storage generation surround the complete
server-returned BrowserJourneyState and a separately versioned JSON draft
container. Storage reads leave clinical state opaque/untrusted; integration
uses the server restore boundary as follows:

- Validate/migrate the complete clinical state and preserve its accepted facts,
  evidence, proposals, conflicts and history. Retain migrations for every version
  actually persisted by supported releases; do not drop them when the preview
  version window advances. Unsupported versions must remain recoverable records.
- Re-derive the current stage and snapshot after validation. The current preview
  resume operation re-derives the snapshot after validation and migration, so
  `assertStoredStage` does not reject valid saved cases when current policy
  changes applicable questions. Actions still require stored-stage and expected-
  revision equality; clients resume first, then issue any explicit action.
  Resume explains a changed review stage, including newly required details
  before PDF readiness, without altering clinical state.
- Validate each typed UI draft before hydration and surface any invalidated draft
  without silently losing the complete saved record.
- Inner-state incompatibility, including rollback to an older deployment, must
  preserve the record and visibly explain that a compatible release is needed.
  Never reuse the current preview `loadJourney` discard-and-start-over path for
  persisted data. Include the writing release/state-version provenance in the
  integration envelope so recovery can identify the required compatible release.

Issue137 delivers the stateless clinical-resume prerequisite: existing v7/v8/v9
migrations remain alongside v10, resume validates and re-derives without a model
call or semantic write, and each JourneyResponse adds provenance with the current
state version and a strictly validated public 40-hex deployment commit (null when
unavailable). Provenance is outside clinical state and is not authority or a
claim that a record has been saved. Integration must capture that provenance in
the durable envelope. The testing checkpoint must verify that the protected
deployment actually reports its matching commit; a locally validated fallback
is not deployed-release evidence. UI hydration, retained incompatible records and the
remaining browser lifecycle requirements are still integration work. Storage
never accepts facts or creates a second semantic write path.

Each write uses a fresh opaque UUID generation identifier, so external database
loss/recreation cannot reuse a counter that an old tab still holds. A native
readwrite transaction compares the expected generation and commits
the entire record atomically. Draft-only changes must also advance storage
generation. Stale writers fail instead of overwriting newer work. Replacement
is a distinct operation; clear preserves a generation tombstone rather than
resetting it. This prevents a stale tab from matching a reused generation.
Corrupt or future-version records are not silently erased or overwritten.
Failures leave the previous committed record intact and are reported explicitly.
The original foundation had no destructive recovery API. Issue139 adds an
explicit, confirmed corrupt-record discard path with a full observed-record
comparison inside its native transaction; explain the loss before clearing it. Preserve newer-version records/database versions after
rollback rather than offering destructive replacement as ordinary recovery; use
a compatible release. While recovery is blocked, users may continue with an
explicitly unsaved in-memory case, with a persistent warning and no writes to or
replacement of the retained record. Never silently fall back or claim it is saved.

The adapter uses the browser default transaction durability. Transaction
completion confirms an atomic browser commit, not guaranteed disk flush: an OS
crash or power loss may lose the latest completed save. Integration saved-status
wording must disclose this limit unless strict durability is implemented and
verified on supported browsers. Native transaction commit is not an off-device
backup or a guarantee against storage eviction, browser/profile/site-data loss
or a changed origin.

Later integration must capture opening text/report selection, clinical-update
text, reporter drafts, direct field edits and every unfinished completion task
(indications, outcomes, dates, tests/history, device and medication answers),
keyed to stable case/entity/group/question identities. Preserve pending
proposals, conflicts, source evidence and quarantines in the server state.
Do not store derived readiness/projections as authority, PDF blob URLs, busy
flags or replayable network actions. Restore must never resend model requests
or automatically accept changes. Writes failing after a successful server
response must retain that response in memory; retry storage, not the action.

The integration slice must test real browser restart, saved/unsaved status,
confirmed replacement, corrupt/incompatible/unavailable storage, typed-draft
invalidation and same-browser multi-tab behavior before claiming resume works.
Integration must serialize its own tab's saves, report saved status only after
transaction completion, and retain unsaved work when handling a stale-write error.
Generation checks protect storage commits; they are not a complete single-writer
UI or prevention of simultaneous model requests. Integration must explicitly
coordinate active tabs before issuing actions and surface stale work safely.
A stable protected origin is a deployment prerequisite: storage does not follow
changing preview hostnames. No origin/access or infrastructure change is made here.

Issue #135 adds a controlled, case-scoped typed UI snapshot for opening/report
selection, unsent updates, screen, reporter case drafts/dirty baseline, inline
edits and every completion task. Stable entity/question scopes and prerequisite
keys retain current invalidation behavior. Baseline fingerprints guard drafts;
they never become authoritative facts. Qualifier-control visibility is captured
with the card, so an empty or whitespace edit remains editable across remount;
blank qualifiers are omitted only at explicit correction submission, as required
by the existing command contract. The strict JSON codec distinguishes
unsupported versions/tasks from corrupt or cross-case records without coercing
empty/false/unselected values. Restore decoding occurs before React dispatch;
a failed decode leaves the current owner and raw input intact. Expected internal
draft validation failures retain the owner and surface a recoverable message
rather than unmounting the journey. Issue135 alone was in-memory capture;
Issue139 connects that owner to durable storage.

Complete submitted opening/update words are retained separately as case-bound
input history after successful acknowledgement; unsent drafts remain distinct.
Case source excerpts contain selected spans and cannot reconstruct full input.
Input-history entries are neither accepted knowledge nor replayable actions.
The starting-description view reads its history entry; submitted updates have a
collapsed history control. Legacy tab states without complete input history show
only an explicitly labelled excerpt. Before persistent hydration, the validated
clinical snapshot must also validate draft targets/dependencies and surface any
invalidation without silently destroying the retained saved record.

Reusable reporter details require a separate record/store and lifecycle. They
must survive starting a new case, seed a draft rather than silently change an
accepted case, and support explicit editing/forgetting. Case-specific report date,
reporting destinations and disclosure choices stay with the case by default.
No reporter profile persistence or portable backup is implemented by #129.


### Reusable fictional reporter defaults — Issue141

A separate `wilson-reporter-profile` IndexedDB database (version1, `reporter`
store, `remembered` key) retains only the editable identity/contact strings,
occupation and explicit health-professional boolean. Its strict versioned
record has a fresh generation on every transaction, including Forget tombstones;
atomic generation comparison rejects stale writers. Neither clinical state nor
report date, destinations or disclosure choice can enter this record.

The existing Reporter form remains the editor. Remember/update snapshots its
fictional reusable fields; Use copies defaults into the current draft, with
confirmation before replacing entered identity. These operations never accept
facts or change case-specific choices. Normal Add/Save reporter details remains
the only case acceptance action. Forget requires confirmation and leaves the
current draft/accepted case untouched; New case preserves remembered defaults.

Only a genuinely fresh case may receive automatic defaults, once per case in
the current UI owner, after profile loading/saving settles and only if the
reporter draft is pristine and no reporter facts are accepted. Restored cases
and dirty drafts are not seeded. Automatic defaults become the draft baseline;
unaccepted identity still warns the output workflow that reporter work remains.

Profile operations live in a stable owner across case/Reporter remounts. Loading
and readiness are scoped to acquired workspace ownership, so a formerly blocked
tab reads current defaults after handoff. A failed pending profile intent retains
its original comparison generation rather than silently advancing it on case reload. Failed
writes retain their exact requested snapshot for explicit save-only retry;
subsequent case-field edits are separate work. Stale/corrupt/future records are
not replaced. Reload is explicit, with confirmation before discarding a failed
profile change. Manual case entry remains available when profile storage fails.
Pending profile writes/failed changes guard unload. Browser storage limits are
the same as the active case; this is fictional-data convenience, not an account,
backup, privacy-readiness claim or cross-origin/cross-device feature.

### Integrated browser workspace — Issue139

The active record now wraps the complete validated clinical state with a v1
workspace container: response provenance, the v1 typed UI snapshot and separately
retained invalidated drafts. Before hydration, resume validates/migrates clinical
state and derives the snapshot; the workspace codec checks case, chronology and
format identity. Target reconciliation checks current entities, fields, editor
representations, question identities and prerequisite fingerprints. Incompatible
records remain untouched. Invalidated supported drafts leave the editable owner
and remain readable as historical reference in the same durable workspace.
Only invalidated pending fields are retained; unaffected live edits are not
duplicated. The wording does not claim they can never be applied explicitly
later. A confirmed discard removes selected earlier edits without changing
accepted facts, and retained work counts for New case/unload protection. Existing input
history remains separate from facts; no saved action or model request is replayed.

A native Web Locks exclusive lease precedes reads, writes and case actions. A
second tab cannot issue competing case requests; it can retry after the owner
closes. There is no forced takeover. In-flight native writes settle before a
same-page owner releases its lease on unmount; cancelled pending acquisitions
are registered before their first await, so StrictMode replacement effects wait
for their own predecessor to finish without competing with it; generation CAS remains necessary
for external/stale writers and browser storage recreation. Without coordination
or storage, an explicitly chosen new unsaved case never writes/replaces retained
work. This is not a simultaneous collaborative editor.

A coalescing queue serializes complete atomic snapshots, retaining the newest
unsaved state across failure. Saved status compares the latest rendered payload
to its acknowledged transaction; an older acknowledgement cannot label newer
typing saved. Clinical mutation controls are disabled during their pending action;
the independent update composer stays editable and acknowledges only submitted
text. Successful responses stay in memory before optional session mirroring or
durable writes. Retry save never repeats the action. A stale-stage action can
perform read-only resume and ask for explicit review/retry; it does not replay it.

New case confirms loss of all unfinished work and uses explicit replacement.
Known damaged records offer confirmed discard, comparing the exact observed JSON
record transactionally; changed, now-valid and future records are not cleared.
Unsupported non-JSON damage that cannot be safely compared stays retained and
cannot use that discard path. Damaged inner payloads use full-envelope comparison
as well as generation. A durable clear keeps a tombstone and suppresses legacy
session reimport. Future database/state/UI versions require a compatible release;
ordinary recovery does not erase them. Optional legacy session storage is only a
one-time input when no durable record exists and a best-effort debugging mirror.
The old `wilson-journey-state-v2` source key is never used for the new mirror;
`wilson-current-case-debug-v1` is separate and is not loaded as authority. Normal
New case/debug cleanup cannot erase old tab data, including during unsaved
recovery. Only explicit confirmed damaged-legacy recovery removes that source.
When a durable active case already exists, different earlier tab data stays
unchanged with a notice rather than being imported over it. This transition is
not a case-list feature. Neither adapter is persistence authority, and optional
session failure cannot reject accepted work.

Unsaved work warns before document unload. Browser-default durability still has
the OS crash/power-loss limit above; site-data loss/eviction, private profiles and
changed origins remain outside recovery. Closing a browser during an uncompleted
action can leave an unobserved server/model result; saved text is retained and no
action is automatically repeated. Native process-restart and failure acceptance,
full regression checks and independent review are delivery gates. Reporter profile
persistence is delivered separately by Issue141 above. Protected stable-origin
deployment verification remains a milestone gate.

### Reviewed context disclosure — Issue115 first slice

Projection omissions distinguish an entire fact not carried from a known base
value carried without its reviewed qualifier. The latter records
qualifier-not-included, exact qualifier wording, stable target and current
resolved-value source IDs. It never promotes proposed, rejected, conflicted or
superseded wording into a current qualifier. Existing symptom/problem and
suspect dose/strength qualifier representations remain unchanged; no qualifiers
are concatenated into date, boolean, enum or numeric controls by this slice.
Mapped base values and the existing B5 treatment/outcome/discharge sentences,
stop statements and applicable medication outcomes disclose their uncarried
qualifiers. Non-known/conflicted treatment, outcome and discharge-date facts
have individual omissions, without inventing narrative statements.

The existing coverage panel opens for partial qualifier omissions and quotes
exact omitted wording with the entity/field label. Output and return-to-PDF
messages distinguish supported PDF values from omitted context. The PDF content
key remains a hash of actual output sections: a qualifier-only omission change
updates the disclosure but does not pretend the PDF bytes changed. This is
explicit partial-output disclosure, not faithful representation of that context
inside the downloaded artifact. Issue115 remains open for the actual supported
representation contract and the qualified-quantity unit decision.

The existing fact editor can reveal its optional uncertainty/context control
for any known editable value. Reveal alone accepts nothing; save still uses the
same command boundary. Draft visibility/text follow the existing typed workspace
owner; explicit remove/reopen/add preserves superseded context and source history.
There is no new storage schema, model interpretation, causality assessment,
clinical inference or layout system. Glyph/fit support is not expanded; the
separate issue154 portable-appearance risk and issues151/153 remain open.

### Native PDF representability — Issue128

Supplied suspect-product route wording selects an actual FDA route option only
by case/outer-space formatting equivalence. Otherwise the adapter selects Other
and writes the original wording verbatim in the corresponding Other Route field.
It never guesses an abbreviation or a more specific clinical category. Both
suspect slots use the same encode/readback contract; unknown/declined facts stay
non-known. Accepted blank/whitespace route, frequency, dose or strength wording
has an explicit pre-export limitation and stays retained. Fresh form generation
cannot retain stale Other wording after an explicit native-route correction.
Accepted facts, identity, source and history are unchanged by output formatting.

The PDF-owned product-text helper shares readiness/adapter encoding and limits.
Other Route/Frequency text must fit the pinned native single-line rectangle at
its unchanged8.5pt size, existing padding and current Helvetica appearance font.
Native options and geometry are checked independently against both PDF slots.
Longer, line-breaking or unsupported-glyph text stays accepted/projected but is
blocked explicitly before export. Never shrink, clip, replace glyphs, shorten or
silently normalize supplied wording to fit. Native field flags stay unchanged.
[Issue153](https://github.com/warblersafety/wilson-next/issues/153) owns faithful
support beyond these controls; this temporary limitation is not full support.

The pinned native A3 controls offer only Male/Female. A reviewed intersex value
stays accepted and projected, but a structured unsupported-patient-sex readiness
issue blocks preview/download before the adapter's retained guard. The existing
review/output surfaces explain that limitation, including when an earlier PDF
exists. This is not a request to substitute a different value, not full support,
and not clinical inference. [Issue151](https://github.com/warblersafety/wilson-next/issues/151)
owns the remaining faithful supplemental-representation decision. Broader field
coverage, continuation and qualifier fidelity remain separate. Current official
form/instructions, local verification and limits are recorded in
[issue128 evidence](../evidence/issue-128/README.md).

## Application and data boundary

```text
browser UI + retained case/interaction state
                    -> application commands and queries -> case domain
                                                    |-> model adapter
                                                    |-> FDA PDF adapter
```

Use stateless application routes on Vercel. The browser retains the latest
server-returned case, revision and complete pending interaction state in the
origin-scoped active IndexedDB workspace and supplies the clinical state with the
next command or query. Session storage is an optional legacy/debugging adapter.
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
the synthetic preview and does not create a second write path: PDF generation
remains a read-only projection of validated case knowledge.

This is deliberately not a secure clinical persistence design. A reviewer can
alter or delete their own browser storage. The same browser/profile/origin can
resume the single active case; only one tab edits. Other browsers/devices and
cleared/evicted site data cannot recover it. Vercel has no authoritative case
repository, revision anchor or session affinity record; transient request/model/
diagnostic processing remains subject to the existing synthetic-data policy.
These limits are acceptable only because the preview is synthetic-only,
access-restricted and non-production. Hosted persistence, cross-device recovery,
tamper resistance, and any real-clinical-data boundary require a later
architecture decision.

Domain code has no model-provider, PDF-library, framework, or deployment
imports. The browser-held state is a deployment adapter concern and does not
change `applyCaseCommand` as the sole semantic write boundary.

The browser-held interaction state also retains any proposal-quarantine notices
with the complete browser workspace so an acknowledged omission cannot disappear
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
deployment and that no public protection exception or project-wide bypass
exists. A URL-scoped Vercel Shareable Link is permitted only when an owning
issue names the external-review purpose, exact deployment, synthetic-data and
call limits, secret-handling boundary, and platform-enforced expiry. Issue #83
authorizes one such link for the exact verified cofounder-review deployment
with a 604800-second TTL. Its ordinary URL stays protected, its bearer secret
is not durable evidence, and the exception conveys no production or general
external access authority. Any broader requirement for
application-verifiable request authorization would reopen the security
architecture rather than treating Git or environment metadata as an
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
request. Issue #118 makes browser reporting best effort and non-blocking:
report delivery never gates useful request dispatch, accepted-response handling
or error feedback. Each fetch has a one-second abort deadline to release network
resources. Timeout, offline state, navigation and browser keepalive payload/in-flight
quotas can drop reports; completion is
not acknowledged by the UI. Reports may arrive out of order, so correlation,
sequence and cumulative trace remain necessary. This is not a durable log queue
or a guarantee that runtime logs contain every browser event.

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
- Hosted sessions, cross-device recovery, accounts, collaboration and a saved-case
  manager. Browser-local recovery of one active artificial-data case is selected
  above; full case/draft integration is still pending.
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
