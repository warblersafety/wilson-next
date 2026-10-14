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
- Full deterministic Playwright Chromium suite: **55 journeys PASS**, 1.6 minutes.
- All original 48 browser journeys/assertions/timeouts retained. Two old paths
  now enter their fictional reporter values explicitly because the demo shortcut
  is intentionally replaced; their clinical and output assertions are unchanged.
- `git diff --check`: **PASS**. Desktop1440/mobile390 screenshots inspected;
  existing layout and controls remain, with wrapping reuse controls.

Seven new native-browser scenarios prove:

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
4. Synthetic quota failure preserves the exact requested profile snapshot for
   explicit retry and current reporter typing separately. No case action repeats.
5. Real native concurrent writers: one succeeds, one rejects; Forget gets a new
   generation/tombstone and stale writers cannot resurrect the forgotten record.
   Corrupt/future records refuse native writes and stay unchanged.
6. A held actual profile load arriving after fresh-case reporter typing does not
   overwrite the dirty draft or accept those words as case facts.
7. A changed generation surfaces stale-writer recovery; explicit reload requires
   confirmation before discarding a failed profile change, preserves current
   reporter edits and accepts no case facts.

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
changed to accommodate these setup errors. Focused seven and full55 pass.

These are deterministic fictional cases, not interpretation accuracy, live-model
reliability, real-data privacy readiness or external-clinician acceptance. Native
commit uses browser-default durability, without OS/power-loss disk-flush promise,
off-device backup, case list, cross-origin or cross-device continuity. Clearing
site/profile data, eviction and private browsing can lose these defaults.
Unsupported future/corrupt profile storage stays retained; manual case entry
continues. Failed profile retry saves its explicit requested snapshot, not later
case-field typing; edit the form and Update again after that intent is resolved.

No dependencies/services, lockfile, auth/access/protection, deployment settings,
clinical commands or PDF mappings changed. Independent review, exact-head CI,
squash merge and merged-main verification remain delivery gates. The protected
stable-origin preview and matching deployed release provenance remain milestone
gates; this document does not claim they have passed.
