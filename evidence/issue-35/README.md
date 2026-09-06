# Issue 35 pre-implementation evidence

**Status:** Required pre-implementation review and Steve-approved planning
remediation complete; application implementation may begin

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
dispositions on 2026-09-06 before application implementation began. These are
governing-plan changes only; their implementation and verification follow in a
later branch checkpoint.
