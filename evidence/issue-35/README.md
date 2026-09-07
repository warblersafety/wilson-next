# Issue 35 operator-preview evidence

**Status:** Required pre-implementation review, approved planning remediation,
implementation, and deterministic verification complete; the first protected
live operator gate failed on source fidelity, bounded remediation is complete,
and final independent review is pending

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
declaration mismatch, semantic target/value mismatch, or exact source-span
mismatch before case commands. The returned provider response is still logged
before the precise domain rejection, accepted case state remains unchanged,
and the client receives only the existing safe message and opaque operation
reference. The semantic boundary revision is
`wilson-grounded-proposals-v3`.

Regression coverage reproduces the observed 13-Aug value/12-Aug source mismatch
and a catalog omission. After remediation, typecheck, all 77 unit/server tests,
the production build, and both deterministic Playwright journeys pass. This
does not convert the failed live evidence into a pass: Slice 4B remains failed
unless Steve separately authorizes a new protected live run after reviewing
the failure, remediation, and final Claude verdict.
