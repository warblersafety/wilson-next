# Issue #85 dictation-help evidence

This evidence reflects Steve’s approved feedback revision in the same issue
and PR #86: the help toggle is below the textarea and visible correction
reminder, immediately beside its panel. Context explains native dictation
before separate, initially collapsed Mac and Windows instructions. Steps name
Clinical account or Clinical update explicitly. The approved copy belongs to
issue #85; the Product clarification still describes the two review gates.

The shared narrative input uses local outer disclosure state and native
`details`/`summary` platform sections. No audio capture, permission request,
dictation detection, automatic submission, case/model/PDF change, dependency,
or persistent preference was introduced.

## Verification

On macOS with Node 24.20.0:

- `npm run typecheck` passed.
- `npm test` passed: 21 files, 152 tests (pypdf 6.16.2).
- `npm run build` passed.
- `npm run test:e2e` passed: existing assembled deterministic journeys and
  independent PDF assertions, 22.3 seconds. No live application-model calls.
- Focused Chromium 153.0.8010.12 and Playwright Firefox 155.0 checks exercise
  outer, Mac, and Windows toggles by pointer, Enter, and Space. They verify
  initially collapsed state, independent platform sections, focus, retained
  textarea identity/text/selection, editing while open, and no case or
  microphone requests during help use. Closing/reopening outer help retains
  the selected platform, without a persistent preference. Existing explicit
  opening/update actions still reach proposal review through the repeated-
  product deterministic scenario. Results are in `browser-checks.json`.
- Chromium’s native accessibility tree exposes each platform disclosure’s
  expanded state. Firefox keyboard behavior and native `details.open` state
  are checked; no Firefox assistive-technology certification is claimed.
- At 1280×800, 1440×900, and 480px width, geometry checks verify the toggle is
  below the textarea and the panel begins within 6px of its toggle. Controls
  have a 44px minimum height (0.01px geometry tolerance for Firefox rounding),
  no document overflow occurs, and submit actions remain reachable by normal
  scrolling. Code inspection confirms visible focus styles and decorative SVGs
  hidden from assistive technology.

Screenshots for both fields and desktop sizes cover `collapsed` outer help,
`platforms-closed` (context and both platform choices), `expanded` (Mac only),
and `windows` (Windows only). `full` captures give whole-page context with Mac
open. These replace the initial implementation screenshots; Git history retains
that version. Implementer visual inspection confirms adjacent toggle/panel,
readable context and platform-specific steps, neutral microphone icons, and
reachable submit actions without overlap.

The temporary focused harness uses the existing repeated-product fixture pair
once per browser. Native expansion is inspected through Chromium’s actual
accessibility tree because Playwright’s simplified ARIA snapshot omits the
native disclosure role. No permanent copy/markup test suite was added.

## Limits and delivery

Native Mac/Windows dictation remains untested. Automated Firefox-on-Mac checks
establish layout, toggling, and editing, not the system dictation service or
medical accuracy. A fictional dictation check on the intended demo machine
remains manual. No real clinical data or live-model benchmark was used.

The initial implementation’s 390px check exposed roughly 10px of existing
header overflow; the help stayed bounded. This unchanged header remains outside
the desktop-first slice; 480px wrapping passes. No mobile redesign is claimed.

PR #86 owns the independent review and deployment record. The first handoff’s
original-link preservation incident remains unresolved. This revision does not
create, revoke, replace, or redirect a share grant or change retention/protection
settings. The existing shared exact-deployment URL serves the earlier commit;
a later branch push produces a separate Vercel-authenticated Git preview.
Share bearer secrets and administrator credentials are not evidence artifacts.
