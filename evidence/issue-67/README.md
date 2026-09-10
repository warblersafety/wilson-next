# Issue #67 — live-model target/value remediation

Issue #67 revisits the deferred live-model risk in Issue #55 after the same
target/value typing class recurred in the independent Layer 3 device journey.
The implementation baseline is merged `main` at `f5c09ee` after PR #70. No
live application-model call, preview exercise, deployment, release, real data,
or physician participation is part of the implementation record below.

## Premise and root cause

The issue remains valid. Anthropic SDK 0.124.0's installed
`zodOutputFormat` transformation preserves basic JSON shapes but demotes Zod
`const` and `enum` constraints into descriptions along with unsupported bounds.
The prior proposal schema also represented every known value as one generic
union independent of its target. The provider could therefore return both
recorded invalid combinations: scalar `event.symptoms` and free-text
`event.productAvailability`. Local/domain validation rejected both atomically,
so accepted case state remained safe, but the user action failed before review.

The provider supports `const`, primitive `enum`, `format`, and `anyOf`; numeric
bounds and string-length constraints are not supported. The implementation
therefore sends one raw target-dependent schema containing supported structural
constraints and retains local validation for the complete contract. See
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
- Prompt revision: `wilson-target-contract-v1`.
- Schema revision: `wilson-grounded-proposals-v11`.
- Focused target/value, model-adapter, configured-model, browser-state, and
  command checks: 5 files / 86 tests passed.
- `npm run typecheck`: passed.
- Full deterministic suite with the repository's pypdf interpreter: 17 files /
  139 tests passed.
- `npm run build`: passed.
- Local assembled Chromium/PDF journey with predetermined responses: 1 passed;
  no live application-model call or remote preview request.
- `git diff --check`: passed.

## Pending protected live evidence

After the exact implementation commit passes the required independent review
and is available through the automatically built protected pull-request
preview, Issue #67 calls for exactly two no-retry opening actions:

1. The existing fictional rich medication account for `TEST-68` in
   `docs/EXPERIMENT-2.md`, submitted as `adverse-event`.
2. The existing fictional Acme PulseLine conditional-device account in
   `tests/e2e/build-predetermined-responses.ts`, submitted as
   `product-problem`.

Before either call, separately verify Vercel Deployment Protection covers the
exact deployment and no public exception or bypass exists. Inspect the
synthetic-only Runtime Logs in place, retain only request/model identifiers,
prompt/schema revisions, tokens, latency, estimated cost, proposal/evidence
summaries, and sanitized mechanical/semantic verdicts, and do not retain raw
provider responses or logs. The two calls must use the ordinary application
route, automatic retries remain disabled, and no correction, retry,
confirmation sample, PDF generation, or additional model turn is authorized by
this evidence plan.
