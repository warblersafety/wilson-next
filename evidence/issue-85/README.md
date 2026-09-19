# Issue #85 dictation-help evidence

The shared narrative input uses only local disclosure state and the existing
controlled textarea. Exact approved interaction/copy belongs to issue #85.
No audio capture, permission request, dictation detection, automatic submission,
case/model change, or PDF change was introduced.

## Verification

On macOS with Node 24.20.0:

- `npm run typecheck` passed.
- `npm test` passed: 21 files, 152 tests (pypdf 6.16.2).
- `npm run build` passed.
- `npm run test:e2e` passed: the existing assembled deterministic journeys and
  independent PDF assertions, 22.2 seconds. No live application-model calls.
- Focused browser checks passed in Chromium 153.0.8010.12 and Playwright Firefox
  155.0 on this Mac. `browser-checks.json` records the checks and browser versions.
  Both opening and update controls were exercised through pointer, Enter, and
  Space toggles; exposed expanded state; retained textarea DOM identity, draft
  text, and selection; retained button focus on toggle; allowed keyboard edits
  while open; and made zero case requests or microphone requests during help
  use. The existing explicit submissions reached their proposal-review stages
  using the existing repeated-product deterministic scenario.
- Desktop geometry and trial-click checks passed at 1280×800 and 1440×900,
  with a 480px narrow-width wrapping check. No document overflow at those sizes.
  Both help targets are at least 44px high, and submit controls remain reachable
  by ordinary scrolling. Code inspection confirms visible keyboard focus styles,
  decorative SVGs hidden from assistive technology, and no audio API dependency.

Retained screenshots show collapsed/expanded opening and update help at both
desktop sizes, with full-page expanded captures for context. Implementer visual
inspection confirmed readable copy, neutral microphone icons, wrapped help,
and no overlap at those desktop sizes. Expanded viewport screenshots scroll to
show the instructions and submit action; full-page images also show the field
label and disclosure control above them.

The focused harness initially used the full ordered fixture queue with a single
selected scenario; that mismatch was corrected to the repeated-product pair
before collecting passing evidence. This was a temporary harness correction,
not a product or test-contract change. The harness is deliberately not a new
permanent copy/markup test suite.

## Limits

Native Mac/Windows dictation was not exercised. Automated Firefox-on-Mac checks
establish layout, toggling, and editing, not the system dictation service or its
medical accuracy. A fictional dictation check on the intended demo machine
remains manual. No real clinical data or live-model benchmark was used.

A preliminary 390px check exposed roughly 10px of existing header overflow;
the new field/help remained bounded. This unchanged header layout is outside
the requested desktop-first help slice; 480px wrapping passed. No broad mobile
redesign or accessibility certification is claimed.

The PR owns the independent review and deployment/access/retention record.
Share bearer secrets and administrator credentials are not evidence artifacts.
