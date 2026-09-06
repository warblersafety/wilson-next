# Issue 35 operator-preview evidence

**Status:** Required pre-implementation review, approved planning remediation,
implementation, and deterministic verification complete; protected live-preview
verification pending

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
