# Issue #67 — visible proposal quarantine

## Authority and baseline

This replacement implementation starts from merged `main` at `14aa6a4`. It
does not continue stopped PR #71 or its provider-schema compiler. The complete
stopped-direction evidence, approved premise reset, and expanded Opus review
remain authoritative at `d694ebb` on the retained
`codex/67-live-model-contract` branch and in Issue #67's GitHub record.

The revised premise is that provider typing improves proposal yield but does not
own safety. A proposal-local representation or exact-evidence fault may be
withheld visibly while the usable proposals proceed. The authoritative command
still applies the remaining proposal batch atomically, and no proposal becomes
accepted without clinician review.

## Smallest coherent resolution

- One domain-owned value contract now supplies local target/value checks, the
  final command check, and generated text guidance on the provider's previously
  accepted simple wire shape.
- Once a response supplies the minimum reference, group, target, and exact
  citation needed for a truthful visible notice, proposal-local format, target,
  resolved-identity, value, and exact-evidence faults are quarantined before
  source or proposal identity is created. The case receives no coerced or
  repaired substitute. A proposal missing that minimum makes the response
  envelope invalid; Wilson does not invent the missing notice content.
- Duplicate identities, cross-entity proposal groups, invalid response
  envelopes, and an all-quarantined response still reject the response.
- A declared product with no retained proposals is pruned. Products beyond the
  supported three-product limit are visibly quarantined before case identity is
  allocated. A relevant test is pruned with its remaining details when its
  required test-and-result proposal cannot be represented.
- The physician-facing notice names the affected case field, preserves the
  exact text the model cited, explains the controlled reason, and remains
  visible in versioned disposable browser interaction state through review and
  output. It is not semantic case knowledge and never projects to Form 3500.
- The existing product cap is now enforced at the command boundary before a
  fourth product can create state that the browser refuses to restore. The age
  restore bound is aligned with the domain at 150.
- The general prompt distinguishes event treatments from separately reportable
  products. There is no retry, question planner, fixture-aware repair, PDF
  change, real-data path, or Issue #66 work.

The optional response-artifact plumbing remains through the integrated
rehearsal because it is current diagnostic capability and removing it does not
help this resolution. Its eventual cleanup remains outside Issue #67.

## Deterministic evidence

Baseline on clean `main` before changes:

- `npm run typecheck` — passed.
- `PYPDF_PYTHON=.venv-pdf-evidence/bin/python npx vitest run` — 17 files / 113
  tests passed.

Replacement implementation and reviewer-requested remediation:

- `npm run typecheck` — passed.
- `PYPDF_PYTHON=.venv-pdf-evidence/bin/python npx vitest run` — 17 files / 131
  tests passed.
- `npm run build` — passed.
- `PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm run test:e2e` — the assembled
  deterministic Chromium/PDF journey passed, including a new response with
  scalar `event.symptoms` and free-text `event.productAvailability` alongside
  valid proposals. Both bad suggestions remained visible and outside accepted
  case/PDF state; the reviewed remainder reached output and downloaded Form FDA
  3500; all prior product, correction, conflict, and PDF regressions also
  passed.
- `git diff --check` — passed.

Focused recurrence coverage includes the two recorded value failures, unknown
fields and unresolved entities, absent and ambiguous evidence, minimum notice
envelope rejection, product-limit and relevant-test dependency pruning,
duplicate/group response rejection, all-quarantined rejection, every
model-visible target's presence in the domain contract, the same target/value
checks at `applyCaseCommand`, the three-product command backstop, 150-year
restore alignment, browser-held notice reconstruction, diagnostics, and the
final PDF omission behavior.

## Independent review

The fresh-context standard Sonnet review at `de3ccc0` found two blocking gaps:
the fourth-product guard still rejected the entire model batch, and the evidence
record did not state the minimum target/citation content required to render a
truthful quarantine notice. The first is now remediated by proposal quarantine
before identity allocation; the command guard remains a backstop. The second is
now explicit as a response-envelope rule, because Wilson must not invent a
missing target or citation. The same-session targeted recheck at `d0fe1e3`
independently reran every stated deterministic gate, resolved both blockers,
and reported no new blocking or independently valuable follow-up finding. The
PR holds the complete review record.

## Protected synthetic live evidence

Steve explicitly approved the exact two-call, no-retry plan and then explicitly
approved one temporary two-call-scoped Vercel automation bypass. The batch ran
against protected non-production deployment
`dpl_5bvhKmtos1h1vRJSxMTr28VsGRVq`, exact Git SHA `4527280`, branch
`codex/67-visible-quarantine`, PR #74. Before each call the operator confirmed
the deployment was ready, its immutable Git metadata matched, Vercel
Authentication and fork protection were enabled, system Git metadata was
exposed to the fail-closed application gate, and exactly one sensitive
preview-only `ANTHROPIC_API_KEY` existed.

One earlier GET-only Vercel CLI access probe unexpectedly created an automation
bypass as an undocumented side effect. It made no application-model call. The
operator immediately revoked that bypass and verified zero remaining bypasses
and an unauthenticated 302 before requesting and receiving approval for the
explicit batch-scoped bypass. The approved bypass was the only active bypass
during the batch and was unconditionally revoked afterward; final bypass count
was zero and unauthenticated access again returned 302.

Exactly two opening actions ran through the actual browser and application
route, with automatic retries disabled:

1. **Rich medication (`TEST-68`, adverse event): Pass.** The response reached
   ordinary understanding at revision 2 with 18 proposals and one cephalexin
   product. Symptoms were `diffuse hives` and `facial swelling`; epinephrine and
   diphenhydramine were event treatments, not report products. All 18 retained
   proposals had one exact evidence anchor. Nothing was quarantined.
2. **Conditional device (Acme PulseLine, product problem): Pass after external
   oracle disposition.** The response reached ordinary understanding at
   revision 2 with 15 proposals and one device. It preserved explicitly absent
   patient symptoms, supported `available` product availability, implanted and
   reprocessed-single-use status, and unknown implant date, explant date, and
   reprocessor. All retained proposals had exact evidence and nothing was
   quarantined. The runner initially stopped because it required the event
   description to duplicate `Acme PulseLine temporary pacing lead`; the actual
   value, `stopped sensing during an intraoperative function check after
   placement`, is truthful, material, and supported by the exact complete
   sentence, while product name and common name were separately preserved.
   This was an over-specific external oracle, not a Wilson semantic failure; no
   retry or application change was made.

Ephemeral Runtime Logs yielded 38 correlated diagnostic events: two model
requests, two successful provider responses, two successful proposal commands,
and no failure or rejection event. No credential-shaped content was detected.

| Opening | Provider request | Model | Input tokens | Output tokens | Latency | Estimated cost |
|---|---|---|---:|---:|---:|---:|
| Rich medication | `msg_011Cex3WKGFfWV1krS8urWGM` | `claude-sonnet-5` | 4,677 | 3,228 | 26,988 ms | $0.041634 |
| Conditional device | `msg_011Cex3YRhkaDCtZAhYUrwea` | `claude-sonnet-5` | 4,684 | 2,969 | 23,941 ms | $0.039058 |

Both used prompt revision `wilson-visible-quarantine-v1` and schema revision
`wilson-grounded-proposals-v11-simple`. Total estimated spend was $0.080692,
within the approved USD 5 batch limit. No raw provider response, raw Runtime
Log, browser state, network archive, screenshot, PDF bytes, credential, or
bypass was retained.

## Disposition

`Proceed`. The revised premise is not contradicted. Both independently selected
openings reached truthful ordinary review through the simple provider wire,
with accepted-state authority unchanged, exact evidence intact, correct
treatment/product attribution, no retry, and no material invention, silent
loss, or wrong attribution. The deterministic malformed-proposal journey
remains the meaningful visible-quarantine evidence; a live quarantine was not
required and neither live response happened to need one.
