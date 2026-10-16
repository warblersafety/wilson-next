# Explicit patient involvement / native A1 — issue196

One reviewed fact separates patient participation from identity. Known none is explicit no-patient; known present is explicit participation. Unknown, declined, inapplicable, explicitly-absent wrapper status and unmentioned/empty never assert no patient. No inference from missing demographics, absent symptoms, packaging, category or source text on migration. Current narrative correction remains unchanged; PR195's general prompt experiment is excluded.

FDA A1 instructs entry of `none` when no patient was involved. B1 defines adverse events as adverse outcomes in patients. Source checked2026-10-16: https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500 (A1/B1). Native A1 none comes from accepted involvement with that source trace, not a made-up identifier. Present/unknown participation does not erase a known identifier.

No-patient versus current known demographics or a selected adverse-event report type blocks export for explicit correction. All facts/history remain. Legacy literal identifier none is retained but requires explicit participation/identifier repair; it is never silently reinterpreted. New controls require a deliberate selection and reuse existing review/correction/save/resume behavior. No UI redesign or clinical inference.

Browser statev22 adds only empty participation after strict validation of genuine v7-v21. `tests/fixtures/patient-involvement-v21.json` is an actual fictional stable-v21 saved state from served commitf5fc0fa (merged maince1a0fa), with no involvement field; SHA256 `6d0c0fb91d491d88ebf49e2c37bb2f1b52ea5c799370a5823bcdfcdf2c2c1d4e`. Its source includes no-patient wording that must not become a fact on migration. Sources, history, revision, other facts and unfinished identifier words are checked for preservation. Historical fixture builders remove the new field from pre-v22 payloads; mislabeled older payloads still reject it. Future-version sentinels now usev99.

Local **770 unit tests / 79 files, typecheck, production build and all 117 full mock Chromium journeys passed**. Six actual browser-downloaded PDFs and independent pypdf readbacks are retained here; verification.json pins their hashes and native A1 values. New conversation fixtures are authored synthetic provider outputs, not measured live-model behavior. All application-model responses are mocked; no live paid evaluation batch or new model call is authorized/run. Actual Opus review and exact-headCI remain mandatory before merge.

Bounded live plan if later authorized: one explicit no-patient cosmetic opening, then one explicit involvement correction on that reviewed case, verifying source/status/A1 and other facts with ordinary review. At most2model requests, no retries; pause on missing metrics or material failure. This plan is not permission to run it. Other narrative omissions, unsupported partial dates/demographics, broader supplement integration and general semantic correction remain separate release-cut scope.

Independent macOS PDFKit 2× page1 render was inspected: A1 `none` is readable and unclipped, A2–A5 remain blank, Product Problem alone is selected, and FDA identity/native geometry remain intact. The renderer is independent of the application PDF library. Present-with-unknown-ID and participation-unknown PDFs are byte-identical, as expected for the native form’s lack of a positive participation checkbox; the reviewed semantic states remain distinct in persisted case knowledge.

## Actual Opus blocker remediation

The original full run passed 770 unit tests and 117 mock browser journeys. Actual
Opus found that known alternatives in conflicted demographics could bypass the
new no-patient guard. That blocker is fixed: both projection and readiness now
count current known conflicting alternatives, without changing generic partial
conflict policy or deleting facts. All six demographic targets have isolated
unit regressions; the browser recurrence starts with only accepted age42 and
no-patient status, then accepts disputed ages42/43, reloads and remains blocked.
776 unit tests, rebuilt application and all5affected browser journeys pass.
All six fresh PDF named-field readbacks match the retained originals. The final
full118browser gate and targeted Opus recheck are required before merge.
Opus's separate serious-outcome consistency follow-up is tracked as issue198;
this slice does not claim that no-patient versus B2 outcomes is fully reconciled.
