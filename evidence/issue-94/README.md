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
