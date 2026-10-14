# Issue #135 — complete typed case-owned UI capture

All unfinished input families now share one versioned, case-scoped in-memory
snapshot: opening/report selection, unsent update, screen, indications, outcomes,
death date, tests/history context, device and medication answers, case reporter
fields/date/destination/disclosure with dirty baseline, and inline field edits
with presentation/accepted-fact fingerprints. Existing controls, command handlers
and prerequisite invalidation remain. No IndexedDB UI wiring or resume claim.

The controlled component owner captures whole typed records under stable scope
and dependency keys. Functional updates use current case-owned data, not stale
component copies. Typed JSON encoding preserves whitespace, empty strings,
false, empty selections, intermediate invalid/incomplete edits and qualifiers.
Optional undefined choices encode as absent/unselected. Strict decoding returns
independent data, distinguishes incompatible versions/tasks from corruption and
rejects cross-case identities without rewriting input. Clinical state remains
separate; draft fingerprints and input history never become accepted facts.

## Complete submitted words versus evidence spans

An initial browser regression disproved the assumption that the first narrative
Source.excerpt is the whole starting account: model-boundary.ts selects source
spans. The unchanged Draft4 full-account assertion failed; later ordered mocks
then became misaligned. No test expectation was weakened.

Successful opening/update acknowledgement now records complete submitted words
in a separate case-bound input history and clears only matching unsent text.
The read-only starting-description view uses that history, and a small collapsed
control retains previous submitted updates. These entries are not an action
queue, model results or accepted knowledge. New case clears them. Earlier tab
states lacking full input cannot be reconstructed; their display explicitly
labels the retained excerpt instead of claiming it is a complete description.

## Verified acceptance

Explicit Node 24.20.0, installed dependencies/independent PDF reader, no live
application-model calls:

- Typecheck, fresh build, all 310 unit tests across 40 files pass.
- All 25 synthetic/mock Chromium journeys pass (1.4 minutes), including the
  unchanged original account display, field-local edits, serial-test identity,
  reporter dirty state and medication dependent-answer invalidation journeys.
- Fifteen new unit checks cover all draft families through the actual storage
  JSON envelope, corruption/version/case mismatches, independent snapshots,
  current functional updates, obsolete dependencies, complete submitted-input
  history, duplicate acknowledgement and matching text clears.
- One new assembled browser check uses valid unchanged synthetic transport
  responses to isolate input-history/display from interpretation quality. It
  retains reporter fields, empty date/privacy choices, inline edits and an
  unsent update across screens; then it verifies exact complete submitted update
  text, unchanged accepted case state and no extra submissions. Actual PDF
  regression remains exercised by the full suite.
- Desktop and 390px screenshots were inspected; no horizontal overflow. The
  existing visual structure remains, with only the small update-history control
  and truthful legacy excerpt wording added.

## Not delivered yet

The snapshot is not durably saved or hydrated. The existing session adapter is
unchanged. Before resume wiring, validate/migrate server state, derive the stage,
validate current draft targets/dependencies against that snapshot and surface
invalidation while preserving the original saved record. Then serialize whole
case+draft commits, coordinate active tabs, preserve work on storage failure,
avoid request replay, make saved status truthful and verify actual browser
process restart/recovery. Reusable reporter storage remains separate future work.

## Initial Opus review remediation

The initial actual Opus high review found no blockers, with three follow-ups:

- F1: qualifier-control visibility was still local. It is now in the card record;
  empty/whitespace qualifier text remains exact through editor and owner remount.
  Blank qualifiers are removed only at explicit command construction, preserving
  the existing non-empty qualifier contract. Cancel/accepted-fact invalidation
  clears the corresponding control marker with its draft.
- F2: navigation alone could not prove actual capture. A Playwright-only HTML
  harness bundles the actual JourneyBody/provider using the already installed
  Vite toolchain. It reads the encoded owner after real control input, remounts
  over a decoded snapshot and verifies retained card, qualifier, reporter dirty
  baseline and clinical-update values. There is no production test route, flag
  or global, and no dependency/lockfile change. The harness uses the existing
  synthetic local API; no model calls occur.
- F3: raw decoding in a reducer could unmount the UI. Restore now decodes before
  dispatch and returns coded failure without replacing the owner. Expected
  internal validation failures retain current data and show an understandable
  alert; arbitrary unexpected programming exceptions are not swallowed. The
  browser check rejects corrupt/future restore data without changing the owner,
  then verifies an invalid action cannot unmount or lose current inputs.

Final remediation checks pass: typecheck, fresh build, all 310 unit tests across
40 files, and all 25 Chromium journeys (1.4 minutes: 24 default-route journeys
plus the actual-component remount harness). The originating reviewer executed
no checks. The actual Opus high targeted recheck at ec350c024753f6894af2384714688763c0fc3c5a
found no blockers or new material regression, and marked F1–F3 addressed.
Exact-head CI remains required before merge. The remount harness proves
in-process capture/hydration only, not durable storage or process-restart resume.

The remount harness relies on Vite 8.2.2 already pinned through the existing
Vitest lockfile. A future Vitest/Vite upgrade must verify its build API options;
no manifest, lockfile or dependency change was introduced by this slice.
