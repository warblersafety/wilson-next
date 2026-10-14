# Issue139 — integrated browser-local workspace acceptance

Baseline: `46f40777b0f39ec4b4c0e1173acbeeda69e7d81e` (PR138),
14 October 2026. This is the bounded synthetic active-case integration;
Architecture owns its durable design and limits. Reporter reuse is a later slice.

## Implementer evidence

Exact Node **24.20.0**, existing locked dependencies and installed Chromium/PDF
reader, no installs or live application-model calls:

- TypeScript `tsc --noEmit`: **PASS**.
- Vitest full suite: **331 tests, 43 files PASS**.
- Fresh Next build: **PASS**.
- Full Playwright Chromium suite: **48 journeys PASS**, 1.5 minutes.
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
evidence. Initial full44 local verification superseded those failures. The final full48
verification includes the review/CI corrections below.

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

Actual subscription Opus high review at `b56e74b` found no blockers; all three
follow-ups and the evidence gap have bounded remediation below. The same review
session's targeted recheck, final-head CI, squash merge and merged-main
verification remain gates at this checkpoint. Protected stable-origin
and matching deployed release provenance checks remain the phase milestone gate;
local null release provenance is not deployed-version evidence.


## Review and CI remediation

Actual standard review: `issue139-20261014T211356-bf932fca`, Opus high,
canonical `claude-opus-5-5`, CLI2.1.296, subscription preflight passed. It was
static only; the reviewer ran no tests or independent CI/browser checks. No
Safari/Firefox evidence is claimed. The full verdict/findings/limits are in PR140.

- F1: only invalidated pending fields are set aside, not unaffected live edits.
  Historical-reference wording stays true after later explicit edits. Confirmed
  discard removes earlier edits without changing accepted facts. Retained text
  counts as work even in a blank case. Known free text is displayed verbatim;
  choice labels apply only to actual choices. Native evidence covers a literal
  `declined` value, cancellation of New case, reference-only behavior and discard.
- F2: old `wilson-journey-state-v2` tab input stays separate from the new optional
  `wilson-current-case-debug-v1` mirror. New case cannot clear retained old input,
  including in unsaved mode. Existing durable state never overwrites another old
  tab source. A notice surfaces separate earlier work; only explicitly confirmed
  damaged-legacy recovery removes it. This is compatibility preservation, not a
  case list or a second case authority.
- F3: cancellation is registered before acquisition's first await. A replacement
  waits for its own cancelled native request to finish. There is no sleep, forced
  takeover or change to ordinary second-tab blocking. The Playwright-only harness
  uses actual React development StrictMode; its probe confirms two effect starts
  and one cleanup, with a deliberately held native grant before successful load.
- Evidence gap: restart now checks the visible Reporter screen and active
  navigation, then the visible conflict and omitted-detail notice.
- Additional implementer guard: inconsistent/regressing response revisions are
  rejected before replacing current work; focused recurrence evidence is added.

Initial CI38638597431 passed42 journeys and failed the two new quota/abort tests.
Their independent unsent-update save can fail while the correction response is
still held, so the old assertion could read accepted age57 before acknowledgement
although an age58 draft was visible. The corrected tests deliberately assert57
before release, wait for the actual successful response and completed editor,
then require58. Original expected values, no-replay checks and timeout limits
remain. The focused pair and final full48 suite pass; CI was not blindly rerun.

Final local Node24.20.0 gates after all remediation: typecheck/build,331unit tests
across43files and48Chromium journeys pass. Raw review reports and full local logs
remain local; no model/release/process-restart claim is inferred from CI alone.
