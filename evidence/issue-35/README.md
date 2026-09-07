# Issue 35 operator-preview evidence

**Status:** Required reviews, approved planning remediation, implementation,
and deterministic verification complete; the reviewed prompt/operator-evidence
remediation passed its deterministic gate, but its one authorized protected
live run failed before operator review and independently exposed a systematic
source-offset defect; no further review, implementation, or live run is
authorized

**Issues:** [#35](https://github.com/warblersafety/wilson-next/issues/35) and
[#34](https://github.com/warblersafety/wilson-next/issues/34)

## Review boundary

Steve required fresh-context review and any resulting remediation before
application implementation. The review therefore targeted planning commit
`5cdb4866871ada4e8cf4309b9ad483154beaf664`, the complete `main...HEAD` diff,
the governing corpus, both issue bodies supplied in the invocation context, and
the relevant existing application code. No Slice 4B application code or live-
model call preceded it.

The standard `wilson-review-v1` review used Claude Code 2.1.241,
`claude-sonnet-5`, and `high` effort in a fresh read-only session. Subscription
preflight passed through `claude.ai` on Steve's active Max subscription;
`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_BASE_URL` were
unset. The first sandboxed invocation reached no verdict because DNS could not
reach the Claude API. Steve approved one recovery invocation outside that
network restriction; it was recovery of the failed review, not an additional
reviewer or second completed pass.

## Prompt

The invocation supplied neutral repository, commit, issue, scope, acceptance,
and stopping metadata, identified the run as the required pre-implementation
gate, and included this verbatim `wilson-review-v1` directive from the target
commit:

> Review this exact Wilson change and find material reasons it should not
> merge. Inspect the complete diff, issue, governing artifacts, relevant
> surrounding code, and acceptance evidence. Check correctness, missing
> behavior, regression risk, and whether the implementation hides a faulty
> requirement or architectural premise. Do not edit anything. Report only
> BLOCKING findings and independently valuable FOLLOW-UP findings, with
> evidence and precise locations. State what you inspected and ran, material
> limitations, and explicitly say when no findings remain.

The final neutral instruction asked the reviewer to treat a planning
contradiction, missing consequential decision, impossible acceptance condition,
or scope gap as a pre-implementation finding and not to edit.

## Actual findings and limitations

Claude reported two blocking planning findings and no follow-ups:

1. The planned removal of process-local case state left the anchor-based GET
   PDF preview/download route with no allowed way to receive browser-held case
   state. That would prevent the required case/projection/preview/PDF agreement.
2. Issue #34 named diagnostic conflation in the model service, but the outer
   case-route catch also labeled every downstream failure as schema/domain
   rejection. Fixing only the first site would leave provider/transport errors
   misclassified in the sole diagnostic surface.

The reviewer inspected the complete branch diff; Product, Architecture,
Experiment 1, and Delivery; the relevant case, repository, route, model,
diagnostic, UI, and test code; and the current published Vercel duration limit.
It could not access GitHub directly because no repository App credential was
available inside its read-only environment, so it relied on the exact supplied
issue text and local repository artifacts.

## Dispositions

- Architecture and Experiment 1 now explicitly select client-initiated,
  state-bearing PDF POST operations. The server validates the same complete
  versioned browser state used by case commands before deriving the projection.
  The browser opens or downloads ephemeral returned bytes, never puts case state
  in a URL, and retains no PDF bytes or object URL. Stable-link and right-click
  behaviors are intentionally unsupported in this disposable preview.
- Architecture and Experiment 1 now bind Issue #34 to both diagnostic sites.
  Provider/transport failure produces no schema/domain-rejection event;
  returned content is recorded before its exact parse, schema, domain, or stop
  rejection; and the outer route catch records only route/response failure for
  downstream model failures.

Steve approved the consequential PDF transport decision and both finding
dispositions on 2026-09-06 before application implementation began. At that
checkpoint only the governing plan had changed; the implementation and
verification described below followed afterward.

## Deterministic implementation gate

The implementation removes process-global case/session state. Every command and
PDF operation supplies the same complete, versioned browser-held state; each
server request validates it and reconstructs a fresh request-local repository.
The browser keeps the disposable case only in the current tab's
`sessionStorage`, supports safe reset and same-tab reload, and uses state-bearing
PDF POST responses only as ephemeral blobs. Unsupported stable-link and generic
Change/Remove affordances are absent. The two supported controls—changing the
patient age to 58 and removing lisinopril—execute ordinary reviewed case
commands and remain truthful through the final projection.

The Issue #34 diagnostic remediation records provider transport failures only
as model/route/response failures. When a provider returned content, the model
response is logged before any precise provider-stop, structured JSON, schema,
or domain-boundary rejection. PDF request/state rejection and PDF-generation
failure also have distinct diagnostic sources and phases. All visible failures
carry the request's opaque operation reference.

Local verification on 2026-09-06 passed:

- `npm run typecheck`
- `PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test` — 15 files, 74 tests
- `npm run build`
- `npm run test:e2e` — both the seven-stage journey and the complete supported
  Change/Remove alternate path

The bounded `deterministic/` evidence contains three screenshots, the official
PDF returned by the state-bearing download operation, its hash and runtime
metadata, a sanitized checkpoint trace, and independent pypdf readback. It does
not contain browser storage, request bodies, network/session archives,
credentials, or PDF bytes in diagnostics. Independent readback found an
unencrypted eight-page form whose accepted fields match the final projection;
the rejected 12-Aug-2026 alternative is absent and the chosen 13-Aug-2026 value
is present.

## Protected deployment gate

Implementation commit `41952f1ed268ec5e1bd1f3a2226f402c4805ec49`
deployed through the Git integration as
`dpl_2XdAF5Et9456GqvLNVK8NnPjeMhg`. Vercel reported the exact feature branch,
pull request, and commit; `READY`; `STAGED`; `target: null`; and only the branch
preview alias. GitHub `verify` and both Vercel checks passed. An unauthenticated
request returned HTTP 302 to Vercel Authentication.

The first values-excluding environment read found no hosted runtime variables,
so work stopped before an application route or live-model call. Steve then
installed `ANTHROPIC_API_KEY` directly through Vercel and authorized the required
redeployment and final review. A second values-excluding read confirmed exactly
one `sensitive` variable named `ANTHROPIC_API_KEY`, targeted only to `preview`.
Its value was never retrieved or copied. This evidence update is the meaningful
branch checkpoint that triggers a fresh Git preview containing that runtime
configuration; it does not use Vercel's production or direct-deploy path.

Commit `afbb376aaa30c6e8b226ad7bdd266632127ad7d5` hardened nested diagnostic
redaction and the ephemeral PDF popup found by the pre-live local gate. Its Git
integration deployment was `dpl_DVsnVE4bkYZPXGHjGRFzcHxPi7na`, with branch
alias `wilson-next-git-codex-35-operator-live-preview-warblersafety.vercel.app`.
Vercel reported the exact commit, `READY`, `STAGED`, and `target: null`; GitHub
`verify` and both Vercel checks passed before the live run.

## First protected live operator gate

The one authorized run on 2026-09-06 used the protected branch alias and a
temporary automation bypass held only in process memory. It first exercised a
non-fixture rejection, then submitted the fixed opening account once and the
fixed correction account once. The application has provider retries set to
zero. No failed live request or journey was retried.

The opening result reached Check understanding, retained the three correct
product identities and roles, and restored after same-tab reload. The grouped
indication question and fixed answer path then reached the correction step. At
that point the live response proposed the naproxen change from 500 mg to 250 mg
and displayed a 12-Aug/13-Aug conflict, but its source blockquotes were
`start as 12-Aug-2026` and `12-Aug-2026`. The required exact medication-
administration-record span supporting 13-Aug-2026 was absent for the full
310-second assertion window. That is an internally inconsistent grounded
proposal and fails Experiment 1's source-fidelity rule. The browser stopped at
that assertion; unresolved/resolved projection and PDF checks were not run and
must not be inferred from deterministic evidence.

The five-minute in-place Runtime Log audit saw 48 non-truncated rows, 53 unique
diagnostic events, eight operation IDs, the describe/understanding/clarify/update
stages, and the induced pre-model safe rejection. It found neither credential
material nor the rejected outside-fixture suffix. The stream closed before it
captured model response metrics or the late correction checkpoint, so token,
cost, per-call latency, and returned-content diagnostic reconstruction are not
claimed. No raw Runtime Logs, browser storage, network archive, provider
response, credential, or bypass secret was retained.

The temporary bypass was revoked immediately after the failed assertion. A
values-excluding project read found zero remaining automation bypasses, and an
unauthenticated request again returned HTTP 302. The retained `live/` directory
contains only the synthetic opening screenshot and a compact failure verdict;
the screenshot SHA-256 is
`922d1e9e7cea035deb71610938f9d24ef151dae259d0d202e5da2888d876dd43`.

## Bounded source-fidelity remediation

The failure exposed an ordinary but consequential boundary defect: valid
offsets and normalized types were checked, but the fixed adapter did not prove
that each returned value cited the catalog's expected supporting span. The
adapter now rejects any missing or unexpected fixed-catalog proposal, product
declaration mismatch, semantic target/value mismatch, or source span that does
not support the claimed value within the correct fixture clause before case
commands. Tighter prompt-compliant spans remain valid. The returned provider
response is still logged before the precise domain rejection, accepted case
state remains unchanged, and the client receives only the existing safe message
and opaque operation reference. The semantic boundary revision is
`wilson-grounded-proposals-v3`.

Regression coverage reproduces the observed 13-Aug value/12-Aug source
mismatch, a catalog omission, and tighter prompt-compliant opening spans. After
remediation, typecheck, all 78 unit/server tests, the production build, and both
deterministic Playwright journeys pass. This does not convert the failed live
evidence into a pass: Slice 4B remains failed unless Steve separately authorizes
a new protected live run after reviewing the failure, remediation, and final
Claude verdict.

## Final Claude implementation review

Steve separately authorized one complete post-implementation review because the
required planning review necessarily predated the application and operator
evidence. The review targeted exact commit
`3d9e501a732453cf5b44f5a6454d5f8472621179` and the complete `main...HEAD`
change. Claude Code 2.1.241 ran `claude-sonnet-5` at `high` effort in a fresh
read-only session after subscription preflight confirmed `claude.ai`, Steve's
active Max subscription, and unset Anthropic API/gateway variables. The first
sandboxed process reached no verdict because DNS could not reach Claude; the
same prompt then completed outside that network restriction as recovery, not a
second completed review.

Claude reported two blocking findings:

1. The retained evidence proves that the live-model gate failed and did not
   reach conflict resolution or live PDF agreement. This remains open. The PR
   must not merge as Issue #35 complete without a separately authorized,
   successful post-remediation live operator run.
2. The first `v3` guard required exact fixture source spans, even though the
   prompt asks the model for the smallest supporting span. That could reject a
   tighter, correctly grounded live response. Commit
   `1b14544824e16f5a4fcae6fecee7350761182108` resolves the finding by checking
   semantic support and location within the correct fixture clause while
   accepting tighter prompt-compliant spans. Focused coverage proves both the
   valid variants and the observed invalid 13-Aug value/12-Aug source case.

Claude also noted two non-blocking follow-ups: consider a future defense beyond
`VERCEL_ENV === "preview"` against deployment misclassification, and avoid
constructing a fresh Anthropic client per request if this narrow route is ever
generalized. Neither changes current Slice 4B behavior. The complete invocation
prompt, actual unedited result, limitations, and dispositions are recorded on
draft PR #36 under an explicit `Claude review` heading.

Under Delivery's proportional-closure rule, the originating review covers the
bounded second-finding remediation: it changes only the rejected span's
grounding predicate, introduces no new product/workflow premise, and passes the
full deterministic gate. No recursive Claude run was performed. The first
finding remains a stopping boundary rather than a code-review disposition.

## Post-remediation live attempt

Steve separately authorized exactly one new protected live run after the first
failure and its reviewed remediation. The run targeted protected Git deployment
`dpl_4cGNW9dbAoT9BuF8gQRiv4XTcN21` at exact commit
`777aa29ebf5cbe21be83b2835da2d850c6a3987d`. It induced the approved pre-model
safe failure and then submitted the fixed opening account once. The opening
failed, so the correction account was never submitted and no request was
retried.

The visible error safely retained the Describe state at revision zero and
returned opaque diagnostic reference
`a51b46b1-8648-4953-a49f-3b46f74381d2`. A values-excluding historical Runtime
Log query by that reference found a successful provider response followed by a
precise domain-boundary rejection, then the state, route, response, and browser
failure events in causal order. The call used `claude-sonnet-5`, prompt revision
`wilson-experiment-1-extraction-v2`, and schema revision
`wilson-grounded-proposals-v3`; it took 86,788 ms, used 3,160 input and 11,808
output tokens, and had estimated cost $0.1244.

The returned opening proposals used the unsupported role literal `suspected`
for both `apixaban-role` and `naproxen-role`; `lisinopril-role` correctly used
`concomitant`. The cited synthetic spans were in the correct suspect sentence.
The provider output schema allowed arbitrary string role values, and the prompt
described the role semantics without explicitly requiring the domain's literal
`suspect`. The ordinary domain boundary therefore rejected both values with
`role requires suspect or concomitant`, preserving accepted state. This is a
new prompt/schema-contract finding; it is not a transport failure and does not
invalidate the earlier source-support remediation.

The in-place live stream saw 23 non-truncated rows, 25 unique events, four
operation IDs, one clean reconnect, the induced safe failure, and no credential
or outside-fixture exposure. The reference-filtered retained-log query found
three matching request rows and 13 correlated events with no truncation or
exposure. No raw Runtime Logs or provider response were exported or retained.

The temporary automation bypass was revoked immediately after the run. A
values-excluding read confirmed zero remaining bypasses and unauthenticated
preview access returned HTTP 302. Per Steve's explicit correction, the restored
short-lived Vercel token and its owner-only mode-0600 handoff file remain
untouched to expire naturally; the Anthropic preview key is also unchanged.

This second attempt fails Slice 4B before extraction review, reload, correction,
conflict, projection, or PDF acceptance. The smallest retained example is
`live-post-remediation/operator-verdict.json`. A new live run still requires
separate explicit authorization and has not occurred.

## Targeted role-contract review and remediation

Steve authorized one targeted pre-implementation Claude review of the proposed
role prompt/schema remediation. The review targeted exact commit
`879382fa7535a59b76794cd179843507dc50f1c1`. Claude Code 2.1.241 ran
`claude-sonnet-5` at `high` effort in a fresh read-only session after preflight
confirmed `claude.ai`, Steve's active Max subscription, and unset Anthropic
API/gateway variables. The first sandboxed process reached no verdict because
DNS could not reach Claude; the identical invocation then completed with
network access as environment recovery, not a second completed review. It made
no application model call and no repository change.

Claude found two blockers in the proposed design, both resolved by
`b98653cf867910ca41ffe08752c005867b580cad`:

1. The installed Anthropic SDK's `zodOutputFormat` transformation demotes Zod
   `enum` and `const` constraints to description text. The provider-visible
   schema can therefore guide role output but cannot honestly be claimed to
   enforce the canonical literals. The remediation now supplies explicit
   conditional schema guidance and prompt instructions, then performs the hard
   cross-field validation locally at the structured-schema boundary.
2. Zod cannot directly discriminate on nested `target.field`. Instead of a
   broad variant hierarchy, one proposal-level `superRefine` rejects every
   role value outside `suspect | concomitant` while leaving non-role value
   types unchanged. The pre-existing domain validation remains an independent
   defense-in-depth rejection.

The prompt revision is `wilson-experiment-1-extraction-v3`; the schema revision
is `wilson-grounded-proposals-v4`. Regression coverage proves that both
canonical roles pass, that `suspected`, `primary`, and `causal` fail at the new
local gate and at the independent domain gate, and that the actual transformed
provider schema contains guidance rather than a falsely asserted structural
enum. The fixed-fixture semantic oracle is unchanged.

After remediation, typecheck, all 86 unit/server tests with the pypdf evidence
reader, the production build, and both deterministic Playwright journeys pass.
The complete invocation prompt, Claude's actual unedited result, limitations,
and dispositions are recorded under `Claude review` on draft PR #36. Under
Delivery's proportional-closure rule, this originating targeted review covers
the bounded implementation it prescribed; no recursive Claude review was run.
The review's broader non-blocking observation—that all SDK-demoted enum/const
constraints rely on local boundary validation—remains separate from this role
fix and is recorded as follow-up Issue #38.

## Post-role-remediation live attempt

Steve separately authorized exactly one further protected live operator run on
the reviewed role remediation. It targeted protected Git deployment
`dpl_3BBHeyHZH4styoUWrxtw9xkbKqJw` at exact commit
`0650dfe9fe7679af65e83f73a0ce1d809dfaa7da`. The operator harness first
confirmed the synthetic boundary and induced the required pre-provider safe
failure, which retained Describe and returned opaque reference
`e7758b9d-bc2d-4680-9b54-5177066d732c`. It then submitted the fixed opening
exactly once. The opening failed, so the correction account was never submitted
and no model request or journey was retried.

The visible error again retained Describe at revision zero and returned opaque
diagnostic reference `b391cbb3-6434-406a-bfeb-37342424c37e`. A sanitized,
in-place historical Runtime Log query reconstructed one successful provider
response followed by a domain-boundary rejection, then state, route, response,
and browser failure. The call used `claude-sonnet-5`, prompt revision
`wilson-experiment-1-extraction-v3`, and schema revision
`wilson-grounded-proposals-v4`; it took 111,583 ms, used 3,436 input and 14,700
output tokens, and had estimated cost $0.153872.

The role remediation worked: apixaban and naproxen both used the canonical
`suspect` literal, lisinopril used `concomitant`, and every proposal target and
value matched the fixed semantic oracle. The returned treatment proposal cited
the correct synthetic excerpt `two units of packed red cells,` at offsets
414–444. The grounding rule's container is
`she received two units of packed red cells` at offsets 401–443. Because the
algorithm treats the literal container end as a hard character boundary, it
rejected the semantically supporting excerpt solely for including the adjacent
comma. This is a general punctuation-boundary defect in the earlier grounding
remediation, not a role regression or faulty clinical extraction.

The smallest retained example is
`live-post-role-remediation/operator-verdict.json`. The historical query found
15 request rows, 30 unique correlated events across three operation IDs, no
truncation, the safe pre-provider rejection with no provider response, exactly
one opening provider response, and no credential or outside-fixture exposure.
No raw Runtime Logs, provider response, browser storage, network archive,
screenshots, PDF, credential, or bypass value were retained.

Before that provider-bearing run, the temporary operator harness had three
pre-model recoveries: Vercel rejected one bypass format without creating it; a
successfully created bypass was revoked after the Runtime Log connection waited
for a first event before the browser started; and an overbroad alert selector
matched Vercel toolbar semantics and closed the browser after only a browser
request-start event. Values-excluding checks found no application case POST or
provider response from those recoveries, and zero bypasses remained before the
authorized model submission.

The provider-bearing run's temporary bypass was revoked immediately after the
failed opening. Project metadata reports zero bypasses, and unauthenticated
requests to both the exact deployment and branch alias return HTTP 302. Per
Steve's instruction, the restored owner-only mode-0600 Vercel token handoff and
hosted Anthropic preview key remain untouched.

This third attempt fails Slice 4B before extraction review, reload, correction,
conflict, projection, or PDF acceptance. The initial proposed fix was to compare
a meaningful excerpt core after trimming adjacent whitespace or punctuation.
Subsequent review of the premise found that this would continue expanding a
fixed-answer runtime validator one observed variation at a time. The approved
planning change below supersedes that proposed punctuation workaround. Any
later live run still requires separate authorization.

## Approved runtime-boundary redesign plan

On 2026-09-07, Steve approved separating finite runtime contract validation
from Experiment 1's fixed semantic assessment before any further application
implementation. The runtime boundary will retain provider-completion,
structured-output, domain-representability, identity-integrity, and exact
source-bounds checks. It will not compare a live response with the fixture's
expected proposal catalog, expected values, or expected supporting clauses, and
it will not attempt to establish semantic support deterministically.

Model output remains proposed case knowledge. A structurally valid but
incorrect, omitted, unexpected, or unsupported proposal may reach the operator
review surface, but it cannot become resolved without the existing explicit
review command. Operators still assess every proposal and excerpt against the
fixed semantic oracle, and any mismatch fails the live run. Case-command,
browser-state, revision, conflict, projection, and PDF invariants are unchanged.

Implementation should remove the fixed semantic rejection from the live
Anthropic path, consolidate the generic provider-output boundary where doing so
reduces duplicated authority, and retain a small finite contract test set. It
must not add an eval system, persistence, another diagnostic store, real data,
automatic retry, or a new live-model call. This planning checkpoint requires
the separately authorized targeted Claude Sonnet/high read-only review before
application code changes; the review does not authorize another live operator
run.

## Targeted runtime-boundary review and dispositions

Steve authorized exactly one targeted pre-implementation review of planning
commit `06cdb4249c3c55a453a52fc6e6193212af0b9442`. Claude Code 2.1.241 ran
`claude-sonnet-5` at `high` effort in a fresh read-only repository/Git session
after preflight confirmed `claude.ai`, Steve's active Max subscription, and
unset Anthropic API/gateway variables. The sandboxed invocation reached no
verdict because DNS returned `ENOTFOUND`; the identical invocation completed
with network access as recovery of the same authorized review.

Claude reported no blocking findings and three follow-ups. It found that the
fixed-answer implementation was isolated to the Anthropic adapter and that the
existing generic model boundary, authoritative command validation, proposed-
knowledge state, and resolved-value-only projection preserve the approved
authority after its removal. It also identified the correction journey's
dependence on two authored group IDs, recommended explicit updates to the tests
that asserted the retired mechanism, and noted pre-existing triplication of
some per-field value checks.

The correction group IDs remain a finite machine-action contract for the two
known correction targets and intents; they are not a semantic-value or source-
support judgment. Focused coverage rejects an unrecognized action group at the
structured boundary. The retired wrong-clause and incomplete-catalog
rejections are rewritten to prove those responses remain available for
operator assessment, and the exact trailing-comma source span is accepted as
the recurrence case. Broader validation consolidation is not required for this
removal and remains outside the bounded change.

The unedited review's introduction incorrectly described all three prior live
failures as semantically correct. The first 13-Aug-value/12-Aug-source response
was a genuine evidence error, the second was a noncanonical machine literal,
and only the third was a correct proposal rejected for punctuation. This does
not change the review conclusion: the first response remains proposed for
operator inspection and fails the run without becoming accepted knowledge.
Claude's plan mode also wrote its report under `~/.claude/plans/` despite the
prompt's no-file-edit instruction; it changed no repository or Git state. The
[complete metadata and invocation prompt](https://github.com/warblersafety/wilson-next/pull/36#issuecomment-5573854335),
[actual unedited result](https://github.com/warblersafety/wilson-next/pull/36#issuecomment-5573872923),
and [pre-implementation dispositions](https://github.com/warblersafety/wilson-next/pull/36#issuecomment-5573882878)
are recorded under `Claude review` on draft PR #36.

## Narrowed runtime-boundary implementation

The live Anthropic path no longer contains `requireFixedSemantics`, the 31
fixture-specific source rules, exact proposal equality, catalog completeness,
or unexpected-proposal rejection. Prompt revision
`wilson-experiment-1-extraction-v3` remains unchanged; boundary revision
`wilson-grounded-proposals-v5` records the narrower contract. Provider stop,
JSON/schema, canonical role, domain type/entity, duplicate identity, and exact
nonempty source-bounds checks remain; the correction-action group wiring is now
an explicit finite contract. Issue #34's returned-content-first diagnostic
ordering and precise failure phases are unchanged.

Deterministic verification on 2026-09-07 passed:

- `npm run typecheck`
- `PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test` — 15 files, 88 tests
- `npm run build`
- `npm run test:e2e` — both the seven-stage journey and supported Change/Remove
  path

The first browser-test invocation could not bind `127.0.0.1:3100` inside the
filesystem sandbox; the identical command passed with local network binding.
No application model call, new retained browser/PDF artifact, deployment,
credential change, or live operator run occurred during this implementation
gate. A later live run remains separately permissioned.

## Runtime-boundary live attempt

Steve separately authorized exactly one protected live operator run after the
reviewed runtime-boundary implementation. It targeted protected Git deployment
`dpl_7GLUdpMhzZP9mgXgSAXgpfBHuQSp` at exact commit
`bdbb06c90302e7b43dc2e634018c01f143a6bd42`, with `target: null`, `READY`,
`STAGED`, and the expected feature branch metadata. The operator confirmed the
fictional-only boundary, induced the required pre-provider safe failure, and
submitted the fixed opening exactly once. The evidence assessment failed, so
the correction was not submitted and neither the model request nor the journey
was retried.

The narrower runtime boundary behaved as designed: it accepted one
mechanically valid opening response and made all proposals available for
operator assessment. All 29 expected values were present and correct, all three
product declarations used their stable IDs, and the roles were the canonical
`suspect`, `suspect`, and `concomitant`. The operator nevertheless stopped
because four evidence excerpts were not self-contained: the apixaban and
naproxen role proposals each cited only `suspect`, and their stopped proposals
each cited only `stopped`. Those predicate-only spans do not let a reviewer
verify which product the source attaches to without trusting the model's target
assignment.

This is not a reason to expand runtime validation. The common root cause is the
prompt's instruction to select the "smallest exact supporting substring"
without also requiring enough subject and claim context for a human reviewer.
The operator UI compounds that weakness by omitting product name, role, and
stopped facts from its per-card evidence aggregation even though role is
summarized visually. The general remediation candidate is to request the
smallest *self-contained* evidence span and expose those material product facts
and their evidence at Check understanding. Four fixture-specific rejection
rules would recreate the retired semantic validator and are explicitly not
recommended. Review and disposition are required before implementation.

A values-sanitized in-place Runtime Log query reconstructed run
`9593d944-9ec6-4bdd-ba86-d6b1407f7665`, safe-failure reference
`e9ebcd6c-66ac-4947-96d0-023f028d2cf6`, 34 unique correlated events across
three operations, zero truncated rows, no provider response for the safe
failure, and exactly one opening provider response. The call used
`claude-sonnet-5`, prompt revision `wilson-experiment-1-extraction-v3`, and
schema revision `wilson-grounded-proposals-v5`; it took 110,840 ms, used 3,436
input and 15,808 output tokens, and had estimated cost $0.164952. No credential
or outside-fixture exposure was observed. The initial live-stream parser did
not account for Vercel CLI's grouped log-message structure; the historical
query corrected that inspection-only parser issue without an application
request or model call. No raw Runtime Logs or provider response were exported
or retained.

The temporary automation bypass was revoked immediately after the stop.
Project metadata reports zero remaining bypasses, and unauthenticated requests
to both the exact deployment and branch alias return HTTP 302. The restored
owner-only mode-0600 Vercel token handoff and hosted Anthropic preview key
remain untouched. The retained `live-runtime-boundary/` directory contains
only the compact synthetic failure verdict; no browser storage, network
archive, screenshot, or PDF was retained. Slice 4B remains incomplete, and any
new Claude review or live run requires separate authorization.

## Targeted operator-evidence review and remediation

Steve authorized one targeted Claude Sonnet/high read-only review of the
proposed response to the runtime-boundary live failure before implementation.
The review targeted exact commit
`4a18f2f7afdf8fe8768ebb61d60dab22ebf5859d`. Subscription preflight confirmed
Claude Code 2.1.241, `claude.ai`, Steve's active Max subscription, and unset
Anthropic API/gateway variables. The sandboxed invocation reached no verdict
because DNS returned `ENOTFOUND`; the identical invocation completed with
network access as recovery of the same authorized review.

Claude reported no blocking finding against the proposed general remediation:
replace the ambiguous "smallest" evidence instruction with a self-contained
subject-and-claim standard, expose the already-present material product
evidence in the operator card, and cover that behavior deterministically without
expanding runtime validation. It required one precondition: amend this
experiment's owning oracle and verification language so the standard is
governed rather than living only in a prompt. It also noted that name evidence
was hidden, that the current card pools evidence rather than mapping each quote
to a field, and that deterministic tests cannot establish live-model
compliance. The
[complete metadata and invocation prompt](https://github.com/warblersafety/wilson-next/pull/36#issuecomment-5574489263),
[actual unedited result](https://github.com/warblersafety/wilson-next/pull/36#issuecomment-5574489258),
and [pre-implementation dispositions](https://github.com/warblersafety/wilson-next/pull/36#issuecomment-5574489293)
are recorded under `Claude review` on draft PR #36.

Experiment 1 now defines acceptable evidence as the shortest exact,
self-contained excerpt that lets the operator identify both subject and claim
without trusting proposal metadata. Prompt revision
`wilson-experiment-1-extraction-v4` expresses the same rule and explicitly
allows one shared clause to support multiple product proposals. The runtime
boundary remains `wilson-grounded-proposals-v5`; no semantic comparison or new
rejection rule was added.

At Check understanding, the existing product cards now include the boolean
stopped fact and aggregate the already-existing name and role sources into the
card's evidence disclosure. Name and role remain represented by the card title
and eyebrow rather than duplicate rows. Evidence remains pooled per card; this
bounded change does not claim per-field traceability. The deterministic fixture
also uses a product-bearing lisinopril role excerpt so it exercises the governed
standard.

Deterministic verification on 2026-09-07 passed:

- `npm run typecheck`
- `PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test` — 15 files, 88 tests
- `npm run build`
- `npm run test:e2e` — both the seven-stage journey and supported Change/Remove
  path

The first browser invocation used the previous production build and therefore
could not see the new stopped row; after the required `npm run build`, the
identical Playwright suite passed. No application model call, credential
change, retained browser/PDF artifact, or live operator run occurred. A live
model can still disregard the clearer instruction, so one new protected live
operator run remains necessary and separately permissioned.

## Self-contained-evidence live attempt

Steve authorized exactly one protected live operator run against Git deployment
`dpl_EbZeQ5qANo5nYAsRKL89uu1Z8dHX` at exact commit
`ffbba5dfc7a7a7ff20b354af8c6580078b02ab24`. Values-excluding preflight found
exactly one sensitive preview-only environment variable,
`ANTHROPIC_API_KEY`. The run confirmed the fictional-only boundary, induced the
required pre-provider safe failure, and submitted the fixed opening exactly
once. No correction or retry was submitted.

Two temporary-runner recoveries occurred before any provider call. The first
did not export the existing token-file variable to its child process. The
second supplied a bypass secret that did not satisfy Vercel's current exact
32-alphanumeric-character API contract. Both stopped before creating a bypass,
browser, or application request; the project remained at zero bypasses. A third
pre-provider runner attempt created and revoked its temporary bypass, induced
the safe failure, but its stale-alert synchronization closed before issuing the
live opening. An in-place phase audit proved that it had no provider response.

The actual authorized opening request then used run
`a5e4a456-6873-4c54-9a18-59841c79ced7`, safe-failure reference
`cd625b20-f070-4fc6-923f-fcda6cd37800`, and opening operation
`ec8970b2-c72d-4672-a318-303a8b2dba5e`. The temporary runner selected Next.js's
empty route-announcer `role=alert` while trying to wait for the earlier
application error to disappear. It timed out after 20 seconds and closed the
browser while the one opening request remained in flight. The server later
completed successfully and attached the proposals, but the response could no
longer be stored in the disposable tab. Continuing would have required a
prohibited second opening call, so the run stopped.

The completed response still yielded useful bounded evidence. It used
`claude-sonnet-5`, prompt revision `wilson-experiment-1-extraction-v4`, and
boundary revision `wilson-grounded-proposals-v5`; took 82,651 ms; used 3,513
input and 11,651 output tokens; and cost an estimated $0.123536. All 29 expected
values and product identities were correct. The new instruction also eliminated
the earlier predicate-only product citations.

However, 22 source spans were systematically shifted one character before the
correct zero-based, end-exclusive range. The symptoms span, for example, was
`292–312` and displayed ` melena and dizzines`; the correct span is `293–313`.
The same `-1/-1` pattern affected the sampled onset, hospitalization,
hemoglobin, and apixaban-role spans. Product excerpts consequently included
` I suspect apixaban and naproxe`, ` Apixaban and naproxen were stoppe`, and
` lisinopril 10 mg by mouth daily as a concomitant medicin`. That is a general
character-localization failure, not a reason to add 22 fixture-specific
runtime rules. It independently fails the evidence oracle even apart from the
operator-runner failure.

The in-place Runtime Log audit found eight request rows, 34 unique correlated
events across three operations, zero truncation, no provider response for the
safe failure, exactly one opening provider response, no correction response,
and no credential or outside-fixture exposure. No raw Runtime Logs, provider
response, browser storage, network archive, screenshot, PDF, credential, or
bypass secret was retained. The compact verdict is
`live-self-contained-evidence/operator-verdict.json`.

The temporary bypass was revoked. Project metadata reports zero bypasses;
unauthenticated requests to both the exact deployment and branch alias return
HTTP 302; and the owner-only mode-0600 Vercel token file and hosted Anthropic
key remain untouched.

The consequential next decision is whether to redesign the model boundary so
the model returns an exact self-contained quote and Wilson deterministically
locates that quote in the source, rejecting absent or ambiguous matches. That
addresses character localization as a finite machine responsibility without
silently shifting offsets or rebuilding a semantic answer-key validator. It
requires review and approval before implementation. No additional Claude
review or live run is authorized by this result.
