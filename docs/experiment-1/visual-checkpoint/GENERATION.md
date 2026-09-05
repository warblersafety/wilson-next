# Visual checkpoint generation record

The four raster mockups were generated with the built-in image-generation tool
on 2026-09-04 and then resized proportionally to the experiment's 1440 x 900
viewport. They are design hypotheses, not screenshots of working software.
Superseded first renders containing factual or interaction errors were not
retained; the four images beside this file are the review set.

## Shared prompt direction

All four prompts requested a production-realistic clinician-facing desktop web
interface with:

- a restrained warm-white/cream, deep-navy, teal, and gold palette;
- a slim header and four-stage `Describe · Check · Clarify · Output` indicator;
- practical typography, spacing, and information density;
- no Form 3500 section rail, app-owned microphone, chat bubbles, field counts,
  medical advice, submission claims, dark mode, or watermark; and
- the fixed synthetic fixture from the experiment proposal.

## Screen-specific prompts

### 01 Describe

Create the pre-extraction `Describe` stage at 1440 x 900. Use a 65/35 workspace:
a populated natural-language case-account editor on the left and an empty `Case
so far` orientation panel on the right. Include the limited experiment boundary,
an on-device dictation hint without a microphone control, and the primary action
`Find the case details`. Do not show a PDF preview.

### 02 Check understanding

Create the post-extraction `Check` stage at 1440 x 900. Show patient, event,
apixaban, naproxen, and lisinopril as distinct semantic cards with `Change`,
`Remove`, and compact `From your account · View source` controls. Do not put a
confirmation control on every card. Use one `Continue with this understanding`
action and preview the single indication question in a `Needs attention` panel.

### 03 Correct and resolve

Create the `Clarify` stage at 1440 x 900. Show naproxen changing from `500 mg
twice daily` to `250 mg twice daily`, with the correction excerpt expanded. Show
an unresolved apixaban conflict between `12-Aug-2026` from the original account
and `13-Aug-2026` from the medication administration record. Present explicit
actions to use either date or leave it unresolved. Keep the corrected value
primary and old value traceable. A targeted edit corrected the source excerpts
to `I recorded the start as 12-Aug-2026.` and `The medication administration
record lists apixaban starting 13-Aug-2026.`
A second targeted simplification removed redundant radio controls from the
evidence cards and disabled continuation until the clinician chooses one of the
three explicit conflict outcomes.

### 04 Inspect output

Create the `Output` stage at 1440 x 900. Use a 56/44 layout: semantic sections
for `Included`, `Needs resolution`, and `Not included in this experiment` on the
left, and a supported-sections-only Form FDA 3500 facsimile on the right. Make
the unresolved apixaban start-date cell visibly blank, show naproxen as 250 mg,
and state that downloading does not submit the report. A targeted edit aligned
the facsimile with the fixture: event 18-Aug-2026, recovery 21-Aug-2026,
apixaban stop 18-Aug-2026 with VTE-prophylaxis indication, naproxen start
10-Aug-2026 and stop 18-Aug-2026 with postoperative-pain indication, and
lisinopril only as a concomitant product in Section F.
A second targeted edit disabled PDF download in the pictured pre-resolution
state and labeled the required next step `Resolve date before download`.
