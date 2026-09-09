# Review dispositions for `b2f336e`

The standard fresh-context Claude Sonnet/high review found one blocker and two
follow-ups. Commit `242441e2e988612abc688f6e02080951398c5039` contains the
bounded remediation and the verbatim review record.

## BLOCKING 1 — preview route could make unauthorized live calls

Resolved. The browser route no longer imports or selects the Anthropic adapter
from `VERCEL_ENV`; its default remains the deterministic fixed experiment
adapter. The production Anthropic boundary remains available to the explicitly
controlled operator runner for a separately authorized live gate. An
architecture test now prevents browser-route live-model wiring from returning
without an explicit later change.

## FOLLOW-UP 1 — unreachable duplicate-product allocation check

Resolved proportionately. The unreachable condition was removed and the
opening-versus-later-input invariant that makes cross-turn allocation impossible
was documented beside the remaining duplicate check.

## FOLLOW-UP 2 — shared evidence through the fixed fixture

Resolved proportionately. The fixed journey regression now asserts that two
product facts citing the same regimen clause retain the correct evidence through
the assembled understanding view.

## Closure evidence

- `npx vitest run tests/architecture/source-boundary.test.ts tests/domain/model-boundary.test.ts tests/server/journey-service.test.ts tests/server/browser-state.test.ts tests/server/runtime-diagnostics.test.ts` — 43 passed.
- `npm run typecheck` — passed.
- `git diff --check` — passed.
- No application-model call was made.

This remediation removes an unauthorized integration path, documents an
existing invariant, and adds one narrow regression assertion. It introduces no
new product, semantic, architectural, privacy, scope, or evidence premise, so
the originating review covers it under `docs/DELIVERY.md`'s proportional-closure
rule; no recursive model run is required.
