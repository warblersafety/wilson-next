# Issue #129 — browser-local persistence foundation

This is a native adapter and architecture amendment, not delivered end-user
save/resume. No application UI imports it. Existing sessionStorage behavior,
visual design, conversational flow, clinical authority and PDF output are unchanged.
No account, service, dependency or deployment/access setting was added.

## Verified contract

One IndexedDB record atomically contains the full server-returned state and a
separately versioned JSON draft container. Stored clinical state remains opaque
and untrusted until a later integration extends the server restore boundary: retain
persisted-version migrations, re-derive the stage instead of rejecting policy
changes as stale, and preserve incompatible inner state (including rollback).
The draft container is JSON-typed storage, not a completed field-specific UI
hydration schema.

Every write compares an expected opaque generation and gets a fresh UUID.
Replacement is explicit; clear keeps a tombstone. Native transactions reject
stale writers and abort failed writes without replacing the previous record.
Fresh generations also prevent an old writer from matching newly saved work
after database recreation. This prevents overwrite; it does not recover data
that site-data clearing already deleted.

Malformed/future envelopes, newer database versions and unavailable/failed
storage fail explicitly. There is no automatic erase/reset of corrupt records.
JSON validation rejects unsupported values rather than coercing them. Input is
snapshotted before asynchronous work, so later caller mutation cannot alter it.

## Checks

Explicit Node 24.20.0; existing dependencies; no live application-model calls:

- Typecheck and fresh build pass.
- All 268 unit tests across 37 files pass, including 23 envelope/API cases.
- All 19 synthetic/mock Chromium journeys pass (1.4 minutes).
- Three new native IndexedDB journeys exercise actual browser storage using the
  adapter source transpiled by the already-installed TypeScript compiler. No
  production test route, fake IndexedDB library or new bundler is introduced.
- A server-valid synthetic case with simultaneous pending proposals and a
  conflict, source/history records and representative unfinished JSON drafts
  survives page/store closure and reopen unchanged. Two pages racing from the
  same generation produce one successful commit and one stale-writer error.
- Explicit replacement refusal, replacement, clear tombstone, post-clear stale
  writes and database recreation are checked. Injected quota failure and native
  transaction abort both preserve the previous committed record.
- Malformed values (including an actually stored undefined value), future
  envelope versions and newer native database versions remain intact after
  rejected load/replace attempts.

## Still required before claiming save/resume

Full typed case/UI-draft capture and restoration, actual browser-process restart
and UI error/multitab acceptance, truthful saved/unsaved status, serialization of
same-tab saves, and explicit confirmed replacement/recovery. Existing server
validation must remain authoritative; no network action may be replayed on resume.
Generation checks alone do not prevent simultaneous model requests or constitute
a single-writer UI. Browser/profile/site-data loss and changed origins remain
limitations; a stable protected origin is required for continuity across releases.
Separate reusable fictional reporter details and their lifecycle are not implemented.

## Review disposition

The initial actual Opus high review found one documentation blocker (B1): the
existing preview restore validator is not sufficient for durable saved cases.
Architecture now requires retained persisted-version migrations, current-stage
re-derivation, release/version provenance and preservation of incompatible inner
state instead of the preview discard path. These remain prerequisites for UI
integration; no runtime restore behavior is changed by this foundation.

F1 is addressed in the recovery contract: future confirmed corrupt-data discard,
retention of newer-version data after rollback, and explicit unsaved in-memory
continuation while recovery is blocked. No destructive recovery API is added here.
F2 is recorded as a limitation: default transaction durability does not guarantee
disk flush or survival of OS crash/power loss; future saved-status wording must
disclose this unless strict durability is implemented and verified.
