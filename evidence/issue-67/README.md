# Issue #67 — live-model target/value remediation

Issue #67 revisits the deferred live-model risk in Issue #55 after the same
target/value typing class recurred in the independent Layer 3 device journey.
The implementation baseline is merged `main` at `f5c09ee` after PR #70. The
record now includes one protected synthetic application-model attempt against
the reviewed pull-request implementation. It includes no real data, release,
production deployment, or physician participation.

## Premise and root cause

The issue remains valid. Anthropic SDK 0.124.0's installed
`zodOutputFormat` transformation preserves basic JSON shapes but demotes Zod
`const` and `enum` constraints into descriptions along with unsupported bounds.
The prior proposal schema also represented every known value as one generic
union independent of its target. The provider could therefore return both
recorded invalid combinations: scalar `event.symptoms` and free-text
`event.productAvailability`. Local/domain validation rejected both atomically,
so accepted case state remained safe, but the user action failed before review.

The provider supports primitive `enum`, `format`, typed buckets, and local
`$defs`/`$ref`; numeric bounds and string-length constraints are not supported.
The final implementation therefore sends a target-dependent typed-bucket schema
containing supported structural constraints and retains local validation for
the complete contract. See
[Anthropic's structured-output limits](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations).

## Target/value enforcement matrix

One domain-owned contract now defines the accepted known-value shape for every
patient, event, product, relevant-test, and reporter fact. Reporter facts and
`event.reportType` remain direct clinician/application inputs and are excluded
from the model target list.

| Targets | Provider structure | Local structured decode | Domain command boundary |
|---|---|---|---|
| Patient identifier; event descriptive/history/outcome; product descriptive fields; relevant-test text | `string` coupled to the applicable entity/field enums | Exact target plus string | Same domain contract, rechecked before write |
| Event/product/relevant-test dates | `string` with `format: date` coupled to date targets | ISO `YYYY-MM-DD` | Same ISO check before write |
| Patient age | `integer`; 0–150 is provider guidance because numeric bounds are unsupported | Integer 0–150 | Same 0–150 rule before write; browser restoration now matches it |
| Patient weight | Object with numeric `value` and `unit` enum `kg`/`lb`; positivity is provider guidance | Positive finite number and supported unit | Same positive measurement rule before write |
| Event symptoms and treatments | Array of strings coupled only to these targets | String array | Same string-array rule before write |
| Event/product boolean fields | Boolean coupled only to applicable fields | Boolean | Same boolean rule before write |
| Patient sex, product availability/type/role/device operator/service status | Target-specific primitive enums | Exact enum | Same enum rule before write |
| Reporter destinations | Not model-visible | Direct action validates an array of supported destinations | Same enum-array rule before write |
| `event.reportType` | Not model-visible | Direct opening action validates the supported enum | Same enum rule before write and projection |
| `unknown`, `explicitly-absent`, `inapplicable`, `declined` | Value object contains only a supported `kind` enum | Strict mutually exclusive object | Same exclusivity rule before write |
| Optional known qualifier | String; non-empty constraint is provider guidance | Non-empty string | Same non-empty string rule before write |
| Entity/field/reference compatibility | Target variants constrain entity, field, and required reference shape | Zod target union plus non-empty references | Resolved stable entity must exist and have a compatible field |
| Evidence quotation | String with exact-evidence guidance | Non-empty string | Exact single-occurrence anchoring and source identity before write |

Focused tests enumerate every model-visible field in the provider variants and
exercise scalar/list, availability enum, ISO date, boolean, age, weight, sex,
role, relevant-test, direct reporter, and command-boundary rejection paths.
The final command check remains authoritative even though the provider grammar
and local decoder now reject mismatches earlier.

## Treatment-versus-report-product clarification

One general instruction now says that a medicine or other product administered
only in response to the adverse event belongs in `event.treatments`, not in the
report-product list merely because it is named. It may also be proposed as a
product only when the clinician separately describes it as suspect,
concomitant, or otherwise involved in the report. This does not encode a
medicine, fixture, product name, expected answer, or causality decision.

## Evidence-capability disposition

Keep `responseArtifact`, the optional `AnthropicResponseRecorder`,
`diagnosticResponse`, request IDs, metrics, and synthetic Runtime Log tracing
through the integrated rehearsal. The normal application path still installs
no recorder and creates no durable response store, but removing the optional
seam now would reduce the ability to collect warranted synthetic model evidence
without improving current behavior. Reconsider it with the deferred adapter
cleanup after the integrated rehearsal, not inside Issue #67.

## Implementation evidence

- Model: `claude-sonnet-5` (no application call made during implementation).
- Initial prompt revision: `wilson-target-contract-v1`.
- Initial schema revision: `wilson-grounded-proposals-v11`.
- Remediated prompt revision: `wilson-target-contract-v2`.
- Remediated schema revision: `wilson-grounded-proposals-v12`.
- Focused target/value and model-adapter checks after remediation: 2 files / 48
  tests passed.
- `npm run typecheck`: passed.
- Full deterministic suite with the repository's pypdf interpreter after
  remediation: 17 files / 140 tests passed.
- `npm run build`: passed.
- Local assembled Chromium/PDF journey with predetermined responses after
  remediation: 1 passed.
- `git diff --check`: passed.

## Protected live evidence and schema-premise reconciliation

The reviewed v11 implementation at `d2bcaa3`, merged with current `main` and
published at checkpoint `94136b6`, passed GitHub `verify`, Vercel build, local
deterministic checks, and the recorded Claude review. The exact protected
preview was deployment `dpl_EXbZxHhY1rDbB2Ru6nw6gnFgkcsi`. Deployment
Protection was verified before the call; temporary synthetic-run access was
revoked afterward and unauthenticated access again returned a redirect.

The first approved opening used only the existing fictional rich medication
account for `TEST-68`. It reached the ordinary application route and made
exactly one provider request with retries disabled. Anthropic rejected the
request before generation with HTTP 400 and provider type
`invalid_request_error`. The safe application diagnostic reference was
`71f9e30b-7090-4ee7-b369-7e751f54e77f`; the correlated synthetic run ID was
`8a3fb899-9733-4b03-92fb-85bb3775a9e5`; and the provider request ID was
`req_011Cew4Dib652UvrYZkybZ2M`. There was no provider response, accepted
command, token count, model latency, or model cost. Raw logs and responses were
not retained. The conditional-device opening was not attempted.

The failure falsified the premise that a provider-supported keyword set was by
itself sufficient. The v11 schema contained no documented unsupported keyword
and remained below the provider's published optional-parameter and union-count
ceilings, but serialized to 22,599 bytes and compiled one proposal item through
5 nested `anyOf` nodes with 26 total branches. The provider diagnostic surface
intentionally omitted the raw error message, so attributing the 400 to the
documented internal compiled-grammar complexity ceiling is an evidence-backed
inference rather than a retained provider quotation.

The v12 remediation changes only the provider wire representation. It groups
known proposals by entity and value contract, shares response metadata through
local `$defs`/`$ref`, and flattens the response back into the unchanged Wilson
proposal envelope before the existing local and domain checks. Every
model-visible field remains enumerated; product and relevant-test references
remain required in their entity buckets; reporter fields and `event.reportType`
remain excluded; and unknown, absent, inapplicable, and declined meanings retain
entity-specific target constraints. The schema is under 16,000 serialized bytes
with 18 optional qualifiers, zero `anyOf` nodes, and zero union branches.

The typed buckets do not change accepted case state, review behavior,
diagnostics, response-artifact capability, or PDF projection. The provider wire
order is normalized by entity and value contract before proposals enter the
domain; Wilson's fact and group presentation is determined by the case model,
not provider array order.

## Expanded premise review and approved disposition

Steve stopped implementation after the failed provider request and requested a
second opinion from a different model with fresh context. One read-only expanded
review ran on 2026-09-10 using Claude Opus at `xhigh` effort through Claude Code
2.1.241. Subscription preflight confirmed first-party `claude.ai` authentication
with the API-key, auth-token, and alternate-base-url variables unset. The CLI
alias was `opus`; the canonical model ID was not emitted. The reviewer inspected
clean `main` at `14aa6a4` before inspecting v11 at `94136b6` and v12 at
`fe8baaf`. It ran no tests, provider calls, application-model calls, network
requests, subreviews, repository edits, or Git changes.

The exact review inputs and complete result are retained as:

- `opus-expanded-review-prompt.md`
- `opus-expanded-review.md`

The review concluded that provider-perfect typing is neither necessary nor
sufficient for Wilson's safety. The safety invariants are atomic commands,
explicit clinician acceptance, exact local evidence checks, conflict-aware
projection, and strictly validated PDF output. Whole-response rejection because
one proposal is unrepresentable is an implementation choice that destroys useful
work; it is not an accepted-state safety requirement.

Steve approved that conclusion and the following premise reset:

1. Target/value compatibility remains structural in local decoding and at the
   authoritative command boundary; the provider receives truthful generated
   guidance on the already accepted simple wire shape.
2. Individual unrepresentable proposals are visibly quarantined with their
   quotation, target, and reason. They never enter case state. Response-level
   faults and an all-quarantined response still fail atomically.
3. Command atomicity and accepted-state safety remain invariants; rejecting a
   complete response for one proposal-local fault does not.
4. No coercion, fuzzy repair, guessed normalization, automatic retry, new
   question planner, PDF change, or Issue #66 work is authorized.
5. Keep the shared domain value contract, enumerated recurrence tests, age-bound
   alignment, and general treatment-versus-report-product instruction. Discard
   the bespoke provider schema compiler and v12 wire adapters.
6. Close PR #71 without merging and continue Issue #67 from clean `main` on a
   replacement branch. The existing v11/v12 commits remain the durable record of
   the falsified direction.

No replacement implementation or additional live call was performed in this
session. The next session should first update Issue #67 and the owning
architecture sentence to encode this approved premise, then implement the
narrow visible-quarantine flow and separately reconcile the newly identified
product-cap restoration defect before any protected synthetic evidence call.
