# Twelve complete fictional clinician scenarios

The fixed corpus is [tests/fixtures/live-acceptance-12.json](../../tests/fixtures/live-acceptance-12.json), committed before the first live request at `9e0fc0ac7d78fba60e4e9ef40f1e4e48c1cb39cb`. No expectations were changed after execution. Inputs reuse existing representative fixtures/prior saved fictional cases; the mixed case adds an explicitly concomitant medication. Twelve distinct openings plus three planned corrections ran once each. No prompt variants or model retries were used.

## Outcome and limits

All twelve cases reached actual PDF export after explicit review and documented recovery. Independent pypdf 6.16.2 readback captured native fields for each final PDF; PDFKit rendered all 96 pages. Selected filled pages were visually inspected. The scorecards retain actual PDF/render hashes, first-response and final accepted facts, source, usage and review observations. Full PDFs, readbacks and renders remain in the task evidence archive; hashes do not make the binary artifacts available from this checkout.

**This is not twelve clean extraction/native-projection/uninterrupted UI passes or full Form3500 acceptance.** Most review/completion operations used the protected application API. A01–A07 openings and A03–A04 corrections used that API client; A08–A12 openings and A11 correction used the actual browser form. Returned states were installed in ordinary IndexedDB records and resumed through the app with exact-case comparisons. This tests restoration of supplied records, not twelve naturally persisted UI journeys from first keystroke.

A04 and A07 hit API-client transport interruptions. Their original successful server response bodies and model usage were recovered from the exact original diagnostic operations, without regenerating a model answer. Root cause is unestablished. The remaining form openings completed without that interruption. Do not classify the recovered cases as uninterrupted journey passes or infer a product transport defect from this evidence alone.

## Material observations

- A03/A04: general improving/resolved outcome was omitted while improved-after-change was proposed from stopped-and-improving/resolved wording. The clinician changed the proposed D7 answer to unknown before acceptance and explicitly restored the general outcome. This is a conservative source-grounding concern, not an independently established clinical causality conclusion.
- A05: operator category was correct but the registered-nurse detail needed explicit context restoration. Source-provided no-other-serious answers were reconfirmed when the app asked. A06/A10 omitted unopened/unused context from product-problem prose despite retaining the quoted source and no-patient/no-event semantics; the clinician corrected prose from that exact source.
- A07: device removal was omitted and added directly. A07/A11 accepted concomitant regimen details were disclosed as not included in Section F. Exact source comments restored those details to the report.
- Native Section E contains implant/explant dates but no separate implanted/not-implanted checkbox. Known applicability with unknown dates, and explicitly not-implanted context, were retained through reviewed comments in A05/A07/A08/A09. These additions are manual representation recovery, not model extraction failures where proposals already retained the facts.
- A11 retained INR-only collection-time uncertainty on the INR date. Its planned correction changed only INR 4.8 to4.3; ALT/date/range/uncertainty remained unchanged. A03's correction changed only ALT132 to123 U/L; A04's changed only acetaminophen concomitant to suspect before newly applicable missing questions were answered unknown.
- A12 retained the sparse source, including “severe dizziness.” Unspecified required answers were explicitly unknown, never inferred absence/false.

The pinned official [Form3500 09/2025](../../assets/fda/form-fda-3500-09-2025.pdf), SHA256 `1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`, supplies the field semantics above. Section F asks product names and therapy dates; it has no regimen columns. These limitations do not authorize silently dropping supplied context or inventing dates. General comments were added by the fictional clinician through existing review controls.

## Browser checks and harness limits

Assigned A01/A05/A10/A11 API resumes retained exact case equality. A11's naturally typed unfinished correction survived reload with the accepted case unchanged. A10 verified remembered identity/professional details in a fresh report, with report date/disclosure separately reviewed and clinical facts unchanged. A02/A06/A12 subsequently verified replacing an unsent reporter draft in an already accepted report with remembered details: UI save left each accepted case exactly unchanged. Those three checks are not fresh-case initial reuse claims.

The first A06 reporter UI check was inconclusive because the harness read before asynchronous save completion and accumulated dialog handlers. That path was stopped; a bounded response-witness check later passed. No product failure was inferred. A03 once used an old opening group to accept an update; the server rejected it400 without mutation, and the actual review attention group was used next. One local response filename was overwritten during that harness restore; the tool transcript retains the rejected attempt and later sequence allocation was fixed. One tool handoff's automatic approval review timed out before execution; absence of a sent request was verified before the single successful retry. Diagnostic ingestion delays were reconciled by original operation IDs.

## Baseline and cost

Tested main `7b86b273949be5652533108ebc3c6de6801c4bd8`; existing protected preview served reviewed `4bcabdbe6a1edf6296e555235f8de79a1dd65614`. Both have application tree `9b929054924b52541d801967b10acb7ae9d6d984`. Actual model `claude-sonnet-5`, prompt `wilson-duration-wording-v31`, schema `wilson-grounded-proposals-v39-duration-wording`, browser state v32. Fifteen application-model requests; application-estimated USD0.878292, not invoice/current verified tariff. No purchases, grants, credentials, dependencies, fonts, provider configuration, runtime code or shared-preview changes.

No further live model calls are planned; the fixed fifteen-call cap is exhausted. Evidence-only checks do not require repeating baseline unit/browser suites or changing assertions to bless failures. Hosted UI, source extraction and output fidelity are separate evidence dimensions.

## Practical release cut

No unrecoverable ordinary text-case completion/PDF blocker was observed after clinician review/recovery. The remaining work is evidence review/CI closure and triage of two observed clusters: source/context extraction and disclosed native-context representation. At most zero to two bounded product slices should be considered if those are necessary for the chosen practical release cut; this report does not authorize feature expansion or silently redefine full-product scope. Some observed issues are manual effort rather than release blockers. Transport/harness limits still prevent a claim of twelve uninterrupted UI journeys.

Age PR240 stays paused and unmerged. Its unusual-age wording work is not needed for this cohort. No picture, broader-glyph, new-font, larger-capacity or weight exception was needed. Full C2 pictures, broader capacities and unresolved semantic scope remain separate full-form promises; issue150 stays paused. Do not turn those into prerequisites for these text-only cases or call this cohort all-form certification.

Machine-readable [summary](summary.json) and A01–A12 scorecards distinguish observations and final recovery. Related tracker: #241; integrated source/output follow-up: #180; narrative remainder: #115.
