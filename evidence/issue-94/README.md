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

The six-call v2 batch cost USD 0.206244. Both labelled rechecks and three of four
new cases met all predeclared expectations. The remaining new case correctly
retained both medications, counts, units, laterality and specific denial, but
omitted the explicitly stated absence of a product-quality complaint. That is
retained as a failed expectation in `remediation-assessment.json`, not relabelled
a pass. V3 clarifies absent, unknown and unmentioned product complaints without
changing runtime values or inference. `final-protocol.json` declares one
material-change recheck plus three new contrasts, max four calls and USD5, zero
automatic retries; earlier failures and expectations remain unchanged. This is
the final bounded evaluation batch, not an open-ended search for passing retries.

## Final focused verification

V3's four predeclared cases all meet the targeted source → proposal → accepted
case → independent pypdf checks. The original-input recheck is identified
separately from the three new cases. Explicit absence, unmentioned and unknown
complaints remain distinct; patient manifestations keep negation, laterality and
uncertainty; dose count/form and supplied total remain with their own product,
without calculated totals or strength inference. `final-assessment.json` records
those results. This is bounded behavioral evidence, not a reliability rate or
permission to skip clinician review. V1 and v2 failure assessments remain intact.

Twenty application-model calls across three batches exposed 132,335 input and
45,925 output tokens, 387.301 seconds provider latency and USD **0.723920**
estimated cost. There were zero automatic retries and three explicitly labelled
rechecks after material contract changes. `model-totals.json` and each batch's
results retain exact per-call metrics and deployment identity. The application
model remains Sonnet 5; the independent reviewer is separate.

225 deterministic tests, typecheck and production build pass. The nine existing
browser journeys passed after opening-group repair; the new focused browser
journey passes on the final UI and is included in required CI. It confirms
separate Event/medication review, PDF gating, visible qualifiers before/after
acceptance, value-only edits that retain qualifiers, explicit qualifier removal
and retained superseded history. Only the existing qualifier is editable; no
clinical/form field or capacity was added. Missing qualifier values are not
invented. The normal independent review and final CI disposition belong to PR #112.

The exact first two failed provider outputs now pass production-adapter replay
without changing a value, target, qualifier, intent or source. Separate group
acceptance, rejection, unknown-strength omission, reporter readiness and actual
PDF readback are covered. Invalid response identity still retains the complete
accepted case/stage and is not retried. Existing incompatible alternatives remain
unresolved rather than being silently combined. The count/tablet and qualified
B5/D6 PDFKit captures were visually inspected: complete text is visible, with
compound quantities using the existing blank-unit fallback. Longer wording uses
the existing form's automatic font sizing; capacity/continuation pages remain
outside scope.

Raw model JSON, compact grounded/accepted facts and conflicts, source excerpts,
all actual sampled PDFs, hashes, action sequences and independent named-field
readbacks are retained here. Full duplicate browser-state snapshots are preserved
privately in `/private/tmp/wilson94-raw-state`; they are not a second repository
case store. `inspect-results.py` uses pypdf, independently of the adapter, and
`assess-remediation.py final` verifies source-authored expectations. Running it
without `final` intentionally reports the preserved v2 failed expectation.
`check-live.mjs` refuses a second exposure of an already recorded case.

Harness corrections were not model retries: the first unit run selected an old
Python environment without pypdf; initial new tests used an incorrect PDF field
name/blank-unit export assumption and an opening group before the direct-edit
stage; the browser module needed JSON import attributes. These were corrected
without weakening runtime acceptance or changing the preserved model results.

## Protected deployed verification

Final material candidate `c99921ee9bca5aee91782e11b3832c2b05f22824`, deployment
`dpl_BAwHki1chu9VEaBnWii3jMn6vvid`, passed the protected-browser check after
review remediation. Earlier candidate `576163d` also passed before remediation.
The existing shared alias and share grant are retained, expiring September 27 at
21:15:51 UTC. Access-bearing URL remains private at
`/private/tmp/wilson94-share-handoff.json`. Fresh anonymous share access succeeds;
unsigned access is HTTP 302. Original working rollback is
`dpl_zSpFAhE3mGn819gSa8A2NowjRs5T`. No production or paid-plan change.

`check-preview.mjs` resumes retained synthetic states and blocks interpretation.
Real deployed UI actions require separate symptom/medication acceptance and keep
pending-PDF/reporter gates. All **52** populated fields in the tablet replay PDF
match the local independent readback. Symptom and dose edits keep qualifiers;
clear/retype keeps the qualifier control visible, and explicit symptom-qualifier
removal changes only B5 in the regenerated PDF and
retains superseded history. Deployed PDFs, screenshots and independent
readbacks are retained; `preview-results.json` records zero interpretation calls.
No user walkthrough was requested.

The policy task subsequently restored the application baseline in PR #114
(`1ea1702`), retaining its Opus-high policy. Reconciling that corrective main
into #112 at `6ac2c72` resolves its CI-blocking conflicts while retaining the
**identical committed tree** of reviewed/deployed `576163d`:
`5d8261b140417dc54725102d65bdcd71082a9ded`. The current main...HEAD diff now contains
all #94 changes normally. The independent reviewer also received the complete
pre-slice source diff, so no accidentally merged lines evade review. That candidate was verified before independent-review remediation; the final
protected preview record below supersedes its deployment metadata.


## Independent-review remediation

The standard Opus-high review at `576163d` reported no blocking findings and
four follow-ups. Its actual unedited result is on PR #112. This slice repairs
the two bounded defects nearest the delivered behavior: non-carried symptoms
and product complaints now have individual projection omissions (including
absent, unknown, empty and conflicted states), and an existing qualifier input
remains mounted while it is cleared/retyped. Existing omission UI displays
non-empty reasons; unmentioned details remain unmentioned. Readiness is unchanged.
New recurrence coverage reads actual B5 PDF for absent/unknown/unmentioned
complaints, asserts conflicted-symptom disclosure, and replaces then explicitly
removes a qualifier through the browser.

A qualified simple quantity `500 mg (approximate)` is verified through actual
D6 independent readback as intact descriptive text with blank unit (the original
FDA dropdown export is `40`). This preserves readable clinical meaning while
losing structured unit encoding. Broader qualifier projection, remaining
narrative omissions, structured-unit preservation and qualifier re-entry after
saved removal are tracked in #115, without beginning that slice. Fixed form
capacity remains a limit. ARCHITECTURE now explicitly states the small-sample
reliability limit and qualified-quantity fallback.

Post-review verification: 229 deterministic tests, typecheck and production build
pass. The first
browser attempt used the old production build and reproduced the disappearing
input; the rebuilt application passes the new clear/retype regression after correcting
the assertion to wait for the saved removal, rather than an already-absent old
qualifier string. No model
calls or successful-retry reliability claim were added. One targeted same-session
Opus-high recheck assessed this material delta with no blocking findings. Its
remaining evidence-record finding is resolved by `81da4dc`: final deployment
metadata, the stable-control assertion result and four omission UI/PDF cases
were verified and committed while the immutable recheck snapshot was running.
The small owning-document residual about other narrative omissions is recorded
in ARCHITECTURE as recommended; no further behavior or model call is added.


`check-preview-omissions.mjs` additionally restores the exact retained denied,
unknown, unmentioned and conflicted cases on the final deployment. The output
review displays absent/unknown/conflicted reasons and leaves unmentioned details
unasserted. Four independently read-back deployed PDFs match the projected B5
without inventing a complaint or resolving conflicting symptoms. These run without
interpretation, preserve the old failed model output and do not count as retries.
`preview-omissions-results.json` and its PDFs/screenshots retain the checks.
Required CI [35919307554](https://github.com/warblersafety/wilson-next/actions/runs/35919307554)
passes all ten browser journeys and the deterministic/typecheck/build checks on
`c99921e`. Final evidence-only commits still require normal protected-main CI.
The PR owns the actual standard-review and targeted-recheck verdicts, usage,
remaining follow-up #115, resolving commit and merge decision.
