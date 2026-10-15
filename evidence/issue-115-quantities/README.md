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

FullB5 preflight always applies, including unqualified cases: existing Helvetica
character support,4000characters,531.102x520.574native rectangle,1ptpadding,
8.5pt and whitespace wrapping. Base text is independently measured for correct
attribution to contributing event/stopped-product facts. Added quantity failures
point to quantity facts only when base text fits. Removing the qualifier cannot
disable fidelity checking. Long unbreakable text/vertical overflow and unsupported
glyphs remain retained with explicit readiness failure. Snapshot and adapter
share checks; the adapter rejects direct projections missing fullnotes. Quantity
notes alone cannot satisfy the old base event gate. Other PDF fields remain154.
Qualified native amount controls now include (see B5); if the full pointer and
literal text cannot fit, the native text is See B5 with blankunit. Native unit
export is retained for supported simple values that fit with the pointer.

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

Actual Opus5-5high review at164376b identified B1: the previous quantity-only
guard activation misattributed base B5 failures and qualifier removal bypassed
it. F1: native fields lacked a qualification pointer. Actual full report is on
PR156comment6188484129. Both are remediated as above. The actual targeted same-session
recheck and exact-headCI results are recorded in canonical PR156 before merge.

Remediation local verification:401unit tests/52files PASS, typecheck and fresh
production build PASS. Two focused browser journeys PASS3.0seconds, including
the exact base rash≥5cm/removal recurrence, no accidental PDF/model requests,
accepted wording retained, correct metadata, and qualifier-correction/reload.
New API cases cover glyph/4000char/vertical failures with and without qualifiers,
preview and download409s, adapter defense and event-only attribution.
Full73mockbrowser suite PASS2.1minutes after remediation. Exact-headCI and
actual independent-review disposition are recorded in PR156.

Retained [synthetic PDF](qualified.pdf), [independent readback](readback.json),
[B5/strength appearance check](appearance-check.json), [B5 render](route-page-2.png),
and [native strength render](route-page-4.png) show5mg(seeB5) with nativeMG and
exact confirmed-label context inB5. PDFKit2x renders visually inspected; actual
AP ASCII operands independently checked for bothfields. This proves thisfixture,
not a general portable-glyph/font expansion.

The earlier own-generated assessment report was losslessly archived outside the
checkout with verified SHA and explicit archive record under task direction;
review now runs against a clean tree without hiding implementation or changing
the fixed reviewer. Existing repository reports are unchanged. No provider/model/
schema/storage/dependency or previewgrant/auth/application-model-call changes.
115staysOPEN for remaining context/chronology;150paused;151/153/154remainOPEN.
