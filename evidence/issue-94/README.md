# Issue 94 — symptom placement and supplied dose wording

## Investigation and remedy

Issue-90 `live-results.json` retains rash/abdominal pain in problemDescription,
and the explicit two-tablet/500 mg dose reduced to 500 mg. Its numerical
quantity checks passed, but do not establish wording fidelity. Issue #94's
September 20 comment independently confirms melena in Product problem and
PDF B5 `Problem detail: melena.` Issue-92's fresh case repeats nausea placement.
The September 22 walkthroughs record duplication into both fields; September 23
screenshots again show gastrointestinal bleeding under Product problem. Those
screenshots establish displayed placement, not original request text or retries.
They remain preserved locally in the handoff/history; no original request is
invented here.

The model receives enumerated field names and value shapes, but no explicit
symptom-versus-product-defect definition. Existing dose guidance says to retain
descriptive wording without explicitly retaining count and stated total together.
The focused remedy clarifies those meanings in the prompt and target schema
annotations. Runtime field types, grounding, validation, grouping, acceptance,
readiness, case retention and PDF projection are unchanged. No field relabelling,
semantic postprocessor, keyword classifier, arithmetic or retry is introduced.
Existing accepted cases are not silently repaired; ordinary clinician correction
remains necessary for a previously accepted placement error.

`live-protocol.json` declares exact retained inputs and varied synthetic wording,
source-based expectations, call/spend limits and zero retry before exposure.
Runtime never imports the evaluation cases. The walkthrough case is explicitly
reconstructed, not an exact replay. First-pass outputs, failures and external
PDF readback will be retained. A small sample cannot establish reliability.

Scope follows Steve's September 23 request and DELIVERY.md. #105 test identity,
UI/navigation cleanup, fields/capacity expansion, registration and richer progress
are excluded. Start: September 23 19:59 UTC; checkpoint after three active hours
if unfinished. All 55 local uncommitted documents/evidence/archives were hashed
and copied to `/private/tmp/wilson94-preserved-20260923`; only roadmap and handoff
will receive requested local delivery updates. Codex token measurements unavailable.

## First-pass blocker found during evaluation

The first two candidate calls extracted the targeted symptoms/doses correctly,
but reused a raw opening label across patient/event/product. Both failed before
review; they remain failures, not successful retries. The raw responses are kept
unchanged in `retained-dose-only-model.json` and `retained-tablets-model.json`.
Opening patient/event groups were already code-owned (`patient` and `event`),
so rejecting their unused model labels prevented otherwise grounded proposals
from reaching the existing separate review groups.

A bounded prerequisite repair removes that redundant raw-label check for opening
patient/event only. Product/test declaration consistency, distinct declared
entity labels, resolved entity identity, proposal quarantine and the final
single-entity assembled-group invariant still apply. It changes no target/value,
evidence, within-entity acceptance unit or clinical inference. This is not the
broader grouping redesign deferred by #109. Exact first-pass replay, not another
model call, supplies recurrence evidence; the first two semantic replay cases
failed before the repair and pass afterward. The prompt remains frozen for all
ten predeclared evaluations. No retry is counted as a fix.

## Concurrent delivery reconciliation

Another task checked out a policy branch from the in-progress #94 branch and
merged #113 (`bb0ddf5`) into main while this evaluation was running. Contrary to
that PR's policy-only description, its squash commit contains the initial #94
prompt/schema annotations, request tests and predeclared protocol. They had not
yet received this slice's independent review. No symptom-fidelity readiness or
closure is inferred from that merge. The next local #94 commit landed on local
main because the concurrent task had switched the checkout; it was preserved,
cherry-picked to the intended #94 branch and the local main pointer restored to
origin/main. No remote main write/bypass or local-document discard was performed.

The #94 PR merges current main for the new DELIVERY.md policy. The complete
material source/test change from the pre-slice base `7542a90` is additionally
retained in `material-from-pre-slice.diff` for the normal independent reviewer;
`main...HEAD` alone omits the prematurely merged prompt changes. Review must
cover both, and the current full source plus first-pass evidence. Standard review
now uses Opus high under Steve's newly merged policy. This is one review, not an
extra reviewer or a reliability claim.

## Frozen v1 batch and bounded remediation

The ten v1 calls cost an estimated USD 0.369140 (provider metrics retained).
Two original openings failed raw grouping, later repaired by unchanged-response
replay. Eight reached PDF. Product/symptom placement and medication count/total
attribution were correct in those proposals, but **PDF availability is not a
fidelity pass**: mixed-complaint and ambiguous-dose split a specific denial into
a competing whole symptoms fact, causing a disclosed conflict and omission.
The mixed case incorrectly emitted field-wide absence. Count-without-total and
ambiguous-dose additionally exposed stored qualifiers being dropped by review
formatting and PDF projection. All first-pass responses/PDFs remain retained;
no failure is erased or scored as a retry success.

V2 explicitly distinguishes whole-list absence from a specific negative item
and asks for one compatible symptoms array, retaining genuine alternatives.
It does not combine or reinterpret returned clinical facts in code. Review
formatting now displays existing known-value qualifiers. B5 symptom/product-
complaint text and D6 dose/strength text retain those accepted qualifiers without
changing the fact, its source or its acceptance. Field capacities are unchanged.
Other projection families and richer narrative remain outside this repair.
Existing partial-output/conflict policy is retained (ARCHITECTURE.md): the v1
conflict remains unresolved and disclosed when replayed, never auto-accepted as
one interpretation. A corrected proposal must still be explicitly reviewed.

`remediation-protocol.json` predeclares six calls (USD5 batch, USD20 issue cap,
USD1.50 reservation per call, zero automatic retries): two explicitly labelled
material-change rechecks and four new contrasts. Rechecks do not establish
independent reliability; their purpose is verifying the changed contract on the
retained failure. The fresh cases assess generalization separately.
