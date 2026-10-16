# A3 supplied sex continuation — issue151

Fictional data only. The existing explicitly reviewed intersex value now prints
in a numbered Section A/block A3 supplement, with both native Male/Female boxes
unselected. An8.5pt pointer is on the A3 heading line, away from the value labels;
a matching labelled8.5pt report reference is in the blank page-1 area below B.
The supplement uses fixed10pt/14pt leading and repeats A3/value/report identity
on every page. Current known sex qualifiers travel verbatim; male/female retain
the existing native base mapping. No new clinical vocabulary, demographic
classification, sex-at-birth inference or inferred checkbox is introduced.

[FDA instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
request sex at birth in A3 and allow numbered section/block-labelled narrative
continuation at no less than8pt. Pinned September2025 form SHA256:
`1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`.
The existing fact remains `sex`; the intersex supplement explicitly preserves
the supplied value without inferring its birth basis. Unknown/declined/absent/
inapplicable/unanswered values remain distinct and do not print a former value
or note. Current unsupported qualifier glyphs block on the exact sex target;
portable fonts and arbitrary new sex/gender vocabularies are outside this slice.

Retained actual PDFs and independent pypdf readbacks cover before/after explicit
correction, reviewed conversational proposal and qualifier, saved resume,
unknown after a qualified value, native female with context,110-line dense A3,
and A3 alongside native E copies. PDFKit captures affected native/continuation/
copy pages. Initial visual inspection confirms readable, unclipped A3 pointer
and reference, no false checkbox, fixed-size dense pages and blank A3 on the
E-only copy. Sources/history are unchanged by projection/export; readback does
not pretend an unchecked native box contains intersex.

931 unit tests/90 files, typecheck/build and four focused browser journeys pass.
Full149 mocked browser journeys, actual Opus review/recheck and exact-headCI are
pending at this checkpoint. No live application-model calls or new dependency.

Actual Opus full review found no blocking findings. F1 is fixed: the inclusion
notice requires a current generated PDF, and a browser glyph-context regression
asserts it is absent beside an unready/older artifact. F3 is fixed: the pointer
is on the A3 heading line and the full labelled report reference is below B,
clear of Male/Female labels. Current PDFs/readbacks/renders are regenerated and
visually checked. F2 is the existing birth-basis guidance premise, separately
tracked as #217 without relabelling facts in this slice. Review fixes pass931
units, typecheck/build and four focused browser journeys. The earlier full149
run passed; the repeat full149 run and same-session recheck are pending.
