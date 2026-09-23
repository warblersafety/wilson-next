# Focused Draft 4 usability revision — issue 106

Authority and exact scope are on #106. The September 22 user instruction selects
the local follow-up walkthrough's wording, action hierarchy, panel titles,
unexplained review dependencies, desktop density, operation/PDF feedback, and
temporary demo reporter button. Three active hours is a reporting checkpoint,
not permission to expand the slice. Work began September 23 at 01:02 UTC.

## Visual baseline and boundaries

The preserved approved `docs/ui-mockups/Wilson-Draft-4.tar.gz` (SHA-256
`0d2b08ad6c8401e2d46694ea03f97a039f73ff9d391c9c97e3d8fe0b59806058`)
was extracted outside the repository and inspected in Chromium. The revision
retains its typography, yellow demo/addition panels, teal primary actions,
bordered cards, privacy panel and four-screen navigation. It uses the existing
1140px wide treatment for denser desktop work, compact fact rows and adjacent
reporter panels, with a single-column mobile fallback. It does not import the
mockup's scripted interpretation, combined confirmation or narrative behavior.

The originating walkthrough records symptoms duplicated as a product problem,
an invalid model group spanning event and product facts, and previous failure
to identify a test during conversational correction. These remain unresolved
interpretation findings. No provider call is required for this UI-only change.
#99's richer progress design remains deferred; the user explicitly authorized
basic activity and truthful operation-level status for this revision.

## Delivered behavior

- Case-description language replaces visible “account” wording. The outcomes
  disclosure reveals only individual outcomes, without unrelated empty fields.
- Navigation explains that it does not accept proposals. New test cards explain
  the prior-update dependency and provide a keyboard-focusable route to that
  review. Existing group decisions and stage rules are unchanged.
- Reporter panels have accessible group names with headings inside their borders.
  While saving is gated, the primary action returns to clinical review; saving
  and refusal become available under the same gate as before. Redundant output
  navigation is removed from the reporter footer; the stepper remains available.
- “Use demo reporter details” fills only first/last name, email, occupation and
  health-professional draft values. It never saves, accepts, or changes privacy,
  prior-reporting choices, report date, phone or address.
- Activity is announced beside description/update work and scrolled into view
  without moving keyboard focus. The PDF toolbar announces preparation, updating,
  ready or failure; earlier bytes retain their earlier label and cannot be saved
  as a current PDF. Reduced-motion CSS stops spinner animation. No percentages,
  invented stages, elapsed-time estimates or partial model content are introduced.

## Verification

The new browser journey uses predetermined synthetic model responses through the
existing test-only injection, with real case actions and PDF generation. Controlled
requests are held until explicitly released or failed once; no progress is inferred
from the delay. It covers opening/update failure retention and explicit retry,
autofill without acceptance, retained privacy/prior-reporting choices, pending
review gates, dependency focus, separate outcomes disclosure, reduced motion,
earlier/current PDF states and PDF failure recovery.

Independent pypdf readback compares every field across three real downloads:
demo reporter values are present; a direct correction changes only the second
hemoglobin result (9.4 to 9.6 g/dL); a reporter correction then changes only email.
The first result and both dates/ranges remain intact. This establishes UI/direct
correction behavior, not interpretation reliability.

Typecheck, production build, 202 deterministic tests and all eight browser
journeys pass (full browser suite: 1.2 minutes). Retained screenshots show opening
processing, reporter navigation while pending, test dependency guidance, PDF
updating, and compact mobile review. Desktop/mobile screenshots were inspected
against the preserved Draft 4 mockup. No document overflow at 1440 or 390 pixels;
existing regression checks also cover 1280 pixels.

Verification found and repaired a status appearing below the viewport after a
click: the local status now scrolls just enough into view without taking focus.
The initial unit-test invocation omitted the existing PYPDF_PYTHON setting; using
the existing interpreter passed without dependency changes. The first full browser
run stopped at an old reporter-copy expectation and desynchronized the global
fixture queue for later tests. Updating that expectation and rerunning the complete
suite passed. These were verification/setup failures, not live model results.

Protected deployed verification is recorded below after the post-PR candidate. The PR owns the actual independent review and merge
disposition. Existing local documents, walkthroughs and mockup archives are not
staged with this evidence; private backup hashes preserve their initial contents.
