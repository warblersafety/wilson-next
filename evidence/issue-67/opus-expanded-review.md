# Issue #67 — expanded architecture and product review (Opus, xhigh)

## Context

Issue #67 reopens the live-model contract deferred by Issue #55. Two failure
classes were recorded in Experiment 2 Stage 4 against a rich medication
opening: `event.symptoms` arrived as a scalar where the domain requires a
string list, and acute event treatments were proposed as concomitant report
products. A later independent device journey produced free text
(`available for evaluation`) for `event.productAvailability`, which admits only
three semantic values. In every case local validation rejected the whole model
batch atomically, so accepted case state stayed safe and the user action failed
before review.

The branch `codex/67-live-model-contract` answered this by making the
provider-facing schema structurally target-dependent (v11 at `d2bcaa3`,
published at `94136b6`). The first protected live request with that schema was
rejected by Anthropic with HTTP 400 `invalid_request_error` **before
generation**: no response, no accepted command, no tokens, no cost. The raw
provider message was deliberately not retained, so the attribution to compiled
grammar complexity is an inference. v12 at `fe8baaf` rewrote the provider wire
into entity/value buckets (under 16 KB, zero `anyOf`) and passes deterministic
checks, but has never been sent to the provider.

This review asks whether the governing premise — that the provider must emit
mechanically perfect typed values — is the right one, and what the smallest
coherent resolution is.

---

## Executive verdict (plain English)

**Filling this form does not require provider-perfect typed model output, and
pursuing it is what broke the live path.** Wilson already re-validates every
value twice after the model speaks — once when decoding the response and once
inside `applyCaseCommand` — and nothing reaches the PDF that has not been
reviewed by a clinician and re-checked at the write boundary. Tightening the
provider schema therefore buys **yield**, not **safety**, and v11 bought that
yield at the price of a request the provider would not even accept.

**The real defect is not that the model returned a badly typed value. It is
that one badly typed value out of dozens destroys the whole case.** Atomic
rejection of an entire model batch is not a safety invariant — the safety
invariant is that `applyCaseCommand` commits completely or not at all, and that
nothing becomes accepted truth without review. Both survive intact if Wilson
attaches the representable proposals and holds the unrepresentable ones out,
**visibly**, with their exact quotation and the reason.

**Recommendation: neither A nor B as stated. Take the narrow third option.**
Keep the provider schema exactly as it is on `main` (a shape the provider has
actually accepted), add generated field-type guidance as *description text*
only, keep the one general treatment-versus-product prompt sentence from v12,
and move the target/value check from "reject the response" to "quarantine the
proposal and show it". Salvage `value-contract.ts` and the enumerated matrix
tests from v11; discard the bespoke provider schema compiler and the wire
encode/decode from v11 and v12. **Close PR #71 unmerged** as a falsified
premise, retaining `fe8baaf` and its evidence record. **Amend Issue #67 in
place** — its outcome is still right; two of its clauses are now known to be
wrong and need Steve's decision.

One additional blocking defect found on `main`, unrelated to schemas but
directly reachable from the recorded failure: the browser-state validator caps
products at 3 while the write boundary has no cap at all. A model that proposes
a fourth product commits successfully and then kills the case on the next
request. Fix it inside this work.

---

## What I inspected, and limitations

Inspected read-only at `14aa6a4` (clean `main`): `README.md`, `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, `docs/DELIVERY.md`, `docs/EXPERIMENT-2.md`;
`src/domain/case/{model-boundary,types,commands,internal,completion-policy,
projection,views}.ts`; `src/server/model/{anthropic-journey,journey-model,
configured-journey}.ts`; `src/server/journey/service.ts`;
`src/server/case/{browser-state,repository}.ts`; `src/server/pdf/form-3500.ts`;
`app/api/case/route.ts`; `app/journey.tsx`; `tests/architecture/
source-boundary.test.ts`, `tests/server/anthropic-journey.test.ts`,
`tests/domain/*`; `evidence/experiment-2/stage-4/README.md`.

Then `git show`/`git diff` on `94136b6` (v11) and `fe8baaf` (v12), including
`evidence/issue-67/README.md`, `src/domain/case/value-contract.ts`, the v12
provider bucket schema plus `encode/decodeProviderModelProposalOutput`, and all
test deltas.

Limitations (material):

- `node_modules` is absent in this worktree and I made no network calls, so I
  could **not** execute `zodOutputFormat`, measure `main`'s serialized schema
  size, or independently confirm the v12 record's claim that SDK 0.124.0 demotes
  Zod `const`/`enum` into descriptions. That claim is not load-bearing for my
  conclusion (see diagnosis), but it is unverified here.
- I ran no tests and made no model or provider calls.
- I did not read PR #71 or Issue #67 on GitHub; I used the authoritative records
  supplied in the brief plus `evidence/issue-67/README.md` at `fe8baaf`.
- Whether the v12 schema would be accepted by the provider is **unknowable
  offline**. My argument against it does not depend on predicting that.

---

## Independent diagnosis (formed before reading the remediations)

**1. Wilson already has complete, authoritative, deterministic type enforcement
— twice — and it does not involve the provider.**
`assertValueMatchesTarget` in `src/domain/case/commands.ts:448` runs inside
`applyCaseCommand` on **every** attach and **every** accept. The model boundary's
`knownValueMismatch` (`src/domain/case/model-boundary.ts:284`) is a near-verbatim
duplicate of it. Provider-side typing would be a *third* copy of the same rule,
in a language Anthropic compiles, with limits Wilson cannot see. The only
enforcement that can never be delegated is exact evidence anchoring
(`locateEvidence`), and that is inherently local.

**2. The recorded failures are fully explained by `main`'s own schema, with no
inference required.** In `modelProposalOutputSchema`, `value` is one generic
`z.union([string, number, boolean, string[], measurement])` *independent of the
target*. A scalar `symptoms` and a free-text `productAvailability` are both
legal in that union. This is a real defect and Issue #67's root-cause finding is
correct.

**3. But the product consequence comes from a different line.** Both failures
funnel into `boundaryIssue(...)`, which throws a `ZodError` out of
`parseModelProposalEnvelope`, which the adapter wraps into `ModelCallFailure`,
which the route renders as HTTP 422. The case never advances past revision 0.
The physician's ten correct facts die with the one bad one. Fixing the schema
lowers the probability of that event; it does not change its cost. Any residual
model error — and there will always be one, because semantic errors like
treatments-as-products are outside the reach of any schema — still costs the
whole case.

**4. The second recorded failure class proves the point.** Treatments proposed
as concomitant products is **mechanically valid**. It passes every schema, v10,
v11 or v12, and always will. It is caught only by a human looking at a product
card and pressing *Remove*. That is exactly what proposal-before-acceptance
exists for, and in Stage 4 the physician never got to use it — because the
unrelated `symptoms` scalar had already destroyed the batch.

**5. Consequently the governing premise is wrong in a specific way.** Issue #67
asks whether "one general target-dependent model contract" can make both
openings reach review. The honest answer is: a target-dependent contract helps,
but it is neither necessary nor sufficient, and locating it at the *provider*
converts a recoverable, observable, partial failure (a bad value in a response
you can read and diagnose) into an unrecoverable, opaque, total one (HTTP 400
before generation, with the message intentionally discarded). That trade is
strictly bad for a system whose stated priorities are diagnostics, exact
evidence, and low physician friction.

**6. Precision must be absolute in exactly three places, none of them in the
model response:** `applyCaseCommand` (accept-time type and exclusivity checks),
`projectForm3500` (conflicting alternatives never project; omission reasons are
truthful), and the versioned PDF adapter (checkbox encodings derived from
already-validated enums). All three hold today and none depend on model output
being well typed. The model's typed precision is a *yield* property.
Its verbatim evidence quotation is the one thing that must be exactly right, and
that is checked locally against the clinician's own text.

**7. A latent defect on `main`, reachable from the recorded failure.**
`src/server/case/browser-state.ts:157` caps `products` at 3; nothing in
`commands.ts` or `internal.ts` caps products at all, and `journeyResponse` does
not validate outgoing state. A response proposing four products (the rich
`TEST-68` account with treatments-as-products already yields exactly three)
commits at revision 1, is stored by the browser, and then fails
`parseBrowserJourneyState` on **every subsequent request** with
`malformed-browser-state`; a reload clears the session. The case is lost after a
successful write. This is silent loss of accepted work and should be fixed at
the write boundary, not the restore boundary.

---

## Recommended finished-product flow

**Clean response.** Describe → *Check understanding* (cards with evidence,
inline change, remove product) → Accept → the deterministic completion
questions that earn their turn → Inspect output → preview/download.
**One model call.** Unchanged from today.

**Mechanically malformed response (scalar `symptoms`, free-text
`productAvailability`, non-ISO date, unknown field, unresolvable product
reference, or an unanchorable quotation).** The representable proposals attach
and the case advances. The *Check understanding* screen shows, above the cards,
a plain-language panel:

> **Wilson could not record 2 statements.** They were not added to the case and
> nothing was guessed.
> • Symptoms — from "he developed diffuse hives and facial swelling" — Wilson
>   needs a list of symptoms and received a single phrase.
> • Product availability — from "The device is available for evaluation" —
>   Wilson records only *available*, *not available*, or *returned to
>   manufacturer*.

No coercion, no repair, no retry. The physician accepts the rest and proceeds;
the affected facts stay `empty` and remain visible as omissions in the output
summary. If a dropped fact matters, the ordinary "Add a correction or later
update" box already re-proposes it against the reviewed entities — one extra
model call, entirely at the physician's discretion.

**Semantically ambiguous or wrong response (treatments as products, wrong role,
wrong entity).** Unchanged and correct today: the proposals reach review as
proposals, the physician removes or corrects them, and nothing becomes truth
without an explicit accept. The one general prompt sentence from v12 reduces how
often this happens. **No new clarification-question machinery** — the completion
policy already asks only about indications, serious outcomes, death date,
clinical context, device details, and reporter, and Experiment 2's stop
conditions forbid a general question planner.

**Response-level failure (provider did not complete, non-JSON, envelope shape
invalid, duplicate identities, a group spanning entities, or *every* proposal
quarantined).** Whole response rejected, revision unchanged, recoverable error
with a diagnostic reference. Exactly as today.

---

## Comparison of the material options

| | A. Provider-perfect (v11/v12) | B. Reviewable suggestions as stated | **C. Recommended: unchanged wire + quarantine** |
|---|---|---|---|
| Fixes scalar/enum yield | Yes, if the provider accepts the schema | No (prompt only) | Partly (description guidance), residual quarantined |
| Fixes treatments-as-products | No (semantic; out of schema reach) | Prompt sentence | Prompt sentence |
| Cost of one residual model error | Whole case dies | One fact, visible | One fact, visible |
| Provider-acceptance risk | **Realised once (HTTP 400); still unverified for v12** | None | None (wire shape unchanged) |
| Failure diagnosability | Worst case: none retained | Full response retained | Full response retained |
| New machinery | Bespoke schema compiler + wire encode/decode (~430 lines) that must track the domain | Screening + deterministic question generator | Per-proposal fault collection (~80 lines) + notice (~20) |
| Duplicated authority | Third copy of the type rule, in provider JSON Schema | No | No |
| Verifiable offline | Only by proxies (byte size, `anyOf` count) for an *inferred* limit | Yes | Yes |
| Issue #67 stop conditions | **Already tripped** (second schema iteration; provider rewrite) | Requires amending the "weakening atomic rejection" exclusion | Requires amending the same exclusion |

Two things decide it:

1. **v12 has already tripped Issue #67's own stop conditions.** The issue says
   to stop for a premise decision if a remedy needs "a second prompt/schema
   iteration" or if structural compatibility requires a "provider rewrite".
   v11 was the first iteration (`wilson-target-contract-v1` /
   `grounded-proposals-v11`); v12 is the second (`-v2` / `-v12`) and its own
   record describes it as changing "the provider wire representation". The
   correct response to that is a premise decision, which is this review — not a
   third attempt.
2. **v12's deterministic evidence cannot reach the thing that failed.** Its
   tests build wire payloads with `encodeProviderModelProposalOutput` and then
   decode them, proving `decode(encode(x)) == x`. Nothing exercises the
   provider's compiler — the same blind spot that let the Sonnet review pass v11
   the day before the 400. The `{optionalProperties: 18, anyOfNodes: 0,
   anyOfBranches: 0}` and `< 16_000` assertions freeze an *inference about an
   undocumented ceiling* into a regression test. That is not weakening a test to
   bless a workaround, but it is worse in one respect: it looks like proof and
   is not.

Option B as written is right in spirit, but two of its four elements should be
dropped: "proposal-by-proposal validation" is already how the domain works and
needs no new screening layer, and "deterministic clarification questions" is a
new question planner that Experiment 2 explicitly defers. What remains is
option C.

---

## Recommended change: scope and estimated impact

**Salvage (cherry-pick from `94136b6`):**

- `src/domain/case/value-contract.ts` — one domain-owned table of the accepted
  known-value shape per entity/field, plus `knownValueMismatch` and
  `assertCaseValueMatchesTarget`. This is genuinely good and is worth merging on
  its own: it removes the duplicated ad-hoc checks in `commands.ts` (−74 lines)
  and `model-boundary.ts`, and it is the natural source for generated prompt
  guidance. It also tightens the accept-time check (rejects unsupported extra
  properties and empty qualifiers, which `main` does not).
- The browser-state age bound fix (`130` → `150`, matching the domain).
- The enumerated field/type matrix tests in `tests/domain/model-boundary.test.ts`
  and `tests/domain/case-commands.test.ts`, retargeted at the contract table.
- The single general prompt sentence about treatments versus report products,
  and its `ARCHITECTURE.md` paragraph, verbatim.

**Discard:** `providerModelProposalOutputSchema`,
`encodeProviderModelProposalOutput`, `decodeProviderModelProposalOutput`,
`providerProposalBuckets` and everything under them; the `schemaComplexity` and
byte-ceiling assertions; the `ARCHITECTURE.md` paragraph claiming the
provider-facing schema couples targets to value shapes.

**Build:**

1. `src/server/model/anthropic-journey.ts` — keep
   `zodOutputFormat(modelProposalOutputSchema)`. Attach a generated
   `.describe()` to the value union (and/or the `field` enums), derived from
   `caseValueContracts`, naming which fields take lists, booleans, ISO dates,
   and which enums admit which values. Text only: no new `anyOf`, no structural
   change to a wire the provider has accepted. Keep the treatment sentence. Bump
   `MODEL_PROMPT_REVISION` / `MODEL_SCHEMA_REVISION`.
2. `src/domain/case/model-boundary.ts` — `parseModelProposalEnvelope` collects
   **per-proposal** faults into `unrepresented: Array<{ field, entity, rawValue,
   evidenceQuote, reason }>` instead of throwing, for: known-value/target
   mismatch, unknown field, unresolvable product/test reference, and evidence
   that is absent or ambiguous in the clinician input. Keep throwing for
   **response-level** faults: envelope shape, duplicate references, a group
   spanning entities, and — new — *all* proposals quarantined.
   Prune declarations that lose their proposals (a declared product or test with
   nothing left, and specifically any relevant test whose `testResult` was
   quarantined, since `assertCaseInvariants` requires it), moving the remainder
   into `unrepresented`. Create no source for a quarantined quotation.
3. `src/server/model/journey-model.ts` — carry `unrepresented` on
   `ParsedModelProposalEnvelope`/`ModelProposalResult`.
4. `src/server/journey/service.ts` — exclude `unrepresented` from the attach
   command, return it on the action snapshot, and emit it on the existing
   `schema-domain / proposal-envelope` diagnostic event.
5. `app/journey.tsx` — render the notice in `UnderstandingTask` (and in
   `UpdateReview` for the correction turn) with quote, human field label, and
   reason. Use `fieldLabel()`; never show enum values raw — spell them as the
   preview already does (`replaceAll("-", " ")`).
6. Product cap: enforce the browser-state limit at the write boundary
   (`attachGroundedProposals`, alongside the existing eight-test cap) so a
   fourth product is refused atomically at attach and reported as
   unrepresentable, instead of committing and then breaking restore.

**Impact:** roughly 8 source files, ~250 net new lines plus ~225 salvaged table
lines, against v12's ~700 including a schema compiler and a second wire format
to keep in sync. No change to `applyCaseCommand` semantics, projection, PDF
adapter, completion policy, browser-state version, or the fail-closed preview
gate.

**Known limitation to state in the PR:** `unrepresented` rides on the action
response and not on browser-held state, so a tab reload during review loses the
notice while the diagnostics retain it. That is consistent with the preview's
existing disposable-state limits and avoids a browser-state version bump. If
Steve wants it durable, it belongs in interaction state (`browserStateVersion`
→ v6), not in the semantic case.

---

## Physician friction and model-call count

| Scenario | Model calls | Extra physician work |
|---|---|---|
| Clean opening | 1 | none |
| Opening with 1–2 unrepresentable proposals | 1 | read a 2-line notice; optionally restate later |
| Physician chooses to restate a dropped fact | +1 | one sentence in the existing update box, then one accept |
| Semantic error (treatments as products) | 1 | press *Remove* on each wrong product card — already a designed control |
| Today, same malformed response | 1 (wasted) | **dead end**; no path forward but a new case |
| v11 as shipped | 1 (wasted, no output) | **dead end** |

The rich `TEST-68` journey needs one opening call and roughly four deterministic
clarification turns; none of that changes. The whole point of the recommendation
is that the malformed row stops being a dead end.

---

## Safety and verification boundaries (what must not move)

Preserved exactly:

- `applyCaseCommand` remains the sole write boundary and remains all-or-nothing
  per command. Quarantine changes *which proposals are in the batch*, decided
  before the command is constructed — it does not make a command partially
  apply.
- No coercion, no fuzzy matching, no repair, no normalisation of a rejected
  value, no automatic retry. A quarantined proposal is reported verbatim and
  never enters the case in any form.
- Nothing resolves without explicit review; correction still supersedes;
  conflicts still never project.
- Evidence stays exact: a quotation must still occur exactly once in the
  clinician's own text, and a proposal whose quotation fails still never
  attaches.
- Projection, PDF adapter, checksum, and the versioned form authority are
  untouched.
- The fail-closed preview gate in `configured-journey.ts` is untouched.

Changed, and requiring Steve's approval because it is a governing premise:

- `ARCHITECTURE.md` currently says an absent or ambiguous match "rejects the
  proposal batch before attachment". Under this recommendation, a per-proposal
  fault quarantines that proposal; response-level faults still reject the
  response. That sentence must be amended, and the amendment must say plainly
  that partial attachment is only acceptable because the drop is shown to the
  clinician with its exact quotation.

---

## Disposition of PR #71 and Issue #67

**PR #71: close unmerged.** Delivery's own rule covers this exactly — "If an
experiment falsifies its premise, close without merging and retain a named
branch or commit until its disposition is decided." The premise that a
provider-supported keyword set would be accepted was falsified live at
`94136b6`. Retain `94136b6` and `fe8baaf` as named commits and keep
`evidence/issue-67/README.md` — its SDK analysis, enforcement matrix, and the
sanitized 400 record (`dpl_EXbZxHhY1rDbB2Ru6nw6gnFgkcsi`, provider request
`req_011Cew4Dib652UvrYZkybZ2M`, diagnostic reference
`71f9e30b-...`) are the most valuable artefacts on the branch and must survive.
Open a fresh branch/PR that cherry-picks the salvage list above.
Continuing PR #71 by force-simplifying it is acceptable if Steve prefers fewer
artefacts, but it then needs a full fresh standard review, not a targeted
recheck, because the contract and the failure semantics both change.

**Issue #67: amend in place, do not replace.** The outcome sentence, the two
named openings, the evidence bounds, the no-retry rule, the diagnostics
requirements and the exclusions of Issue #66, fixture logic, coercion, repair
and real data are all still correct and worth keeping attached to one trail.
Three clauses need Steve's decision:

1. Acceptance — "provider output makes target/value compatibility structural to
   the practical extent supported" → replaced by: local decoding and the command
   boundary make target/value compatibility structural; the provider receives
   truthful guidance only, on a wire shape it has demonstrably accepted.
2. Excluded scope — "weakening atomic rejection" → replaced by: command
   atomicity and accepted-state safety are invariants; whole-response rejection
   for a single per-proposal fault is not, and is replaced by visible
   quarantine. Response-level faults still reject the response.
3. Stop conditions — record that the "second prompt/schema iteration" condition
   was reached at `fe8baaf` and that this review is its premise decision, so the
   next attempt is a first iteration of a different premise, not a third bite at
   the same one.

Because those are premise changes, they sit outside standing execution
authority (`DELIVERY.md`, "changing a material product, architecture, privacy,
security, clinical-data, or experiment premise"). They are Steve's call; the
implementation that follows is not.

---

## Evidence sufficient before Steve tests Wilson

**Deterministic (all offline, no spend):**

1. A recorded-failure fixture: one response containing *both* Stage-4 defects
   plus valid proposals attaches every valid proposal, advances the revision,
   and returns exactly two `unrepresented` entries carrying the exact quotation,
   the field, and the reason.
2. Response-level rejection still leaves revision 0: non-JSON, bad envelope,
   duplicate references, group spanning entities, and the all-quarantined case.
3. The enumerated matrix (salvaged): every model-visible field asserted against
   its contract, both accepted and rejected, at the decode boundary and again at
   `applyCaseCommand`.
4. A fourth product is refused at attach and the case stays restorable.
5. One Chromium e2e assertion that the notice renders with its quotation on the
   *Check understanding* screen and that the remaining cards are accepted
   normally.
6. A serialized-schema byte-size guard against a **conservative** ceiling with a
   comment stating it is a proxy for an inferred, undocumented provider limit —
   not an exact reproduction of v12's numbers.
7. Unchanged: PDF agreement, projection, completion-policy and source-boundary
   suites must all still pass.

**Live (bounded, exactly two calls, retries disabled, ordinary application route,
protection verified immediately before each):**

- Call 1: the fictional rich `TEST-68` medication opening, submitted as
  `adverse-event`.
- Call 2, **only if call 1 completes**: the fictional Acme conditional-device
  opening, submitted as `product-problem`.

Success means each opening reaches ordinary review with no invention, no
material omission beyond what the notice truthfully reports, no wrong
attribution, no retry and no fixture repair. **A non-empty quarantine list is a
pass, not a failure**, provided every entry is shown truthfully — that is the
whole design. Record model and request identifiers, prompt/schema revisions,
tokens, latency, estimated cost, and one sanitized mechanical and semantic
verdict per call; retain no raw provider payloads.

Note one honest caveat: `main`'s current schema revision (`v10`) has itself
never been sent live — Stage 4 ran at revision 7, before the Layer 2/3 device
fields were added. The shape is identical and only the field enums grew, so the
`anyOf` count is unchanged, but call 1 is also a schema-acceptance test. Run the
medication opening first for that reason.

---

## Material uncertainties and stop conditions

Uncertainties I could not close offline:

- The exact cause of the HTTP 400 is an inference; the raw message was
  discarded. Any future schema work should retain the sanitized provider error
  message — it contains no case content and its absence cost this issue a full
  live attempt.
- `zodOutputFormat`'s actual transform in SDK 0.124.0 is unverified here
  (`node_modules` absent, no network). Verify it during implementation and
  record the serialized bytes; if it turns out to demote the `field` enums to
  descriptions as well, that strengthens the recommendation rather than
  weakening it, because it means the generic union was never structurally
  enforced at all.
- Whether guidance text materially improves typing yield is unknown and will
  stay unknown at n=2. Do not claim a rate from these calls.

Stop and return to Steve if:

- the same target/value class recurs *and* the quarantine notice fails to make
  it intelligible to the reviewer;
- treatments recur as report products after the one general clarification;
- any remedy needs case-specific logic, coercion, response repair, retry, or a
  second prompt/schema iteration within this issue;
- a material invention, silent loss, wrong-entity attribution, or case/PDF
  disagreement occurs;
- accepted-state safety, exact evidence, stable identity, or the authoritative
  write boundary would have to weaken;
- more samples, real data, physician participation, or spend above the standing
  cap become necessary.

## Verification

- `npm run typecheck`, `npm test` (vitest: domain, server, pdf, architecture),
  `npm run build`, and the Chromium e2e journey with predetermined responses —
  all must pass before the PR is ready, with the new quarantine and
  response-level-rejection tests included.
- Manual: run the assembled journey locally with a predetermined response
  containing both recorded defects; confirm the case advances, the notice lists
  both with their quotations, the PDF preview and download still work from the
  reviewed remainder, and a reload behaves as documented.
- Then, and only after the required fresh standard review, the two bounded
  protected live calls above.
