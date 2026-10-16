# Whole-list context scope — issue159

Review and B5 now identify a qualifier as context for its stored list fact,
rather than placing an unlabeled parenthetical after the last item. Review
uses "Context for this list"; B5 uses "Symptoms list context" and "Treatment
list context". Exact qualifier text and supplied item order stay unchanged,
including context mentioning one item or uncertain chronology. The application
never parses context to attribute it to an individual item. Unqualified lists,
scalar/choice context and existing visual design are unchanged.

No schema, saved-state version, prompt, model, question budget or clinical
classification changes. Pending proposals keep current accepted facts; accepted
conflicts omit disputed values under the existing partial-output policy until
an explicit choice. Current non-known values do not resurrect historical text.
Correction/removal/re-add and saved unfinished context edits survive reload.
Existing PDF glyph/fit/continuation/omission controls remain active. Prior
context PDF tests still cover native overflow continuation and unsupported glyph
blocking without truncating or erasing accepted source text.

FDA general narrative/B5 authority checked 2026-10-16:
https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500

815 unit tests /81 files, typecheck/build and both focused synthetic/mock browser
journeys passed. All124 full mock browser journeys passed. Six actual browser PDFs and
independent pypdf readbacks are retained and hashed in verification.json:
reviewed lists; unresolved treatment alternatives; explicitly chosen treatment
list; separate symptom/treatment context removal; final context re-add. B5 of
the reviewed-list PDF was independently rendered by PDFKit2x and visually
inspected readable/unclipped with both explicit context labels. Final re-add
native fields match the initial accepted list state in the browser assertions.
The deterministic mock queue is75 responses across44 authored scenarios;
no live application-model calls or paid batch was used for this slice.

Actual Opus review and exact-head CI remain required before merge. The short
macro completion checklist is maintained in docs/PRODUCT.md. Issue200's blanket
positive-B2/report-type gate was stopped after checking FDA's prospective-risk
criteria; its recorded decision leaves the issue open without a clinical
inference. PR195 stays unmerged and issue150 stays paused. Current bounded
list presentation is not general source-omission detection or full Form3500
completion.
