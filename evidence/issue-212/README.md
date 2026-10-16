# Native Section F concomitant rows — issue212

Official FDA F1 instructions include devices alongside other concomitant medical
products used at the time of the event, excluding treatment of the event:
https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500
Checked2026-10-16. Pinned09/2025 native form SHA256:
1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c.

All ten native F row mappings/readbacks are distinct, including the original
Cell4 end-date controls in rows3–10. Concomitant devices now project to F without
becoming suspects. Stable retained identity/order, exact supplied therapy dates
and indexed source trace remain. Implant/explant dates never become therapy
dates. Event treatment remains separate. The application retains at most three
products; ten-row PDF evidence is adapter coverage, not a claim that the app now
retains ten concomitants. Broader retained capacity and >10 row continuation are
separate release work.

Exact known field qualifiers are carried in a labelled Section F continuation,
not mixed into B5. Fitting names/dates occupy native cells. Long/multiline names
use an explicit row pointer and full exact supplemental wording, never truncation
or smaller type. Native geometry comes from independent pinned-widget metadata.
The existing lossless wrapping primitive uses10pt/14pt leading; every supplement
page repeats its starting row/field and report reference. Unknown/conflicted/
pending/superseded facts never substitute for current output. The adapter
readback reports actual native pointer text, not the original semantic name
pretending to have been read from that widget. Independent readback/render checks
the supplemental output. Unsupported glyphs retain facts and block fresh output
at the exact field; portable fonts remain issue154.

Native D/E/F assembly now saves only after all headings and copies are complete.
An independent mixed render exposed a cached page6 content stream dropping E
headings after an intermediate save once F had drawn its note. Removing that
intermediate serialization preserves all headings through the supported
in-memory document/copy workflow; no generated-PDF reload, encryption mutation or
other bypass. The mixed test checks the main heading in actual pypdf page text.

904 unit tests/88 files, typecheck/build and all144 full mock browser journeys
pass on the final writer, including the three dedicated F journeys. Earlier
local runs were explicitly interrupted after renders exposed required fixes,
not counted as final passes. All browser PDFs/state are refreshed from the final
run. Eight retained8/9/11/17-page variants have independent pypdf readbacks.
Fifteen PDFKit2x captures were visually inspected: corrected6/9, overflow6/9,
withdrawn6/9, unknown6, repaired6, ten-row6, dense9/10/11 and mixed6/9/15. Native
cells and pointers are readable/unclipped; exact context/row identity and report
references agree. All ten native end dates are visible. Dense last-page line100
and repeated row/field headers are readable. Mixed main E/F references coexist,
and the extra E copy's F fields/context remain blank. Unknown start date and its
prior context disappear only from the appropriate output; the other row remains.
Withdrawal reallocates Gamma and its exact context to native F row1.

No persistence version/shape or prompt/schema change. Existing product cards and
editors remain, with truthful concomitant-device labels and empty therapy-date
editors. No clinical inference or broad completeness machinery. Zero application-
model calls. Actual Opus full/recheck, exact-headCI, protected hosted checkpoint,
guarded merge/delete/tree/mainCI/clean gates remain required. Preserve the one
existing share grant/protection/original expiry. The concrete remaining practical
cut is in docs/REMAINING-PRACTICAL-CUT.md; no broader completeness claim.
