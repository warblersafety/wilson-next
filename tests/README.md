# Tests and eval evidence

Start here to discover existing checks and what they establish. This is a catalog,
not a new runner, grader, test suite or execution policy. [Development](../docs/DEVELOPMENT.md)
owns installed-tool setup and PDF inspection procedures; [Delivery](../docs/DELIVERY.md)
owns verification/review/merge gates; [Coverage](../docs/COVERAGE.md) owns current
product limitations. Only fictional clinical and reporter data is permitted.

A software test can prove Wilson handles a given model response correctly. A live
model evaluation asks whether interpretation produced a faithful response in the
first place. Authored responses, captured-response replay and new live trials are
not interchangeable evidence.

## Suite catalog and count basis

Collected **18 October 2026** at application/test baseline
`2a72a4a1cb4e1ede5af6bed39f66b648adf4793e`, with installed Node 24.20.0,
Vitest 4.1.11 and Playwright 1.63.0. These are expanded individual test entries,
including parameterized cases, not counts of declarations, assertions or clinical
scenarios. Refresh this snapshot after changing membership; do not turn these
counts into acceptance thresholds.

| Existing location | Tests | Files | What it exercises |
|---|---:|---:|---|
| [domain/](domain/) | 107 | 13 | Facts, commands, completion, identity and projection contracts |
| [architecture/](architecture/) | 5 | 1 | Source/import boundaries and prohibited fixture coupling |
| [browser/](browser/) | 86 | 7 | Browser-side logic, storage envelopes, drafts, queues and profiles under Vitest; not a real-browser run |
| [server/](server/) | 411 | 45 | Service/route integration, state migration, model contracts and response replay; mixed test depth |
| [pdf/](pdf/) | 546 | 45 | PDF mapping, appearances/continuations, readiness and independent readback; some invoke Python and generate actual PDFs |
| **Vitest total** | **1,155** | **111** | `npm test` includes all five rows above, not just small unit tests |
| [e2e/](e2e/) | 180 | 61 | Multi-step Chromium journeys with mocked interpretation, UI review/correction, persistence and downloaded PDFs |

The two runners collect **1,335 test entries** together, not 1,335 independent
clinician cases. A single browser test can contain several journeys/assertions.
The first three Vitest directories total 198 entries already inside 1,155. Focused
selections overlap the full suite: never add subset counts to totals or to one
another as evidence of extra coverage. Earlier reports calling all 1,155 tests
"unit tests" used shorthand for this mixed Vitest collection.

## Existing commands and selection depths

Use the pinned runtime, installed dependencies/Chromium and independent Python
reader described in [Development](../docs/DEVELOPMENT.md#runtime-and-local-application).
The commands below select existing tests; there are no new named tiers or schedules.

| Purpose | Existing command |
|---|---|
| Focused logic selection | `npm test -- tests/domain tests/architecture tests/browser` |
| Focused captured-response/service examples | `npm test -- tests/server/opening-fidelity.test.ts tests/server/test-time-context.test.ts` |
| Existing PDF integration selection | `npm test -- tests/pdf` |
| Full Vitest collection | `npm test` |
| Full mock browser collection, after a fresh build | `npm run build` then `npm run test:e2e` |
| Discover expanded Vitest entries without test bodies | `node node_modules/vitest/vitest.mjs list --json --no-cache --configLoader runner` |
| Discover Playwright entries without executing them | `npm run test:e2e -- --list` |

Collection imports test/config modules and evaluates their registration code; it
is not a claim that every module has zero initialization effects. It does not run
test bodies. The browser config creates/removes a temporary mock-response file.
Playwright's list-only JSON reporter records no execution results and can label
listed entries "skipped"; that does not mean the actual suite newly skips them.
A collection report is not a passing test report.

### Browser response queue and file selection

[playwright.config.ts](../playwright.config.ts) runs Chromium headlessly with one
worker, no file parallelism and a dedicated fresh server at 127.0.0.1:3100. Its
[preload](e2e/load-fixtures.cjs) loads authored responses before any live provider
is constructed. [build-predetermined-responses.ts](e2e/build-predetermined-responses.ts)
assembles 51 named scenarios / 86 queued responses / 81 identity scopes, checked by
[predetermined-scenarios.test.ts](server/predetermined-scenarios.test.ts).
Those are fixture units, not extra tests or live calls.

`WILSON_E2E_SCENARIOS` selects comma-separated keys from that response catalog;
Playwright file filters select tests. Neither selection performs the other.
A focused file/grep can consume the wrong response if it retains the unrelated
full queue. Keep scenario order, file order and actual model-request consumption
aligned. The long `z...` file prefixes reflect existing ordering, not a risk or
quality ranking. Do not mass rename, parallelize or casually reorder them.

One existing paired selection is:

```sh
WILSON_E2E_SCENARIOS=readOnlyGaps npm run test:e2e -- tests/e2e/aaaa-read-only-gaps.spec.ts
```

It selects three existing tests and three ordered responses from
[read-only-gaps.ts](fixtures/read-only-gaps.ts): the first test consumes the opening
and update; the second seeds saved state but still consumes the third response
for its unknown/declined update. Only the third test bypasses the queue by
intercepting and aborting model requests. Seeded state alone does not imply zero
queued responses.
[clinical-update-answers.ts](e2e/clinical-update-answers.ts) authors expected answer
proposals through the real boundary/service and UI acceptance; it does not test
live interpretation. [draft4-helpers.ts](e2e/draft4-helpers.ts) includes explicit
state seeding and response-application witnesses. Do not describe seeded recovery
checks as naturally persisted journeys from the first keystroke.

### Required CI stays unchanged

The single [verify workflow](../.github/workflows/verify.yml) runs on every PR and
main push: pinned Node/Python and dependencies → typecheck → full Vitest → build →
full mock browser suite. There is no path filter, tier job or live-model job.
Focused local selections supplement this gate; they do not replace required
exact-head or merged-main verification. CI/builds/mocks use no paid application
model. Compute time and human inspection still have costs.

## Coverage and discovery map

These are representative entry points into existing families, not an exhaustive
risk matrix or a claim of complete form coverage. Follow sibling files in the
catalog directories for individual fields; [product gaps](../docs/COVERAGE.md)
remain separate from test discovery.

| Concern | Existing automated entry points | Provenance / interpretation limit |
|---|---|---|
| Write authority and structural boundaries | [case commands](domain/case-commands.test.ts), [source boundaries](architecture/source-boundary.test.ts) | Deterministic invariants, not proof of model understanding |
| Source references and partial recovery | [source recovery](server/source-reference-recovery.test.ts), [browser path](e2e/source-reference-recovery.spec.ts) | Citation existence and boundary handling do not prove semantic support |
| Captured model omissions and clinical wording | [opening fidelity](server/opening-fidelity.test.ts), [collection-time context](server/test-time-context.test.ts), [time fixture](fixtures/test-time-context.ts) | Replays actual captured issue94/192 responses and separately authored expected outputs; do not relabel the authored repair as a live success |
| Stable correction/identity | [correction contract](domain/test-correction-contract.test.ts), [serial correction](server/serial-test-correction.test.ts) | Allocation containment and supplied-ID behavior; general semantic targeting #150 remains paused |
| Context, uncertainty and lists | [list context](server/list-context.test.ts), [reviewed PDF context](pdf/reviewed-context.test.ts), [B6/B7](pdf/test-history-context.test.ts) | Authored states/responses; qualifier/source preservation differs from extraction completeness |
| Patient status and dates | [involvement](server/patient-involvement.test.ts), [calendar validity](server/calendar-validity.test.ts), [DOB PDF](pdf/patient-birth-date.test.ts) | Bounded accepted-value/representation contracts; no clinical inference or age-specific validation |
| Products, regimen and native copies | [F context](pdf/f-medication-context.test.ts), [native F](pdf/native-f-rows.test.ts), [native E](pdf/native-e-copies.test.ts) | Mixed authored fixtures and captured accepted-state reuse; an accepted-state export fix is not a first-response extraction fix |
| Save/resume and Reporter reuse | [clinical resume](server/clinical-resume.test.ts), [workspace codec](browser/workspace-state.test.ts), [profile browser](e2e/zzzzzzzzzzzzzzzz-reporter-profile.spec.ts) | Node logic and actual browser checks are separate; seeded versus naturally saved paths differ |
| UI input and failure behavior | [read-only gaps](e2e/aaaa-read-only-gaps.spec.ts), [diagnostic logic](browser/nonblocking-diagnostics.test.ts), [runtime diagnostics](server/runtime-diagnostics.test.ts) | Mocked application behavior, not live extraction or guaranteed durable diagnostic delivery |
| Actual PDF artifact fidelity | [PDF tests](pdf/), [reader/render procedures](../docs/DEVELOPMENT.md#independent-pdf-and-browser-evidence), [PDF helpers](../tools/pdf/) | Native/page readback is independent of semantic adapter echoes; rendering is not human visual inspection |

### Fixture provenance and historical evidence

[fixtures/](fixtures/) contains 43 source/data files (38 TS, 5 JSON), not 43 model
evals. It mixes authored proposals, valid/invalid or legacy state fixtures, actual
captured responses and frozen live protocols. Inspect the fixture's imports and
comments before citing it. For example, test-time-context imports the actual
omitted and verified provider outputs from [issue192](../evidence/issue-192/README.md),
while its expected repair builders are authored. [F context fixtures](fixtures/f-medication-context.ts)
and tests reuse accepted states from the historical corpus for export regressions.
There is no uniform per-test provenance registry or maintained held-out split.

[Evidence navigation](../evidence/README.md) locates historical protocols, scorecards,
review findings, source/state/response captures, hashes, PDFs and selected renders.
They are results/provenance, not automatically rerunnable suites. Keep them immutable.
The package's `evidence:pdf`, `evidence:chromium` and `evidence:slice2:pdf-render`
commands write historical tracked artifact paths; do not use them as scratch
inspection commands. Some replay/PDF tests also have opt-in `WILSON_*_EVIDENCE`
output switches; leave them unset for ordinary verification rather than inheriting
a historical artifact destination. Use Development's independent-reader procedure for a scratch
PDF and inspect each rendering helper's fixed inputs/outputs first.

## Frozen live protocols: scenarios are not trials

| Existing artifact | Scope | Historical execution / overlap |
|---|---|---|
| [live-acceptance-12.json](fixtures/live-acceptance-12.json) | 12 opening scenarios; corrections on A03/A04/A11 | 15 calls, zero automatic retries; [scorecards/artifacts and limits](../evidence/live-acceptance-241/README.md) |
| [outcome-d7-check-243.json](fixtures/outcome-d7-check-243.json) | 3 focused opening scenarios: A03/A04/A11 | Exact same three opening texts from the 12-case protocol, not three new cases; [captured results](../evidence/issue-243/README.md#hosted-and-focused-live-checkpoint) |

The twelve families are A01–A03 medication; A04/A11 multiple medications; A05/A09
device; A06 medication-quality; A07 mixed device/medication; A08 device-quality;
A10 cosmetic-quality; A12 sparse medication. These two protocols represent 12
unique opening scenarios, three correction operations and 18 historical calls
across their two executions. Older issue/experiment protocols exist too; this is
not a deduplicated count of all historical Wilson cases or trials.

The corpus froze expected material facts before execution, but reused prior
fixtures/cases. It is regression/evaluation material, not a fresh hidden holdout
after inspection/tuning. Frozen expectations alone do not establish independence.
There is **no committed general live runner/scorer, eval package command,
general cross-case semantic claim grader or registered held-out suite**. Some individual
captured-response replays already exist in Vitest. The JSON protocols/scorecards
must not be mistaken for an implemented eval framework or new permission to call a
model. Original call caps are exhausted; future calls need their own explicit
scope/budget under Delivery. This catalog adds no live execution entry point.

### First response, review and recovered completion

The [twelve-case results](../evidence/live-acceptance-241/README.md) reached PDFs after
review and manual recovery, including API-driven operations, installed state and
transport/harness limitations. They were not twelve clean uninterrupted UI or
extraction passes. The focused three-case check accepted no proposals and produced
no PDFs. A03 reproduced outcome omission/unsupported D7 linkage; A04 and A11 had
narrower passes. The [text milestone remains NO-GO](../evidence/issue-243/README.md#hosted-and-focused-live-checkpoint).
UI improvements and mock regressions do not overturn that result. Keep issue150,
PR240 and Ali-retest follow-ups paused/deferred as [Coverage](../docs/COVERAGE.md#paused-decisions-and-excluded-polish)
records; do not turn historical recommendations into participation approval.

Existing source/change IDs, parsed states, projection `sourceTrace`/omissions,
commands, readbacks and render manifests support investigation. Trace a material
claim through input → provider proposal → parsed/quarantined proposal → review or
manual recovery → accepted fact → projection/omission → actual PDF. The repo has
pieces of this chain and scoped assertions, not one general cross-case claim ledger.
A valid reference is not entailment; a final repaired PDF is not a clean first pass.
Do not compress these into a single count/pass percentage that hides wrong-entity,
invented or lost material information.

## Runtime and cost evidence

These are dated observations, not benchmarks, budgets or current prices. The counts
above came from collection-only reports, not a new execution. Independent human
scoring/visual-inspection effort, subset cold/warm runtimes, variability and CI
compute billing are not established here.

| Recorded run | Observation | Limits |
|---|---|---|
| [Exact-head CI39077609550](https://github.com/warblersafety/wilson-next/actions/runs/39077609550), 17 Oct 2026, `d3e7d36` | Mixed Vitest step 4m12s; build 13s; 180 browser tests 10.8m; verify check approximately 16m22s including setup/typecheck | One run; same complete tree as merged `2a72a4a`. Does not measure each catalog subset or general CI latency |
| [Main CI39078736691](https://github.com/warblersafety/wilson-next/actions/runs/39078736691), 17 Oct 2026, `2a72a4a` | Vitest 4m11s; build 14s; 180 browser tests 10.7m | No application-model calls; infrastructure/human time is not free |
| [Twelve-case summary](../evidence/live-acceptance-241/summary.json) | 15 model calls; application-estimated USD0.878292 | Historical estimate, not invoice/current tariff; recovered success and harness limits retained |
| [Focused D7 summary](../evidence/issue-243/live-outcome-summary.json) | 3 model calls; application-estimated USD0.266328 | Historical estimate; A03 failed the frozen criterion; no new reliability rate established |

Existing focused selections let a developer inspect relevant contracts before the
full gate. Live diagnostics, repeated trials, broad paraphrase/ambiguity coverage,
held-out evaluation and a general grader would be separate work, not implemented
suite tiers or scheduled jobs here. No additional tests/evals are introduced by
this organization.
