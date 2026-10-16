# International reporter details — issue 214

Fictional data only. Country entry accepts the native G1 country list and exact
other wording; no address-based country inference. Multiline/overlong G1 text and
known qualifiers appear in a labelled, fixed 10-point continuation, with native
`Continued` markers and a report-reference link. Native postal maximum is ten
characters. Case facts retain raw wording; native country display equivalence is
case/outer-space only. Unsupported glyphs remain retained and block export with
an exact field target (#154 remains open).

Official semantics: [FDA Form 3500 instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500),
G1 and general continuation instructions. Pinned September 2025 form SHA256:
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.
Independent pypdf inspection verifies all native country options, text geometry,
font and postal maximum against the source form.

The v2 reusable profile retains exact international strings. Genuine v1 records
remain readable without rewriting their generation or record until explicit
save/forget. Corrupt/future records remain protected. Remembering defaults does
not accept case facts, dates, destinations or disclosure choices. Saving an
unchanged base reporter value preserves its existing qualifier; explicit changes
retain old values/context in history rather than transferring qualifiers.

Retained PDFs/readbacks and macOS PDFKit renders cover native Japan, qualified
multiline address/long postal/unmatched country, before-unknown context and G1
alongside native E copies. Page 7 and continuation page 9 were visually inspected
for readable full labels/text, shared report reference and unclipped markers.
The mixed E copy also retains its device on page 15.

Local verification: 919 unit tests across 89 files, typecheck and production
build pass. All 147 mocked-browser journeys pass, including three new reporter paths.
Actual Opus review and exact-head CI remain pending at this checkpoint. No application-model calls were made. Current glyph and
native occupation exceptions remain bounded follow-up scope.
