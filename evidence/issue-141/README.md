# Issue141 — reusable fictional reporter details

Baseline main `2b3074d7a531799e44ec7414bfdd1a3ae8b77e6c` (PR140),
14 October 2026. This slice replaces the demo-populate shortcut with separately
remembered editable fictional defaults in the existing Reporter form.
Architecture owns the profile's separate storage/lifecycle and recovery limits.

## Implementer verification

Exact Node **24.20.0**, existing locked dependencies and existing independent PDF
reader/Chromium, no installs or live application-model calls:

- TypeScript `tsc --noEmit`: **PASS**.
- Full Vitest: **336 tests, 44 files PASS**.
- Fresh Next build: **PASS**.
- Full deterministic Playwright Chromium suite: **60 journeys PASS**, 1.7 minutes.
- All original 48 browser journeys/assertions/timeouts retained. Two old paths
  now enter their fictional reporter values explicitly because the demo shortcut
  is intentionally replaced; their clinical and output assertions are unchanged.
- `git diff --check`: **PASS**. Desktop1440/mobile390 screenshots inspected;
  existing layout and controls remain, with wrapping reuse controls.

Twelve new native-browser scenarios prove:

1. Actual persistent Chromium process closure (connection becomes false), restart
   of the same temporary profile/origin, retained current draft/accepted facts
   and remembered defaults, then reuse in a genuinely fresh case. Explicit false
   health-professional and country/identity values remain editable. Date, prior
   destinations and disclosure do not carry over. Explicit remembered updates
   do not alter accepted facts; cancel/confirm Forget preserves current work.
2. Restored accepted and unfinished reporter drafts are not automatically seeded.
   Explicit Use is confirmed before replacing entered identity, changes the draft
   only and never accepts facts.
3. Future and corrupt profile records stay byte-equivalent through normal manual
   reporter acceptance; no destructive overwrite/recovery is offered.
4–5. Synthetic quota and real native-transaction abort failures preserve the exact requested profile snapshot for
   explicit retry and current reporter typing separately. No case action repeats.
6. Real native concurrent writers: one succeeds, one rejects; Forget gets a new
   generation/tombstone and stale writers cannot resurrect the forgotten record.
   Corrupt/future records refuse native writes and stay unchanged.
7. A held actual profile load arriving after fresh-case reporter typing does not
   overwrite the dirty draft or accept those words as case facts.
8. A changed generation surfaces stale-writer recovery; explicit reload requires
   confirmation before discarding a failed profile change, preserves current
   reporter edits and accepts no case facts.
9. A waiting tab acquires editing ownership after the owner updates defaults;
   its next genuinely fresh case uses the current defaults rather than its cache.
10. A non-conflict failed profile change can be abandoned through confirmed
   Reload; cancel retains the intent, confirmation clears only that intent,
   current draft and stored defaults remain unchanged, and editing is re-enabled.
11. A native stored `undefined` is distinguished from a missing key. Load, Save
   and Forget all reject corruption without replacing the one retained value.
12. Case-only reload cannot silently advance a failed profile intent's original
   comparison generation. A concurrent profile change stays protected and the
   eventual Retry correctly reports stale-writer rather than overwriting it.

Unit tests enforce strict profile/envelope boundaries, raw text and false,
empty/tombstone records, malformed/future retention, excluded case-specific fields,
unsupported form choices, invalid writes and unavailable storage. Test-only
Vite/React probe exposes the actual adapter; no production route/flag/global is
added. Temporary synthetic profiles are removed after their tests.

## Development corrections and limitations

The first unit command omitted the existing PDF-reader environment and had
25 missing-pypdf failures. Selecting the already installed reader produced the
full passing suite; nothing was installed. New browser fixtures initially read
old reporter facts before acknowledgement, assumed the save button remained
visible despite existing navigation to Review & save, and attempted to mutate a
frozen response. They now wait for the actual acknowledgement and navigation,
and copy the fixture. Product behavior, assertions and timeout limits were not
changed to accommodate these setup errors. Focused twelve and full60 pass.

These are deterministic fictional cases, not interpretation accuracy, live-model
reliability, real-data privacy readiness or external-clinician acceptance. Native
commit uses browser-default durability, without OS/power-loss disk-flush promise,
off-device backup, case list, cross-origin or cross-device continuity. Clearing
site/profile data, eviction and private browsing can lose these defaults.
Unsupported future/corrupt profile storage stays retained; manual case entry
continues. Failed profile retry saves its explicit requested snapshot, not later
case-field typing; edit the form and Update again after that intent is resolved or explicitly
abandoned by confirmed Reload.

## Independent review remediation

Actual standard subscription review `issue141-20261014T221052-b17db7f9` at
`6c1028e27a0608e90402f080babe20c920a14102`, canonical `claude-opus-5-5`,
high, CLI2.1.296, preflight passed: no blocking findings, four follow-ups.
Complete attributed findings/limits and dispositions are recorded on PR142.
Static only: the reviewer executed nothing and supplied pass counts were not
independently verified. It did not read the middle of Journey, other e2e specs,
historical assessment or server/view code; no Safari/Firefox evidence.

- F1: confirmed Reload is offered for every failed profile intent, not only
  generation/version conflicts. It abandons the pending change without altering
  current case work or remembered storage. Native cancel/confirm coverage.
- F2: non-domain storage exceptions become a plain storage-failure message;
  the hook displays only typed domain messages or a plain fallback. Native quota
  and transaction-abort checks require user-facing wording without raw text.
- F3: native `getAll` distinguishes no key from a stored `undefined`. Native
  load/save/forget preserve the corrupted value and reject it; unit boundary
  also rejects undefined.
- F4: Architecture explicitly identifies reporter persistence as delivered by
  this separate slice, with protected-deployment verification still pending.
- Implementer-discovered defect: the unchanged final-value handoff assertion
  failed with old Casey instead of the newer default at the first commit.
  Profile loading/readiness now follows acquired workspace ownership. A pending
  failed intent keeps its original generation across case-only reload; the new
  native regression protects that boundary as well. No lease force/takeover,
  accepted-case change, assertion weakening or timeout change was introduced.

After all remediation: focused12 and full60 browser journeys, full336 unit tests
across44files, typecheck and fresh build PASS. First-head CI38645791953 passed;
it is not evidence for the remediation head. Same-session targeted recheck and
fresh exact-head CI remain gates before merge.

No dependencies/services, lockfile, auth/access/protection, deployment settings,
clinical commands or PDF mappings changed. Independent review, exact-head CI,
squash merge and merged-main verification remain delivery gates. The protected
stable-origin preview and matching deployed release provenance remain milestone
gates; this document does not claim they have passed.

## Delivery closure

The preceding gates describe the pre-merge material checkpoint. They subsequently
passed: the actual same-session Opus high targeted recheck at
`5943e609f9515e4684e66d71df9cd18fd20e2f75` found no blockers, new material
regressions or remaining findings. It confirmed F1–F4 and the ownership fix;
static only, no independent test execution or Safari/Firefox evidence. See the
[complete recheck record](https://github.com/warblersafety/wilson-next/pull/142#issuecomment-6179846585).

[Exact-source CI38647130355](https://github.com/warblersafety/wilson-next/actions/runs/38647130355)
and [merged-main CI38647742799](https://github.com/warblersafety/wilson-next/actions/runs/38647742799)
passed. PR142 squash merged at `dc7cd047028cb95984a81b5552fe6ab014b74a11`;
the whole final topic tree equaled main and both topic branches were deleted.
[Delivery closure](https://github.com/warblersafety/wilson-next/pull/142#issuecomment-6179987711)
is the canonical final record. Protected stable-origin/provenance and operator
checks remain pending under issue143; this closure does not claim those passed.
