# Collection-time uncertainty: observed omission and bounded mitigation

All source and cases are fictional. This is a model-extraction mitigation, not
proof of general interpretation reliability or a completed live acceptance pass.
Issue192 remains open for bounded verification of the changed prompt.

## Observed cause

The existing live request served commit 5c2fdecdc46b7b94081aed4adb45a903f996bc38
(tree-equivalent to merged main 5f79bad). Read-only retained runtime logs expose
the provider response as well as the parsed envelope. `actual-model-output.json`
is the exact provider text block decoded as JSON, not reconstructed model output.
`synthetic-input.txt` is the exact 879-character input reconstructed from its
contiguous code-owned source excerpts and independently matched byte-for-byte to
the pre-run authored case-pack opening. Provider reasoning, auth data and access
links are excluded. `investigation.json` records hashes and observed usage.

Provider text has 47 proposals and zero qualifiers. INR date cites only p7
(the measurements); p8 (the explicit collection-time uncertainty) is cited only
for event.relevantTestsAvailable. Boundary code copies the validated value
unchanged. The replay test compares every raw and parsed value and reproduces
the retained source/availability citation without an observation qualifier.
Thus this instance is a model omission, not normalization, projection, UI hiding
or lost source. No persistence/PDF defect is inferred from the failed live run.

Actual model: claude-sonnet-5. Existing request input 10,575/output 8,877 tokens,
including 4,694 thinking output tokens; cache creation/read 0. App estimate $0.10992
uses USD 2/input-million plus USD 10/output-million, not a provider invoice or
verified current tariff. Investigation makes zero additional application-model
requests; cumulative cap remains 1 of 20 used.

## Bounded change and its limits

Prompt v19 explicitly preserves supplied collection-time wording as the
identified known date's existing qualifier, citing both source passages. It
keeps calendar day and unavailable time independent, never invents a timestamp,
and keeps unavailable date unknown with context on a supplied known name/result.
No schema, write authority, output field, inference heuristic or generic warning
is added. Existing review/correction/history/persistence and B6 row/field context
projection remain responsible for the proposed qualifier.

FDA B6 instructions cover tests including dates and permit other information in
Additional comments. Verified official source:
https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500
The form's date column remains a calendar date; no new timestamp control is used.

`tests/fixtures/test-time-context.ts` labels its expected corrected outputs as
AUTHORED mocks, separate from the captured failing response. Tests prove that
such a response survives the application, not that Sonnet follows v19. Never
report those fixtures as actual live repaired output. Keep issue192 open until
a bounded live verification; stop if the targeted instruction fails rather than
layering heuristic repairs. No broader omission-detection claim is made.

## Verification

Four focused regressions cover exact captured omission replay, request guidance,
known-day qualifier through review/correction/history/resume/B6 row attribution,
and explicitly unknown date without a fabricated date. The full mocked Chromium
journey submits the original source with an authored expected output, verifies
pending facts, accepts them, reloads, downloads actual PDF, conversationally
corrects only INR context, accepts/reloads and downloads the corrected PDF.
Every other native PDF field, the ALT observation and products remain unchanged.

The two retained PDFs are actual browser downloads. Independent pypdf readback
is in `independent-b6-readback.json`. PDFKit 2x page 3 renders were visually inspected:
INR/ALT names, results, ranges and 03-SEP-2026 dates align; full exact before/after
INR row 1 context is readable and unclipped in Additional comments, with no
context attached to ALT and no guessed time. The corrected browser screenshot
is also retained. These are mock-path artifacts, not live repaired artifacts.
