# Wilson semantic architecture

Owns current case knowledge, write/model authority, projections, browser recovery
and data boundaries. [Product](PRODUCT.md) governs outcomes; [Coverage](COVERAGE.md)
records remaining scope; [Delivery](DELIVERY.md) governs changes. This consolidates
approved contracts rather than introducing an ontology or a new behavior.

## Application shape and authority

One modular TypeScript/Next.js application uses stateless routes and narrow model,
PDF and browser-storage adapters. Domain code imports no model provider, PDF
library, framework or deployment code. Next.js is the shell: explicit route
handlers call commands/queries; no Server Actions, edge runtime, regeneration or
framework cache substitutes for case authority. The browser supplies the complete
versioned server-returned state with each request; there is no hosted case store,
server revision anchor, process affinity or cookie-derived case identity.

```text
clinician input -> proposed facts and exact source references -> explicit review
  -> applyCaseCommand -> one case revision
  -> understanding / gaps / review / semantic Form 3500 projection
  -> versioned PDF adapter -> bytes
```

The clinician's knowledge is primary. PDF widget names/coordinates/encodings stay
inside the adapter, never organizing upstream facts. The semantic projection
knows form concepts and carries sources/omissions. Output failure leaves the case
unchanged. Browser retention stores complete server results, never creates a
second semantic mutation path. This remains synthetic-only and non-production.

## Semantic case and changes

The case contains stable patient/event/product/test entities, direct reporter
facts, bounded need history, input/source records, and accepted changes. Products
have independent category and suspect/concomitant role. Relevant tests keep name,
result, ranges, date and stated context together under one stable identity.

A fact is empty, proposed, resolved or conflicted, with proposed values, at most
one resolved value, conflict alternatives, source IDs and superseded history.
Resolved meanings are known(value, optional qualifier/precision), unknown,
explicitly absent, inapplicable or declined. These are exclusive; empty does not
mean unknown or negative. Asked-needs history is interaction state, not truth.
Pending corrections leave the prior accepted value active until explicit review.
Acceptance supersedes it; conflict has no resolved value until human resolution.

Application-owned opaque IDs are not medicine/test names, list positions, fixture
keys or PDF rows. Opening model references are response-local grouping hints;
validated groups receive code-owned IDs. Later input receives relevant stable
IDs, including explicitly labelled pending interpretations. Genuine new or wholly
omitted tests can be declared locally; later product declarations are unsupported.
A declaration echoing an exact supplied test ID links to that existing test,
never allocating another. An unmatched correction reference cannot allocate a
new test; dependent proposals are quarantined, valid siblings remain reviewable.
A new test plus correction to its local reference in one response is unsupported;
retain its wording for restatement. This is containment, not proof of correct
clinical matching or a solution to paused semantic-targeting work.

Reviewed entities may be withdrawn, retaining IDs, sources/facts and history.
Completion, model context and PDF exclude them. Rejecting an earlier product
never renumbers later UI labels. Quarantined/incomplete reviewed products remain
visible for repair; no automatic deletion or guessed category. With zero retained
products the action is New case, not navigation to a missing card.

Sources retain ID/input ID/type, exact excerpt and applicable offsets, actor and
recorded time. Changes retain command/type, affected fact/entity/source IDs,
prior/resulting revisions and supersession/resolution. This is an explanation
trail, not a compliance graph or event-replay system.

Every consequential write uses server-side `applyCaseCommand`, with expected
revision and command ID. It applies at most once and commits the entire next
case/change or nothing. It enforces explicit review, material source evidence,
type-compatible existing entities, supersession, exclusive missing states,
conflicts without accepted alternatives, and stale/duplicate protection.
Routes, UI and read adapters cannot import lower-level mutation helpers; retain
the narrow automated source-boundary assertion. Typed group edits use the same
review command; reviewed additions/corrections use `record-clinician-facts` with
server-derived intent. UI registries supply labels/input shapes, not value authority.

## Interpretation and source grounding

The model proposes facts, mention linkage, qualifiers, correction/alternative
intent and supporting passage references. It cannot accept/overwrite knowledge,
resolve conflict, determine completion, choose PDF fields, construct a projection
or propose reporter identity/contact details. A non-known meaning may be proposed
only when the current input explicitly states and cites it. No proposal stays
empty, never automatically unknown/absent. Event-response treatment belongs in
treatment, not as a report product unless independently described as involved.
Symptoms and product-quality complaints are distinct; a specific denial is not
whole-list absence. Dose count/form/total wording stays literal, independently
of strength; no arithmetic or clinical normalization.

Code preserves complete input and assigns ordered sentence passages with offsets.
The model selects references, not copied quotations/offsets; code resolves exact
slices. Repeated wording gets distinct references. Multiple passages can support
negation, subjects, shared dates and corrections. Reference validity proves text
existence, not semantic entailment. A sentence can contain several claims;
clinical attribution still requires review. Source tables are transient inputs;
stored sources/history keep their representation. Never compare live proposals
with fixture/oracle expected facts or source clauses in runtime.

Generated provider guidance, local decoding and command validation share the
domain-owned target/value contract. Keep the provider wire simple. Reject the
whole response on incomplete provider termination, invalid structured output,
missing minimum displayable identity/group/target, duplicate/inconsistent proposal
or source identities, or no representable proposal. With truthful minimum identity,
representation/target/entity/source faults quarantine only the affected proposal
before creating source/proposal identity. Attach valid siblings atomically; prune
declarations with no surviving details. Do not coerce, repair, guess or retry.
The user sees omitted target, exact referenced wording or unavailable-source
notice and plain-language reason; notices survive workspace recovery.

A partial test survives if any supported detail remains, even without name/result;
B6 explicitly marks missing identity/result and retains the grounded date/ranges.
Never infer clinical vocabulary, units, normal ranges, date or specimen. Genuine
additions use ordinary review and capacity guards. Unfamiliar dictated terms stay
verbatim. Explicit collection-time uncertainty qualifies the named observation's
known date, or known name/result if date is unavailable; never fabricate a time,
transfer it to another test or treat a prompt instruction as omission detection.
Captured provider failures and authored expected-response mocks remain distinct.

Later review-group labels are scoped to validated entity kind/ID; shared labels
cannot merge medication/event/test groups. Labels within an entity remain separate.
Opening patient/event groups are code-owned. Unresolved targets are quarantined,
not inferred from group labels; all groups still require acceptance. During initial
review, review update groups before remaining opening groups. Accepting a correction
supersedes the older pending interpretation without accepting it; rejection leaves
that original available. Other facts on the entity remain unchanged.

## Clinical interaction and readiness

The details-screen gap panel is read-only. Clinical update typing/native dictation
is the primary clinical-answer path, followed by grounded proposal review and
acceptance. Pending proposals are not missing accepted answers; stopping/restart
proposals defer dependent gaps until review. Remaining-answer navigation focuses
Clinical update. Secondary field corrections and direct Reporter entry remain.
No competing direct clinical-answer forms or medication draft creation path.

Retain frozen decoders for earlier indication/outcome/death/context/medication/
device task drafts. Reconcile nonempty retired raw work into readable unapplied
retained work exactly once, without redundancy-based removal or replay. Existing
server answer actions remain supported for saved-state/domain compatibility; they
are not a new UI submission path. Reporter/secondary edits, date recovery, submitted
history and unsent updates retain protection. This UI contract changes no model,
completion policy, PDF or state version ([issue245](../evidence/issue-245/README.md)).

The bounded deterministic completion policy earns turns only for consequential
missing/applicable facts. Its medication ordering covers suspect indications,
unestablished serious outcomes, applicable death date, relevant tests/history,
medication history and Reporter. Product-problem-only skips adverse-event/
medication needs; combined reports retain adverse-event needs. Device needs key
applicable implant/explant/reprocessor targets per stable product, so answering
one never suppresses a later device. Related needs share authored wording/reason;
settled supplied facts suppress questions. Unknown/declined/absent/inapplicable
close their own needs without a loop; prerequisite corrections can reopen only
newly applicable targets. No generic planner or model-authored questions.

Output readiness is independent of question completion: pending groups/corrections
need attention, conflicts cannot print competing values, retained incomplete
products are individually navigable for repair. Require at least one retained
product and one complete known suspect name/role/category. Optional unresolved
facts remain disclosed partial output where supported. Repair can return to
clarification with a notice; no model call or hidden acceptance. Unknown category
never implies non-device. Role/category changes retain other-branch knowledge
with a truthful not-carried explanation. Collection limits are domain-owned:
[limits.ts](../src/domain/case/limits.ts) currently permits three products, eight
tests and 24 asked needs, enforced at writes and restore. Storage headroom is not
a question budget. Larger connected capacity requires a separate decision/slice.

## Patient and reporter semantics

Patient involvement is separate from identity/demographics: explicit known none
alone supports FDA A1 `none`. Empty, unknown, declined, inapplicable or wrapper
absence do not assert no patient. Do not infer it from unused packaging, symptoms,
report type or missing demographics. A literal `none` identifier (including legacy)
requires explicit correction, never migration into participation. Explicit no-patient
plus adverse-event report type, known demographic values (including known conflicted
alternatives), or a true B2 outcome/alternative blocks definitive A1 none/export.
Retain both sides for correction; never clear, infer or clinically reconcile them.
Historical/non-known/false outcomes do not activate the guard. Unknown participation
is not no-patient. The separate blanket B1/B2 consistency proposal remains unresolved.

A2 age is atomic: legacy numeric 0–150 means whole years; supplied whole months,
weeks/days are nonnegative safe integers with unit, retaining legacy `ageYears`
target identity. No conversion, rounding, DOB arithmetic or reinterpretation as
gestational/corrected/postmenstrual age. Fractional/compound wording remains a
limitation. Native age prints one exact value/unit within guarded geometry.
DOB is independent and uses shared complete/explicit partial-date contracts.
Clinician-only A2 print preference is not model-proposed. One known value with
no preference prints alone; both known without preference, or an unavailable
selected value, blocks fresh output. No fallback or comparison of age/DOB.
Unselected values/context stay retained with omissions and independent drafts.

The existing sex fact preserves reviewed male/female/intersex values; FDA A3 asks
sex at birth, but no relabelling, classification or inference is authorized.
Intersex leaves native boxes off and prints exact A3-linked wording/context plus
an explanation that birth basis was not inferred. Known male/female context also
uses that supplement; non-known states leave boxes off without old context.
Only the main form has A facts. Birth-basis guidance is a separate open decision.

A5 race/ethnicity accepts an explicit unique nonempty list of native categories,
including Middle Eastern or North African. Never infer from appearance/name,
geography, nationality, ancestry/language or map an unsupported identity to a
broader category. PDF uses canonical native order without changing fact order.
Unchecked means unselected, not denied. Empty known selection is an invalid draft;
non-known meanings remain distinct with blank boxes. Extra identity/negative or
partially unknown wording remains whole-list context and disclosed where uncarried.

Reporter identity is direct clinician entry through commands, never model-derived.
Report date is direct, visibly defaults to local browser date on the Reporter
step, records only on explicit provided/declined submission and can be cleared;
PDF generation never updates it. It is not derived from another date.
G1 raw country/address strings survive case/profile/drafts. Native country matching
permits only case/outer-space display equivalence, never aliases/geography.
Unmatched countries and overlong/multiline G1 text use exact field-linked
continuation with a native marker; no preset country or guessed choice. Known
G1 context prints there; other meanings do not acquire text. Unchanged reporter
base values preserve existing qualifiers on panel save; changing a base leaves
prior context in history, not on the new value. Reporter context editing is not
implemented by the base-entry panel. Occupation exceptions/glyphs remain bounded.

## Product, event and field-linked representation

### Medication and product facts

Dose and strength are independent literal text with units. Only supported simple
numeric-plus-literal-unit formatting splits into native amount/unit controls;
never calculate totals, extract compound amounts or convert units. Qualified
suspect quantities carry full wording/context in B5 with a pointer; if pointer
and amount cannot fit, native text says See B5 with unit blank. Unqualified
long/multiline dose/strength use D2/D1 exact supplements and blank native unit.
Route/frequency native matching uses formatting equivalence only. Other wording
stays verbatim; long/multiline text uses Other / D2 supplement and exact labelled
continuation. Qualifiers also carry D2-linked context. Never abbreviate, normalize,
shrink, clip or substitute glyphs to make a value fit. Blank accepted quantity/
route/frequency wording is retained with explicit export limitation.

Medication labels (brand, generic/biosimilar, OTC, compounded) are independent
explicit flags, including combinations, never inferred from molecule name.
D5 Check all applies broadly; only cosmetic professional/retail choice is Select
One. Cosmetic choice, routing category and explicit cannabinoid-hemp/Other set
remain independent. No automatic classification, routing change or component
split. Empty known sets are drafts, not negative responses. D5 Other-set context
is whole-set B5 wording tied to current suspect slot; other unsupported selector
context remains disclosed. No context alone satisfies base event-description readiness.

NDC/Unique ID preserves zeros, punctuation and spacing without lookup/coercion;
it is distinct from lot/serial/catalog/UDI. Seller name/address/city/region/postal/
country/website are independent reviewed text, not derived from manufacturer or
reporter. Websites are not fetched. Native purchase country matching is display
format equivalence only; UNKNOWN is a missing-value option, never a known-country
suggestion. Raw unmatched seller wording stays accepted but native limitations
block fresh export; G1's supplement support does not imply D1 seller exceptions.
All per-slot text/choice/glyph/geometry limits remain adapter-owned.

Current therapyOngoing is explicit and independent of stopped/restarted/dates.
Dates never imply it, and status changes do not clear dates. Supplied reduction
date likewise does not establish reduction or rewrite another fact. Contradictions
receive visible review/save notices without automatic resolution: stopped=true,
restarted=false, ongoing=true; or reduction date with explicit no reduction.
D7 requires explicit improvement/no improvement after known stop/reduction;
known neither supports Doesn't apply, except a contradictory supplied reduction
date withholds that derived answer and discloses its sources. D8 requires known
restart and explicit recurrence/no recurrence; never restarted supports Doesn't
apply. Unresolved/declined prerequisites/outcomes leave native boxes blank with
disclosure. Acceptance of false/inapplicable prerequisites invalidates a known
dependent outcome into superseded history; unknown/declined outcomes remain.
Changing back never resurrects it. These are observations, not causality judgments.

D3 duration preserves a supplied positive decimal spelling/native time unit or
explicit supplied dose-count/range/compound wording on exact linked supplements.
No subtraction, conversion, inferred unit, rounding or dose-count-to-time mapping.
D3 dates OR duration uses an explicit clinician-only print preference if both
alternatives are known. Missing choice/unavailable selected alternative blocks;
clearing preference changes no facts/drafts. Unselected alternatives are retained
and disclosed, not reconciled. Preference control applies only to suspect non-device
D3 routes; elsewhere retained preference has a no-destination disclosure.

### Dates and source-account recovery

New known complete dates use strict Gregorian validation (years 0001–9999),
including explicit conflict selection. No date repair, relative-date arithmetic
or inferred components. Legacy shape-only invalid accepted/pending/conflict/history
dates restore unchanged under frozen schemas; resolved invalid dates block output.
Correct invalid proposals in their original group; invalid conflict alternatives
cannot be selected. Explicit date/status recovery resolves only that invalid-date
exception, keeping prior alternatives/history; the new value cites its new
clinician source, not invalid alternatives. Raw impossible/partial drafts survive
reload and become readable earlier work if their context changes. No general
semantic-correction authorization follows.

Supplied month/year/year-only values have typed precision, explicit four-digit
year, optional month and exact nonblank cited wording; year-only has no month and
neither shape has a day. Claimed wording/year must appear in cited input; no
century inference for abbreviated/ambiguous dates. These supported families are
expiration; purchase/therapy start/stop/reduction; implant/explant; test dates;
event onset/death/discharge; product return; DOB. Full dates remain native
DD-MMM-YYYY where applicable. Partial controls use precise continuation markers
and exact wording/qualifier plus precision/no-missing-component explanation on
field-linked pages, not fabricated native dates. Print-choice suppression applies
before notes. B4 stays direct report date, not a general partial-date target.

Partial test notes follow current B6 row/field, not inferred test identity.
Event timing goes into labelled B5 statements; death date still requires explicit
death applicability. Return date/context requires explicit returned-to-manufacturer
availability; otherwise retain/disclose without projecting. Device dates remain
implant/explant, never therapy dates. Purchase dates keep their own meaning/routes.
Partial F expiration has row-linked notes; complete concomitant expiration retains
its existing no-native-destination disclosure. Other F date destinations are therapy
start/stop, plus the narrowly supported medication-history supplements below.

Review retains complete submitted accounts/read-back, not just selected sources;
ordinary editors can explicitly recover missed supplied wording. Legacy missing
accounts show labelled excerpts. This is manual source recovery, not an arbitrary
automatic omission detector or proof of model completeness. Ordinary precision
implementation is delivered; integrated source/readback/recovery acceptance is not.

### Narrative, comments and context

B5 carries accepted symptoms/product complaints, clinical course, treatment,
outcome/discharge context and applicable product context without inferred temporal
order or causal links. Symptoms/treatments use one qualifier on the entire list:
review/history/edits say Context for this list; B5 labels Symptoms/Treatment list
context separately. Preserve item order and exact context; never distribute it
into per-item claims. Scalar facts retain their own context. Non-known/conflicted
facts are individually disclosed, never converted to positive narrative.

B6 lab grid preserves reviewed name/result/units/ranges/dates, explicitly marking
missing identity/result. Qualifiers print in Additional comments under current
row and specific field; withdrawal recomputes both without moving context to a
sibling. B7 is raw accepted history plus labelled History context. Independent
general additionalComments is its own optional text fact, not automatic source
recovery or a substitute for B5 description. Native B6 Additional comments combines
labelled row context, general comments and comments context in that order with
separate provenance. Explicit overlapping comments stay; no automatic semantic
deduplication. Literal statuses are not neutral withdrawal (separate open work).

Omissions distinguish an entire unsupported fact from a printed base with omitted
qualifier, quoting exact current wording and target/source IDs. A final sweep
covers active current known qualifiers, including routing/prerequisite/availability
context. Never promote pending/conflicted/rejected/superseded/withdrawn wording.
Indirect support uses neutral context-not-included labels, not a claim the base
printed. A generic warning or available source is disclosure, not representation.
Known editors may reveal context controls without accepting anything; explicit
correction/removal keeps history. A qualifier-only omitted-context change updates
disclosures, not a false assertion that PDF bytes changed.

## PDF assembly and fidelity

The versioned adapter consumes the pinned [FDA source](../assets/fda/README.md),
checking hash before filling. Projection, readiness and adapter share supported
limits/encoding; adapter defenses repeat validation. Preserve native labels,
options, geometry, flags and blank controls; generate correct native appearances
while retaining FDA export IDs. Native readback reports actual widget values or
pointers, never reconstructs expected full text. Independent parser/page-content
readback and second-viewer/render inspection verify serialized output; pre-copy
semantic readback alone is insufficient.

B5/B6/B7 overflow uses exact section/block-linked numbered pages and a native
attachment pointer ending continued. Pinned native fit/glyph/MaxLen checks decide
when; fitting content stays native. Supplements use fixed 10pt/14pt-leading
wrapping that retains spaces, line breaks, blank lines and long-token characters.
Each page has block/field, current global product/device/row attribution and a
shared opaque report reference derived from case ID plus actual projected content.
This reference is export metadata, not A1 or clinical identity. Note text/block/
ordinal participate in keys/references; source/history-only changes do not change
printed content. New generation removes obsolete pages/pointers. Only current
reviewed eligible content prints, never a dump of sources or draft history.
Unsupported glyph/control characters block fresh export while retaining facts;
no shrinking, truncation, glyph substitution or forced clinical edits. Native text
guards and field-targeted diagnostics remain even when no qualifier is present.

The first two D suspects use the native main form. A third uses a complete
additional eight-page native form with only D filled in its first block. Each
suspect device beyond the first uses another complete native form with only E
filled; first E remains editable. Extra forms use fixed appearances and the
approved in-memory flatten/copyPages path to avoid duplicate AcroForm identities;
correct in Wilson and regenerate. Nonselected sections stay blank. Main references,
extra headings and supplements share global ordinals and current report reference.
Actual local slot geometry governs checks (third D uses local slot one), while
source/history/withdrawal/role changes retain stable identity and regenerate copies.
E qualifiers carry exact field/device-linked main B5 context. Save only once after
all headings/copies/notes: an intermediate save can cache streams and lose headings.
No encryption workaround or dependency change is authorized.

F includes explicit concomitant devices and drugs/biologics used at event time,
excluding event treatment. Native adapter has ten distinct name/start/end rows,
but the semantic case still retains only three products. Native F dates are
therapy dates, not implantation. Long/multiline names/context use exact row/field
supplements and truthful native pointers. Each page repeats its starting row/field
for detached attribution; extra D/E forms do not duplicate F facts/supplements.

Accepted concomitant drug/biologic dose, strength, route/frequency, indication,
ongoing status, reduction date, duration and stop/reduction/restart history print
automatically on linked F supplements. Explicit non-known answers keep distinct
labelled text, never invented native values. Improvement/recurrence labels require
the same settled applicable prerequisites as D7/D8; withhold/disclose otherwise,
without inferred Doesn't apply. Other/device regimen expansion remains deferred.
Qualifiers, multiline wording and exact date precision stay linked; unrelated
comments remain independent. No model/schema change or general omission detection
is implied ([issue243](../evidence/issue-243/README.md)).

A3, G1, partial-date and D1/D2/D3 supplements obey these same provenance, fixed-size,
reference and unsupported-glyph rules. All factual contributors participate in
freshness/content identity where their printed text changes. An earlier artifact
cannot be labelled current after a material correction, shortening or withdrawal.

## Browser-local workspace

The origin-scoped active IndexedDB record contains complete validated server
state, release/state-version provenance, typed UI drafts and retained invalidated
work. One user/browser, one active case; no account, backup, case list or cross-device
storage. Separate envelope and UI versions surround clinical state. A fresh opaque
UUID generation changes on every atomic snapshot/draft save and tombstone;
transactional expected-generation comparison rejects stale writers, including
external store recreation. Serialized/coalesced writes keep the newest unsaved
payload. Saved status requires the latest rendered payload's transaction acknowledgement,
not an older completed save. Browser commit is not guaranteed disk flush.

Before hydration, server resume strictly validates/migrates clinical state and
re-derives stage/snapshot without model/semantic writes; draft codec then validates
case/chronology/targets, representation and prerequisite fingerprints. Resume can
explain changed readiness; actions require expected revision/stored-stage equality
and explicit retry, never replay. Retain every supported persisted-version migration,
validating genuine historical schemas before widening, never relabelling malformed
current data as legacy. New fields start empty, preserving facts, sources, IDs,
revision/history and compatible unfinished work. [browser-state.ts](../src/server/case/browser-state.ts)
is the exact current version/migration source; migrations never reinterpret old
clinical text or infer newly available facts.

Invalid supported drafts remain readable earlier work, not active authority;
retain only invalidated pending fields, not duplicate unaffected edits. Confirmed
selective discard leaves accepted facts unchanged and retained work counts for
New case/unload guards. Unsupported/corrupt/cross-case decoding fails visibly
without destroying raw records or unmounting the current editable owner. Preserve
unfinished false/empty/unselected values and context-control visibility; blank
context is omitted only on explicit correction. Retain all opening/report selection,
update text, inline edits, Reporter and legacy task drafts by stable scopes.
Complete acknowledged submitted input history is separate from excerpts/unsent
text; legacy absent history is labelled. No saved network actions, PDF blob URLs,
busy flags or derived projections become persistence authority.

An exclusive native Web Lock precedes storage and case actions. Other tabs cannot
issue competing requests or force takeover; retry only after owner release.
In-flight writes settle before release; cancelled acquisitions register before
await so StrictMode replacements wait for predecessors. Generation comparison
still protects external/stale writers. Without storage/coordination, explicitly
chosen unsaved work never replaces retained work. Successful server responses
remain in memory before optional mirroring/writes; retry storage only, not action.
The composer stays editable during a request and acknowledges only submitted text;
mutation controls disable their pending action.

New case confirms all unfinished-work loss and uses explicit replacement. Confirmed
known-damaged discard compares the entire observed record in its transaction;
changed/now-valid/future records are never cleared. Uncomparable damage stays
retained. Future database/state/UI versions after rollback require a compatible
release, not destructive ordinary recovery. Clear retains a tombstone and prevents
legacy session reimport. Optional legacy session data is one-time input only if
no durable record; a distinct debug mirror is never loaded as authority. Normal
New case/debug cleanup cannot erase old tab data. Explicit confirmed damaged-legacy
recovery alone may remove it; different earlier data remains with a notice when
a durable case already exists. Optional session failure cannot reject accepted work.

Unsent work warns before unload. Closing mid-request can leave an unobserved
server/model result; saved words remain and no request repeats automatically.
Storage loss/eviction/private profiles, changed origins and OS crash/power loss
remain honest limits; a stable protected origin and actual restart/failure checks
are milestone requirements. Same-origin upgrade/rollback evidence is bounded by
its actual tested versions, not a universal compatibility promise.

### Separate reporter defaults

`wilson-reporter-profile` database version 1 has independent versioned reusable
identity/contact/occupation/explicit health-professional fields; no case state,
report date, destinations or disclosure. Profile record v2 permits raw country
wording; genuine v1 records/tombstones decode in memory with unchanged generation,
no eager write. Explicit remember/update/forget writes v2/new generation; older
apps preserve incompatible records. Forget has confirmation/tombstone and does
not change current draft/accepted case; New case preserves defaults.

Use copies into a draft, confirming replacement of entered identity; normal
Reporter Save alone accepts case facts. Automatic defaults apply once per genuinely
fresh case after loading settles, only to pristine/unaccepted Reporter drafts;
never seed restored or dirty work. Seeding becomes the baseline, not acceptance.
Stable profile owner survives remounts; ownership handoff rereads current defaults.
Failed intent keeps its original generation/exact requested snapshot for save-only
retry; later field edits are separate. Stale/corrupt/future data is not overwritten.
Reload is explicit with confirmation before losing a failed change; manual case
entry stays available. Pending/failed profile writes guard unload. No clinical
privacy-readiness or cross-origin/cross-device claim follows from convenience.

## Data, deployment and diagnostics

Case commands and PDF operations are non-GET complete-state requests, reject
mismatched Origin and return no-store state/error/PDF responses. Pages use noindex/
nofollow, which is not access control. PDF bytes live only in ephemeral browser
memory/object URLs, revoked after use; no state in URLs, retained blob URLs or
static PDF endpoint substitutes for the state boundary. A user can alter their
own storage; this is not secure clinical persistence or tamper-resistant authority.

Explicit predetermined test responses select the mock adapter before constructing
Anthropic. Otherwise live application-model creation fails closed unless Vercel
Preview provides matching GitHub owner/repository/immutable ID, non-main branch
and PR metadata. Local/CI/production/non-Git/incomplete contexts refuse. System
environment exposure is required for the preview gate; metadata is defense in
depth, not authentication. Vercel Authentication covers exact deployments; verify
protection/no public exception or project-wide bypass before any approved live call.
An issue-scoped expiring Shareable Link is a bounded purpose/deployment/data/call/
secret-handling grant, not general external participation or production authority.
See [Operations](OPERATIONS.md) for procedures and [Delivery](DELIVERY.md) for limits.

There is no analytics, session replay, audio capture or hosted retained case store.
The existing narrow synthetic diagnostic exception permits relevant request/model/
proposal/evidence/validation/command/state/response/error content in Vercel Runtime
Logs only, correlated by run/operation IDs. Never log auth headers, cookies,
API/deployment tokens, environment values, bypass secrets, browser storage, SDK
secret configuration or PDF bytes. Immediate phase events and a final sanitized
in-request reconstruction checkpoint remain request-memory only before logging.
Browser reports send immediately and include cumulative operation events; best-effort
non-blocking delivery has a one-second abort deadline, no UI acknowledgment or durable
queue. Reports can drop or arrive out of order; sequence/correlation remain necessary.
Provider/transport failures are not schema/domain rejections. Returned content logs
before precise stop/JSON/schema/domain rejection; an outer catch must not relabel it.
Hobby one-hour log retention supports immediate inspection, not raw-log export,
a drain or another diagnostic store. Real-data use requires replacing this policy.

## Deferred mechanisms and stop conditions

No hosted sessions/database/cache/worker/queue/object store, accounts/collaboration,
saved-case manager/cross-device sync, generic claim graphs/event replay/ontology,
FHIR/E2B platform, derivation framework or broad question planner. Full form coverage
remains the product target, not a delivered architecture fact. Capacity, pictures,
portable fonts and combination representation retain their separate decisions.

Legacy Wilson stays read-only unless separately authorized; preserve its Git/issue/
PR/gate evidence and private originals. A donor must be independent of the legacy
field-keyed record, revalidated against current external/product authority, carry
no field-centric API upstream, and be cheaper than rebuilding. Do not reuse Agenda,
field-state/proposal/ask/derive/gate orchestration, correction/conflict machinery,
field-based completion or coupled legacy UI/tests. Nightjar supplies no lifecycle,
workflow, dependency or authority: read only named historical Wilson evidence;
copy nothing into it. Do not publish private research/transcripts or reuse legacy
credentials. Legacy rename/cutover/archival remains a separate operational decision.

Stop expansion/reopen the owning premise if domain facts require widget IDs,
correction/conflict differs by input surface, repeated entities require positional
identity, conflicting alternatives print/resolve together, browser code mutates
semantic values, writes bypass commands, or delivery needs duplicated authority,
weakened invariants, hidden fallback or unapproved behavior. Historical experiment
success does not authorize broader implementation, real data or production use.
