You are the single fresh-context architecture and product reviewer for Wilson Next. Do not delegate, spawn subagents, edit files, change Git state, use the network, or make any application-model call. Work read-only. This is an expanded review requested by the product owner, using Claude Opus at xhigh effort.

Review objective

Determine the smallest coherent resolution of Issue #67 after its first protected live request failed before generation. Challenge the governing premise, not merely the code. Decide how much precision belongs in the model response, how much belongs in deterministic application validation, and when human judgment should be requested. Optimize for the actual physician workflow, accepted-state safety, exact evidence, diagnostics, deterministic verification, PDF correctness, low physician friction, and minimal model calls. Do not assume either implementation direction is correct.

Fresh-context order

1. First inspect clean main at 14aa6a4 and independently reconstruct the product workflow and safety boundaries. Read all root governing product, architecture, experiment, and delivery documents, plus relevant model, service, case-domain, UI/API, diagnostics, completion, and PDF code/tests.
2. Form your own diagnosis of what the product actually needs before inspecting proposed remediations.
3. Then inspect the historical v11 branch at 94136b6 and the local v12 candidate at fe8baaf using read-only git commands. Read `git show fe8baaf:evidence/issue-67/README.md` for the sanitized failed-call record. Inspect the complete diffs and relevant tests.
4. Only after that compare the strict provider-schema direction with the proposed alternative of simple evidence-backed suggestions, proposal-by-proposal validation, and deterministic clarification questions. Offer a better third option if warranted.

Authoritative Issue #67 record

Title: Remediate the live-model contract for physician readiness

Outcome: Resolve the deferred live-model blocker recorded in #55. On an exact protected synthetic preview, one representative adult-medication opening and one representative single-device opening should produce mechanically representable, semantically viable proposals that reach ordinary clinician review without fixture-specific repair or retry.

Observed evidence: the rich medication opening returned scalar `symptoms` where the domain requires a string list and represented acute treatments as concomitant report products. The conditional-device opening returned free text `available for evaluation` for `productAvailability`, which permits only three semantic values. The generic provider-facing value schema permitted these combinations; local/domain validation rejected the whole response atomically, so accepted state remained safe but the user action failed before review.

Original decision question: Can one general target-dependent model contract, plus one treatment-versus-report-product clarification, make both openings reach truthful ordinary review without weakening the fail-closed local boundary or adding case-specific behavior?

Included scope: complete the provider/local/domain enforcement matrix; inspect the installed SDK's actual transformed schema; implement the smallest target-dependent remediation at the earliest owning boundary while retaining domain validation; at most one general treatment/product clarification; deterministic recurrence evidence; exactly two protected synthetic opening calls with retries disabled; record identifiers, tokens, latency, cost, and sanitized mechanical/semantic verdicts.

Excluded scope: Issue #66; more samples or confirmation claims; fixture-specific logic; silently coercing invalid values; fuzzy repair; weakening atomic rejection; moving authority into the model; new clinical fields, product categories, completion logic, UI redesign, persistence, real data, physician participation, production deployment, or release.

Original acceptance: provider output makes target/value compatibility structural to the practical extent supported; focused list/enum/date/boolean/entity tests; treatment distinction; both live openings reach review without invention, material omission, wrong attribution, retry, or fixture repair; evidence and ordinary proposal-before-acceptance behavior remain intact.

Original stop conditions: stop for a premise decision if the same failure recurs; treatment products recur; a remedy needs case-specific logic, coercion, response repair, retry, or a second prompt/schema iteration; structural compatibility requires a generic ontology/schema platform/provider rewrite; accepted-state safety, evidence, stable identity, or the authoritative write boundary must weaken; material invention/omission/wrong attribution occurs; or more samples/real data/physician/deployment/excess spend are needed.

Durable cleanup audit and dependencies: Issue #37 restored the protected-preview live-model gate and PR #69 merged it. Issue #68 retired closed experiment runners while retaining current response-artifact and diagnostic capability, and PR #70 merged it. Issue #67 should retain diagnostics, PDF capabilities, and warranted synthetic evidence seams. Issue #66 and unrelated cleanup remain excluded. The earlier cleanup audit explicitly said to stop rather than broaden Issue #67 into UI/action schema consolidation or a generic schema platform.

Prior review context, to inspect only after your independent diagnosis: the v11 PR review by Claude Sonnet found no blocking issue and one nonblocking target-enumeration follow-up. It did not exercise the provider compiler. The protected v11 request later failed with Anthropic HTTP 400 `invalid_request_error` before generation; there was no response, accepted command, token accounting, or cost. The raw provider message was intentionally not retained, so schema complexity is an inference. The second opening was not attempted.

Candidate directions to evaluate neutrally

A. v11/v12 provider-perfect direction: encode field/value compatibility in Anthropic's schema. v11 serialized to 22,599 bytes with 5 nested anyOf nodes and 26 branches and was rejected before generation. v12 at fe8baaf uses entity/value buckets, under 16,000 bytes, zero anyOf, and passes deterministic checks, but adds substantial provider-wire and adapter machinery.

B. Reviewable-suggestion direction: use a simpler model contract; preserve exact evidence; screen suggestions independently; send valid ones to review; keep malformed ones unaccepted and diagnostic; turn genuine ambiguity into deterministic clinician questions; retain strict validation at clinician acceptance and PDF generation; use no automatic model retries.

Questions you must answer

- Does filling this form actually require provider-perfect typed model output? Where exactly must precision be absolute?
- Is atomic rejection of the entire model batch a safety invariant or an accidental implementation choice?
- What would the full physician flow look like on clean, mechanically malformed, and semantically ambiguous suggestions?
- How much extra physician work and how many model calls would your recommendation require?
- What is the smallest implementation that delivers the intended product outcome without hiding errors, inventing facts, or weakening accepted-state/PDF safety?
- Should PR #71 close unmerged, be simplified, or continue? Should Issue #67 be amended in place or replaced?
- Which existing work is worth salvaging, and which should be discarded?
- What deterministic and bounded live evidence is sufficient before Steve tests Wilson?

Output

Give a plain-English executive verdict first. Then provide: independent diagnosis; recommended finished-product flow; comparison of the material options; scope and estimated implementation impact; physician friction and model-call count; safety/verification boundaries; exact recommended disposition of PR #71 and Issue #67; and material uncertainties or stop conditions. State what you inspected and any limitations. Be decisive and proportionate. Do not edit anything.
