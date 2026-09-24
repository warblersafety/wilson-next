# Issue 122 — separate clinical tasks and repair shared editing

Steve approved the narrowed three-part 80/20 slice after the post-#120 planning
discussion and explicitly lifted the earlier planning-only hold. Issue #122 owns
scope; the PR owns independent review and final delivery evidence.

Only `app/journey.tsx` and `app/page.module.css` change in production:

- The missing-information panel contains the current structured question once,
  beside its answer controls. Other outstanding needs are disclosed separately;
  pending answers are not presented as gaps. Conditional treatment questions are
  rechecked after proposal review. The shared freeform draft has a separate neutral
  panel and `Prepare changes for review` action. Clinical-screen navigation uses
  secondary `Go to...` actions where needed; Reporter/Output return actions remain.
- Later proposals appear once in the existing update-review area, retaining
  separate Accept/Discard controls and attributed sources. Entity summaries retain
  accepted information and link to their pending groups by stable identity. Opening
  and new-test proposals retain their existing local acceptance controls.
- Field-local Cancel closes the editor and clears only its draft. Opening or
  reverting an editor produces no false unsaved marker or opening correction.
  Reopening resumes a retained draft. Additional blank fields append after existing
  rows. Hiding additional fields closes their active editor while retaining its
  draft, with a disclosure label indicating unsaved edits. Unrelated drafts and
  accepted information, qualifiers, units and dependency invalidation remain.

The existing layout and service-enforced test-review order remain. No model,
semantic case, completion policy, projection, PDF adapter or form coverage change.
No comprehensive regrouping, Draft 5, registration, richer progress, or work on
#105, #115, #118 or #121. The serious-outcome interpretation concern is unresolved
and separate; this UI never supplies missing outcome answers.

## Verification

234 deterministic tests, typecheck and build pass. The first full browser run
passed 12/14 journeys: an old clinical-navigation selector stopped the usability
journey and displaced the next journey's shared deterministic responses. That
selector now checks the agreed secondary navigation label. Both affected journeys
pass in isolated runs with their matching fixture queues. An intervening paired
run stalled while awaiting the simulated-error diagnostic response (the existing
#118 concern), again displacing the next fixture; no #118 change was made. Final
CI and review results are recorded in the PR, not inferred from these local runs.

All four focused no-interpretation journeys pass within that full run. They cover
single question/proposal locations, pending versus missing states, source links,
unchanged separate test acceptance and readiness, retained clinical/direct-answer/
reporter/privacy drafts, and the actual downloaded PDF. All 59 populated PDF fields
match the retained independent #109 readback, including separate dated hemoglobin
rows and medication follow-up marks.

The new shared-editor journey covers Patient, Event, tests and Product edits;
pristine/reverted values, qualifiers, Cancel/focus, resumed drafts, weight entry,
stable desktop/mobile field geometry, and applying one test correction while other
drafts and the second observation remain unchanged. Existing device, medication
dependency, uncertainty, conflict and output regression paths remain in the suite.

Retained screenshots: [desktop editor](stable-editor-1440.png),
[mobile editor](stable-editor-390.png), and
[single pending-review location](pending-review-desktop.png).

The initial geometry assertion counted viewport scrolling as movement. It now
compares document coordinates; the unchanged editor placement passes at 1440px
and 390px with no horizontal overflow. The sandbox initially blocked the local
server bind; the authorized browser invocation ran with normal host escalation.
No application-model calls or repeated full manual user/PDF walkthrough occurred.

## Preservation and limits

All 101 pre-existing modified/untracked documents, screenshots and mockup archives
were backed up and SHA-256 checked at
`/private/tmp/wilson-clarity-preserved-20260924/manifest.json`. They remain unchanged
and uncommitted. Any temporary stash required by the fixed review runner is restored
and hash-checked. No access-bearing preview URLs or credentials belong here.

These checks establish the bounded interaction change and retained output, not
general interpretation reliability, full form coverage or unassisted usability.
The fixed standard Opus-high review and protected-preview verification follow the
approved delivery process; no expanded review or new model experiment is needed.
