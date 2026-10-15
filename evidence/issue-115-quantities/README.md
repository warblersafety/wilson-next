# Issue115 — faithful qualified quantities (second slice)

Baseline d58dda4026daa52aed09539e8c8e8f60693f245f. Refs #115; it stays OPEN.
This increment includes qualified dose/strength context in B5 and preserves the
native literal numeric/unit split. It is not the completed general-context issue.

The initial inline qualifier experiment rejected a valid5mg strength qualified
“reported, uncertain”:76.116pt native strength control, fixed8.5pt. The selected
contract carries full raw value and exact qualifier in B5 with actual suspect
slot and Dose/Strength labels; native controls carry the literal amount/unit.
Qualified opaque text too wide for a native control uses See B5 and blankunit.
No compound arithmetic, inferred unit, qualifier abbreviation or clinical
causality/chronology assertion is introduced. Projection retains distinct raw
value/qualifier and joins current quantity source IDs into B5 sourceTrace.

[Official FDA instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
were inspected15October2026: B5 supports relevant clinical information, D1
separates labeled strength from amount used, D2 describes actual product use.
The native09/2025PDF is unchanged. Existing B5 is used, not the lab-only
AdditionalComments widget, new pages or smaller typography.

FullB5 preflight applies when quantity notes are added: existing Helvetica
character support,4000characters,531.102x520.574native rectangle,1ptpadding,
8.5pt and whitespace wrapping. Long unbreakable text/vertical overflow and
unsupported glyphs remain retained with explicit readiness failure. Snapshot
and adapter share the check; the adapter also rejects a direct projection
missing fullnotes. Quantity notes alone cannot satisfy the old base event gate.
This bounded guard does not solve portable glyph/fit support for other fields.

Verification includes independent pypdf native-field readback (not adapter-only
roundtrip), bothsuspect slots/dose/strength and FDA unitexports25/30/29/16,
compound text without totals, narrowstrength SeeB5, exactB5 context/sourceIDs,
qualifier correction/removal, history/contentkey, three unrepresentable cases,
missingbaseevent/directnotes, and pinnedwidget metadata. Browser evidence tests
accepted qualified strength/dose, reload, explicit qualifier correction and fresh
PDF generation while unexpected interpretation requests are aborted.

Runner cache boundary: the default Vite bundled-config write into
node_modules/.vite-temp was blocked by the host. A task-local harness uses the
installed supported configLoader runner and explicit task-local Vitecache/
attachments locations, with the unchanged repository test config/assertions.
No denied-path retry or permission expansion was used. Initial harness CWD and
independent-reader decoding mistakes were fixed in the harness/newtests only.

Local verification:398unit tests/52files PASS, final typecheck PASS, fresh
production build PASS. Full browser run:71existing journeys PASS, newtest failed
on an incorrect existing-control label. Corrected only that new locator; the
new journey then PASS in2.6seconds with all correction/reload/PDF assertions.
Exact-head CI and actual independent review remain required before merge.

Retained [synthetic PDF](qualified.pdf), [independent readback](readback.json),
[B5 appearance check](appearance-check.json), [B5 render](route-page-2.png), and
[native strength render](route-page-4.png) show the corrected5mg strength and
exact confirmed-label context. PDFKit2x rendering visually inspected: no clipping,
question-mark substitution or displaced form content in those values. B5 actual
AP text operands independently equal stored expected ASCII text; this supports
this fixture, not a cross-viewer portable-glyph claim.

Independent-review precondition remains unresolved while the unrelated assessment
report is preserved as an untracked file. The fixed reviewer requires a completely
clean tree. Do not hide/move that report or weaken the check to claim review. Issue150 stays
paused;151/153/154 stayOPEN. No provider/model/schema/storage/UI/dependency,
previewgrant/auth or application-model-call changes are included.
