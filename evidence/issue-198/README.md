# Explicit no-patient / B2 outcome consistency — issue198

A1 none and a current positive B2 outcome cannot be exported together. Only
accepted known no-patient involvement activates this rule. All seven explicit
B2 outcomes are covered, including current known-true alternatives in unresolved
conflicts. False/non-known/unmentioned outcomes and historical positives do not
activate it or infer a patient. Pending proposals keep the ordinary review gate.
All source, history, status, conflicting alternatives and unrelated facts stay
retained; no clinical classification, automatic participation or outcome repair.
The existing controls require explicit clinician correction. Conflict guidance
now explains why this case cannot use ordinary unresolved partial output.

FDA A1/B2 instructions checked2026-10-16:
https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500
The check reads typed B2 answers, never clinical/risk/causality narrative. No
schema, prompt, model parameters or browser-state version changes. Existing
v22 cases resume losslessly with consistency readiness recomputed. One shared
native B2 field list keeps completion/action validation/domain checks aligned.

802 unit tests / 80 files, typecheck/build, all3focused and all121full mock
Chromium browser journeys pass. Five actual browser-downloaded PDFs/readbacks are retained and
hashed in verification.json: no-patient baseline; explicit patient-present with
positive hospitalization; explicit false hospitalization repair; disputed
true/false outcome resolved to false; and explicit unknown participation with
positive death retained. Tests also prove PDF HTTP409 blocking, no automatic
fact removal, correction via either side, historical positive retention and
lossless v22 resume. PDFKit2x render outputs are retained; the representative hospitalization page
was visually inspected readable/unclipped with blank A1 and B2 hospitalization
checked. Fresh full-run PDF readbacks match all retained originals. Actual
subscription Opus review and exact-headCI remain required before merge.

No live application-model calls are used for this issue. The separately
completed2call participation verification is recorded on PR197 and is not a
new batch or evidence of general extraction completeness. PR195 remains
unmerged. Whole-list scope159 and broader unsupported representation remain
separate; no every-sentence accounting machinery is introduced.
