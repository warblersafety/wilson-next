# Bounded serial-test correction contract

Baseline: main `34cb8160e5c5ce90b44171aadb91e15bc1740691` (15 October 2026).
Owning [issue105](https://github.com/warblersafety/wilson-next/issues/105) retains
its original failure and [existing diagnosis](https://github.com/warblersafety/wilson-next/issues/105#issuecomment-5803617218).
The original raw provider response is unavailable. The new tests construct
synthetic responses; they are not a byte-exact replay or a live-model evaluation.

## Contract and scope

Later-turn test corrections use request-owned existing IDs, including pending
or unnamed observations. The request schema enumerates those correction targets;
genuine new observations remain possible through separate fact/alternative
proposals and local declarations. Runtime enforcement prevents a correction
reference from allocating an observation, including dependent facts on the same
bad declaration, while retaining independent valid siblings. Exact existing IDs
echoed in declarations still identify their original observations. Source,
accepted facts, history and explicit review remain authoritative. No fuzzy
matching, automatic acceptance, medicine-specific rule or retry-as-repair exists.

The installed SDK0.124.0 `zodOutputFormat` demotes enum/const constraints to
provider-visible descriptions; [issue38](https://github.com/warblersafety/wilson-next/issues/38)
already records that pattern. A request-level regression caught it here. The
[official raw-schema API](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
supports enum/const. For this later-turn contract, the adapter restores those
choices from the original Zod schema onto the SDK-transformed schema, including
branch discriminants. Unsupported numeric/length constraints remain guidance
and local checks. No SDK monkeypatch or dependency change is used. Opening
requests remain unchanged. Existing later-turn enum/const choices also become
structural; their meanings and local validation are unchanged.

Prompt revision: `wilson-test-correction-identity-v1`. Schema revision:
`wilson-grounded-proposals-v17-existing-test-corrections`. Historical samples
and their recorded revisions are not rewritten.

## Verification

- Request test verifies actual outgoing ID enums and branch discriminants;
  changing context changes its allowed IDs. Unsupported numeric/length keywords
  remain removed from the provider schema.
- Five boundary cases cover exact IDs, invented/typo references despite a
  declaration, independent addition versus bad-reference siblings, redundant
  existing declarations and genuine first additions when no tests exist.
- Five production request/boundary/service cases cover explicit acceptance,
  stable IDs, untouched sibling/facts/ranges/dates, superseded history,
  no-allocation/no-retry failures, genuine additions and independent mixed review.
- Service PDF generation is independently read with pypdf. Three mocked browser
  journeys also download the actual UI PDF, verify corrected/separate rows,
  reload/resume, mixed review and retained draft/case after malformed reference.
- Exact Node24.20.0: **352 unit tests in47 files**, typecheck and fresh build
  passed. The three focused Chromium journeys passed in3.9seconds; the full
  **65 mocked Chromium journeys passed in1.7minutes**, including actual UI PDF
  readback. Exact-head and merged-main CI remain separate delivery gates.

Harness corrections: the three new responses must appear before the existing
source-reference scenarios, matching browser execution order; the exact mock
queue is now28 scenarios/42 responses/37 distinct scopes. An initial incorrectly
prepended run was interrupted, not counted as success. A synthetic baseline is
cloned before assigning a browser-valid case ID; browser-state decoding is
checked before service tests. No storage validator or product assertion was
weakened.

## Limits

All application-model calls were mocked. Live provider acceptance of this exact
schema, grammar-compilation latency/cache cost and semantic choice of the right
existing ID remain **unverified**. A valid ID is not proof that ambiguous source
wording means that observation; clinician review and source attribution remain
necessary. Local strict identity/value checks remain even where provider enum
casing can vary. No new grant, credential, auth change, paid application-model
batch or dependency installation was used. This is not general interpretation
reliability, complete Form3500 coverage or real-data approval.
