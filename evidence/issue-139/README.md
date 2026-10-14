# Issue139 — integrated browser-local workspace acceptance

Baseline: `46f40777b0f39ec4b4c0e1173acbeeda69e7d81e` (PR138),
14 October 2026. This is the bounded synthetic active-case integration;
Architecture owns its durable design and limits. Reporter reuse is a later slice.

## Implementer evidence

Exact Node **24.20.0**, existing locked dependencies and installed Chromium/PDF
reader, no installs or live application-model calls:

- TypeScript `tsc --noEmit`: **PASS**.
- Vitest full suite: **329 tests, 43 files PASS**.
- Fresh Next build: **PASS**.
- Full Playwright Chromium suite: **44 journeys PASS**, 1.5 minutes.
- `git diff --check`: **PASS**.
- Desktop1440/mobile390 existing journey screenshots inspected; the saving row
  follows the established shell and existing controls/layout remain.

The full browser suite retains all original26 journeys and their assertions and
timeouts. Fixture setup now seeds the durable record rather than the optional
session mirror. Existing transport mocks include response provenance and retain
the requesting case identity. Native adapter-only tests use fulfilled test HTML
instead of mounting the app, so their two independent writers test the adapter
without competing with the production single-editor lease. No production test
route, global or flag is added.

Native acceptance includes:

- actual persistent Chromium process shutdown (`Browser.isConnected` becomes
  false), relaunch of the same temporary profile and origin, and validated
  resume without action replay;
- accepted facts, pending proposals, a conflict, sources, history, quarantine,
  complete opening/update wording, saved screen, actual inline/qualifier/reporter
  controls and independent unsent update text;
- actual control entry and process restart for indications, serious outcomes,
  death date, tests/history, medication and device tasks, preserving raw spaces,
  selected false, unselected choices and empty/incomplete controls;
- second-tab exclusion before any case request, then safe close-owner/retry
  handoff; native foundation races/stale-generation checks also remain;
- saving status held until the latest real native transaction commits, including
  newer typing while an earlier write is queued;
- injected quota and native abort failures after a successful correction: old
  record intact, accepted response retained in memory and save-only retry with
  exactly one case action;
- corrupt/future envelope and clinical versions, a newer native database version,
  retained originals and no destructive future-version recovery;
- explicitly unsaved new cases with unavailable durable/session storage,
  reentrant-recovery exclusion and no overwrite of retained work;
- changed-record corruption-discard refusal and confirmed unchanged-corruption
  recovery; invalidated text remains readable after subsequent reload;
- live prerequisite changes retain unfinished answers without applying them;
  submitted fields/tasks are acknowledged separately from unrelated drafts;
- incompatible success metadata preserves the accepted response in memory,
  reports unsaved status and cannot retry an older save or repeat the action.

## Development corrections

The first full run passed20 journeys before stale transport mocks lacking the
new required provenance caused a render error. Mocks now match the actual
response contract; expected persistence-encoding failures also retain successful
results in memory rather than unmounting the UI. Original assertions were kept.
New native fixtures initially attempted a direct editor during pending review,
and a dose-reduction control that is inapplicable after stopped=true. Scenarios
now enter edits in the allowed stage and use the applicable improvement answer;
product behavior was not changed to accommodate them. A live-invalidation gap
found in the implementer audit was fixed and has focused unit/native recurrence
evidence. Final full44 verification supersedes the intermediate failures.

## Limits and remaining gates

These are deterministic synthetic cases and injected failure evidence, not
extraction accuracy, live-model reliability, real-data/privacy readiness or
external-clinician acceptance. No real clinical/contact data was used.

Native transaction completion uses browser-default durability; OS crash/power
loss may lose the latest completed save. Eviction, private profiles, clearing
site data and changing origins are outside recovery. No off-device backup or
cross-device/case-list feature is implied. Closing during an uncompleted request
can leave an unobserved result; no action is automatically replayed.

Unsupported non-JSON corruption that cannot be compared safely stays retained
without a destructive recovery button. Future records/database versions require
a compatible release. Legacy session imports cannot invent missing full wording.

No dependencies, services, lockfile, deployment/access/auth settings, clinical
command semantics or production release were added/changed. The unchanged UI
control inventory was moved to `src/browser/fact-controls.ts` with an app reexport
so restore validation shares the same representation rules.

Actual subscription Opus high review, final-head CI, squash merge and merged-main
verification remain delivery gates at this checkpoint. Protected stable-origin
and matching deployed release provenance checks remain the phase milestone gate;
local null release provenance is not deployed-version evidence.
