# Issue115 — B5 clinical-course context

Baseline: eee3892f29d00ea95fc1b11bf589ae197d6b1bb9. Scope: exact accepted
Treatment, Outcome and Discharge-date qualifiers in existing B5 narrative.
Issue115 remains OPEN; this is one bounded functionality increment.

## Precise gap and selected representation

At this baseline, symptoms/problem and qualified dose/strength context reach
B5, but known treatment/outcome/discharge qualifiers are recorded only as
qualifier-not-included. Their base statements reach the artifact without the
context. The selected change uses the established parenthetical formatter on
those three existing statements and removes only their now-false partial
omissions. The final completeness sweep recognizes these carried qualifiers.
All other omissions retain their existing contract.

[Official FDA B5 instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
were inspected15October2026: clinical course, treatment and outcome belong in B5.
The supplied treatment-list order, existing labelled-statement order and date
formatting are unchanged. Presentation order is not a newly asserted clinical
timeline. Supplied uncertainty about the sequence/timing remains verbatim.
No date, causal relation, entity association or clinical conclusion is inferred.

Only current resolved known facts supply text/context. Existing source tracing,
command authority, conflict resolution, superseded history and durable case
validation are reused. Qualifier correction/removal/re-add now changes actual B5
and the report-content key for these facts. Unknown/declined/absent/inapplicable,
pending/rejected/conflicted values do not become current narrative. The full B5
glyph/fit/4000-character guard applies unchanged; unrepresentable context stays
accepted and blocks preview/download before generation.

## Verification

- 413unit tests/53files PASS with existing Node24.20.0, installed dependencies and
  pypdf. Typecheck and fresh production build PASS.
- Twelve new unit/PDF/API cases: exact three qualifiers and current source IDs;
  treatment-list/statement ordering; unchanged every non-B5 native PDF control;
  correction/remove/re-add with four distinct actual output keys; serialized
  restored case and history; four non-known states after previously qualified
  values; three fields×two unrepresentable-context cases with409s in both modes.
- Existing context tests now positively assert actual B5 inclusion and chosen
  conflict qualifier, while independently checking remaining omission-only
  fields and every unrelated PDF control stay unchanged. The all-active-known
  completeness invariant includes the three newly carried paths. Assertions
  were changed for the intended output contract, not to permit loss.
- Four focused browser journeys PASS13.0seconds: new full clinical-course PDF,
  explicit context correction/removal, durable reload and unchanged sibling
  facts/products/tests/date; existing unresolved/explicitly chosen outcome and
  current/historical source behavior; earlier omission-only metadata paths.
  Unexpected interpretation calls are aborted and asserted absent.
- Full74mockbrowser regression PASS2.1minutes. Actual independent review and
  exact-head/mainCI results are recorded in the canonical PR before delivery.
- [Synthetic PDF](course.pdf), [independent readback](readback.json),
  [projection/current source trace](projection.json), [appearance check](appearance-check.json)
  and [PDFKit2x B5 render](route-page-2.png) are retained. AP text operands are
  independently decoded and match stored wording/order, normalizing only line
  wrapping whitespace. Render visually inspected: complete context, readable
  wrapping, no clipping/substitution. This is bounded fixture evidence, not a
  general cross-viewer glyph claim.

No UI/PDF widget/layout system, model/provider/prompt/schema, storage, dependency,
font, continuation, auth/grant or shared-preview change. No live application-model
calls. Existing test runner uses the supported configLoader runner and task-local
cache; the denied default config-temp path is not retried.

## Remaining scope

B6 test identity/result/range/date context, B7 relevant-history context, ordinary
patient/product/device/reporter context and selectors/prerequisites remain outside
this slice. Stop/product context and broader chronology representation are still
separate.150 stays paused;151/153/154/157 retain their explicit native-representation,
portable-glyph/capacity and diagnostic usability scopes. Do not describe this as
complete Form3500 coverage or general live-model/clinical readiness.
