# Issue 116 — Draft 4 flow alignment

## Comparison before implementation

Inspected the preserved Draft 4 portable mockup and editable source, the running
application on baseline `7c5ad3496e694b5959f0a0afa220e4bd16efc6f6`, and September
22–23 walkthrough records named in #116. Resumed the retained synthetic #109
pending state, including separate history/medication updates and two dated tests.
Pre-change screenshots and an exact backup/hash manifest of all 61 pre-existing
local documents, evidence and mockup files are in `/private/tmp/wilson116-*`.

| Observed mismatch | Classification and selected treatment |
| --- | --- |
| Tests become reviewable after update acceptance with little explanation | A real application state simplified by the scripted mockup. Preserve the dependency and separate acceptance; announce the transition and place explicit guidance in each newly reviewable test card, alongside existing focus/scroll. |
| Reporter/Output gives vague clinical guidance or instructs unavailable saving | Incomplete integration of Draft 4's next-action direction with real prerequisites. Show pending groups and actual completion-policy needs; route directly to pending review or open/focus the next permitted direct question. Retain reporter drafts and saving gates. |
| Required follow-ups sound optional or repeat proposed answers | Incomplete application of the shared-needs invitation. Distinguish pending proposed answers from still-missing targets using existing policy and validated review state. Proposed tests are pending review, not a request to supply tests again. |
| Repetitive headings, expanded repeated evidence, touching opening actions | Presentation gap. Keep the four screens, yellow invitation and teal primary actions. Name each review group, condense field presentation, disclose each unique source passage once per group with explicit field attribution, and space acceptance actions consistently. |
| Combined confirmation, neutral skip, partial reporter export, unset reporter defaults/free-text occupation, richer story/progress, scripted correction recognition | Intentional deferrals. No adoption in this slice. #105, #115, #99, registration, form expansion and broader redesign remain outside scope. |

No clinical policy, model prompt, case mutation, projection or PDF adapter changes
are intended. No live interpretation batch or repeated user walkthrough is needed.
Unknown, declined, absent, disputed, proposed and accepted facts keep their meanings.

## Verification

The focused Chromium journey resumes a labelled synthetic variant of the retained
#109 response (one serious outcome deliberately left unextracted). It makes no
interpretation calls, verifies the two independent update groups, newly available
separate test acceptance, source-to-field disclosure, named clinical blockers,
direct-question opening/focus, retained clinical/reporter/direct-answer drafts,
explicit reporter saving and blocked output until completion. Its actual PDF
matches all 59 populated fields in the independently read #109 baseline, including
both dated test rows and privacy. Selected 1440px/390px layouts are inspected.

Three focused deterministic tests distinguish pending versus missing answers,
rejection returning a need to missing, and conditional medication recalculation
only after acceptance. All 232 deterministic tests, typecheck and build pass. Required GitHub CI on
application commit `8e494f5` passes all 11 browser journeys. Two local full-suite
runs each passed nine journeys and timed out in the existing simulated-error
usability check, which then displaced the next test's global response fixtures.
An isolated run of those two tests passes. The retained trace records a completed
HTTP 422 and a pending browser-diagnostics request while the UI remained busy;
that request/response code is unchanged. No test expectation or application
behavior was changed to conceal the limitation. `verification.json` records the
runs and minimal network timing evidence. The complete local trace remains at
`/private/tmp/wilson116-failure-trace/trace.zip`.

Screenshots retain the inspected Draft 4 baseline, original misleading Output,
compact attributed update, newly available test review, and desktop/mobile
clinical blockers. `accepted.pdf` and `pdf-readback.json` retain actual output.
Normal independent Opus-high review is pending on PR #117, the canonical review
record. The final required check will run on the post-PR evidence commit too.

No policy, source, semantic case, prompt, projection or PDF adapter changed.
The fixture is not the unavailable original September 23 raw state. These checks
establish bounded interaction/content behavior, not model reliability, unassisted
usability, screen-reader parity or full form coverage.
