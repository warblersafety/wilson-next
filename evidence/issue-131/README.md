# Issue #131 — typed top-level text drafts

The current UI now owns opening text, report-type selection and unsent clinical
update as one versioned typed record with pure transitions. No control, layout,
navigation, semantic command, sessionStorage or IndexedDB behavior is changed.
This boundary is a prerequisite, not complete unfinished-work capture or durable
save/resume. No user-facing saved-status or recovery claim is introduced.

The strict decoder is available for later integration; the running UI initializes
fresh drafts and does not hydrate persisted drafts. Missing selection is `null`
in the JSON-safe boundary and remains `undefined` at the existing control API.
Text, whitespace and empty strings are retained without normalization. Successful
update acknowledgement clears only the exact submitted text, retaining any later
typing. Only successful confirmed new-case creation resets the record atomically.
Failure and cancelled reset leave it alone.

## Acceptance evidence

Checks use explicit Node 24.20.0 and existing dependencies, with the installed
independent PDF reader selected through PYPDF_PYTHON. No live model calls.

The new browser tests use actual UI controls. One exercises absent report-type
selection and whitespace text through cancelled/failed reset, then a successful
reset to defaults. The other exercises failed update submission, a held valid
synthetic response while typing a newer draft, and matching acknowledgement.
That response intentionally returns unchanged valid case state: this tests the
client transport acknowledgement, not interpretation quality or clinical changes.
Existing full model-mocked journeys retain source-to-PDF regression coverage.

The initial unit invocation omitted PYPDF_PYTHON: 25 PDF checks failed because the
system Python lacked pypdf. No dependency was installed; selecting the existing
reader corrects the check environment. Final results are recorded in the PR.

Final local verification passes: typecheck, fresh production build, all 283 unit
tests across 38 files, and all 21 mock Chromium journeys (1.4 minutes). The first
browser run passed the existing 19 journeys but exposed ambiguous new alert
selectors; scoping those to the application main fixed them. The two focused
checks and then the complete suite passed. No runtime workaround was added.

## Remaining work

Reporter case drafts, direct field edits and every clinical completion task still
have component-local state. They need typed capture keyed by stable identities,
with prerequisite invalidation and conditional acknowledgement, before complete
save/resume can be claimed. This slice does not persist or hydrate them, alter
accepted facts, replay requests, erase incompatible records, implement reporter
reuse, change access/deployment settings or connect the #129 adapter to the UI.

## CI remediation

The first PR CI passed typecheck, unit tests and build, but the existing usability
journey did not observe opening-error feedback within its assertion window. Its
unfinished scenario then left the ordered model fixture queue misaligned, causing
the next journey to fail. Both new text-draft journeys passed in that run.

The usability helper previously released a promise and immediately asserted UI
feedback, without observing whether the held HTTP response had arrived. Busy UI
is set before the request and diagnostics are awaited along that path (#118).
The helper now explicitly awaits the matching response and verifies its 422/200
status before the existing feedback assertions. No assertion, feedback timeout,
retry, application behavior or mock response was relaxed. The isolated usability
scenario passes with this synchronization. This does not establish that telemetry
latency is fixed; #118 remains a separate known limitation.

After the synchronization change, typecheck and all 21 full mock Chromium
journeys passed again (1.4 minutes). Production source and the fresh build are
unchanged from the reviewed commit; unit coverage remains 283 passing tests.
