# Current coverage and acceptance limits

This is the capability index for the [Product](PRODUCT.md) artificial-data target,
not another backlog or approval gate. [Architecture](ARCHITECTURE.md) owns contracts;
issues own scoped work and PRs own delivered evidence. Keep this table current
when a capability changes instead of appending per-slice logs. No full-form or
general live-model reliability claim follows from passing deterministic tests.

## Supported boundaries and remaining scope

| Area | Implemented boundary | Remaining limitation / source |
|---|---|---|
| Conversation and review | Grounded proposed facts, explicit review, direct/conversational corrections, conflicts, withdrawal/history, full submitted-account inspection and read-only clinical gaps answered through Clinical update | Valid source references do not prove target-specific support. Serial-test semantic correction [#150](https://github.com/warblersafety/wilson-next/issues/150) remains paused; allocation containment is not identity matching. [UI evidence](../evidence/issue-245/README.md) changes no model/prompt. |
| Patient | Explicit involvement/A1 no-patient guards; age years/months/weeks/days; independent DOB and clinician A2 print choice; native A5 selections; existing sex values/context with A3 supplements | Unusual exact age wording [#239/PR240](https://github.com/warblersafety/wilson-next/pull/240) is paused/unmerged; weight/age exceptions and portable glyphs remain. Birth-basis guidance [#217](https://github.com/warblersafety/wilson-next/issues/217) cannot be inferred or solved by relabelling stored sex facts. |
| Clinical context | B5 course/treatment/outcome context, whole-list qualifier labels; B6 row-linked test context; B7 history; independent general comments; B5–B7 exact narrative continuation | Remaining field-linked context/source omissions [#115](https://github.com/warblersafety/wilson-next/issues/115); neutral comment withdrawal [#204](https://github.com/warblersafety/wilson-next/issues/204). Narrative capacity does not establish general completeness or arbitrary test-grid overflow. |
| Dates | Valid complete dates plus explicit month/year/year-only expiration, purchase/therapy/reduction, implant/explant, test, onset/death/discharge, C1 return and DOB, with exact field-linked wording/qualifiers | Ordinary precision implementation is delivered; integrated source/read-back/manual-recovery acceptance [#180](https://github.com/warblersafety/wilson-next/issues/180) remains. No relative-date arithmetic or arbitrary date-language perfection; B4 is direct report date. |
| Product detail | Explicit NDC/Unique ID, seller/purchase metadata, drug labels, cosmetic choice, hemp/Other choices, ongoing/reduction history, D3 print alternatives and supplied durations; long/multiline D1/D2 values/supplements | Non-native seller/selector/context exceptions remain bounded. Do not infer category, cosmetic use, units, ongoing status or causality. Broader glyph work remains [#154](https://github.com/warblersafety/wilson-next/issues/154). |
| Durations and quantities | Literal dose/strength with formatting-only native splits; exact qualified B5 and long/multiline D1/D2 supplements; native-time and supplied dose-count/range/compound D3 durations | [Quantity evidence](../evidence/issue-235/README.md), [duration evidence](../evidence/issue-237/README.md); these do not deliver arbitrary demographic wording or glyph fidelity. |
| Devices and concomitants | Additional native D-only copy for third suspect; E-only copies for additional devices; native F rows include concomitant devices. Medication regimen/history automatically carries on F-linked supplements | Retained-case cap is three products/eight tests, despite ten native F rows. Larger capacity/overflow needs a resource decision and connected support. Combination components need a representation decision; no automatic component split. [D](../evidence/issue-208/README.md), [E](../evidence/issue-210/README.md), [F](../evidence/issue-212/README.md), [medication context](../evidence/issue-243/README.md). |
| Reporter and continuity | Direct editable reporter, international/raw country and multiline G1 supplements, separate reusable defaults, one active browser-local case, complete pending/accepted state and unfinished-work recovery, one-tab ownership | Occupation exceptions and glyphs remain. Browser/profile/site-data/origin loss is not recoverable backup. Cross-device/accounts/case lists remain excluded. [Workspace](../evidence/issue-139/README.md), [defaults](../evidence/issue-141/README.md), [G1](../evidence/issue-214/README.md). |
| Pictures/export | Actual PDF and linked narrative/form continuations within existing glyph support | C2 picture/file lifecycle, save/resume and complete export package remain unfinished. A Yes answer must correspond to accompanying files. No approved new archive/font dependency is implied; fflate/custom-font paths remain unapproved. |
| Form breadth | Bounded medication/device/product-problem and combined AE/problem paths | Full B1 product-use error and different-manufacturer paths are not implemented; all form paths remain target scope. Ordinary category/mixed-category and combination coverage need explicit source-reviewed journeys, not inferred classification. |
| Fidelity and recovery | Current representability/readiness guards retain unsupported facts rather than corrupting PDF; code-owned source excerpts and explicit recovery | Portable glyphs [#154](https://github.com/warblersafety/wilson-next/issues/154), diagnostic precision [#157](https://github.com/warblersafety/wilson-next/issues/157), stable serial display refs [#148](https://github.com/warblersafety/wilson-next/issues/148), reordered selection conflicts [#207](https://github.com/warblersafety/wilson-next/issues/207). Open issue titles can describe earlier scope; existing evidence determines what is already implemented. |

## Acceptance boundary

Supplied age months/weeks/days extend representation only: removing adult-only
prompt wording does not introduce age-specific clinical rules or establish broader
pediatric clinical validation. Original journey evidence used adults; mocked
age-unit checks do not establish live age-unit interpretation fidelity (#169).

Completed [Experiment 1](https://github.com/warblersafety/wilson-next/blob/4b7a82cff3028c2f1b5121087dcca5ebde95ede8/docs/EXPERIMENT-1.md)
was a qualified technical success, not general reliability proof; its exact-source
oracle was not fully satisfied. [Experiment 2](https://github.com/warblersafety/wilson-next/blob/4b7a82cff3028c2f1b5121087dcca5ebde95ede8/docs/EXPERIMENT-2.md)
ended **Revise**, with live reliability unresolved. Later bounded fixes do not
rewrite these results.

The [twelve-case report](../evidence/live-acceptance-241/README.md) reached PDF
export after explicit review/manual recovery; it was not twelve clean extractions
or uninterrupted UI journeys. Some operations used the protected API, records
were installed/resumed, and two original successful responses needed transport
recovery. Preserve those harness and attribution limits. [Issue243's later gate](../evidence/issue-243/README.md)
records **text-based synthetic-case milestone: NO-GO** because stopped-and-improving
wording again omitted general outcome while proposing D7 improvement. Its F-context
fix passed narrowly; it did not fix extraction. D7 temporal grounding is not a
clinical causality conclusion. The issue245 UI change does not supersede that result.
A recommendation in evidence for a supervised session is not participation approval.

Final integrated acceptance still needs varied current-source first responses,
review/correction and source recovery, cross-category/exception/attachment/overflow
paths, keyboard/assistive-technology checks, and protected same-origin upgrade/
rollback evidence within the chosen scope. [#169](https://github.com/warblersafety/wilson-next/issues/169),
[#187](https://github.com/warblersafety/wilson-next/issues/187),
[#108](https://github.com/warblersafety/wilson-next/issues/108) and
[#143](https://github.com/warblersafety/wilson-next/issues/143) retain their narrower
verification limits. Existing automation is not Safari/Firefox or independent
clinician usability evidence. Tests are not full-form certification or real-data approval.

## Paused decisions and excluded polish

Issue150 semantic correction and age PR240 stay paused. Save/resume visibility
changes and model/prompt/PDF changes based on the Ali retest remain deferred
from the approved input-flow simplification. The [general-context
experiment PR195](https://github.com/warblersafety/wilson-next/pull/195) remains
unmerged; do not import its prompt. The proposed blanket [B1/B2 gate #200](https://github.com/warblersafety/wilson-next/issues/200)
is not implemented: prospective continued-use risk and dangerous product failures
make the clinical premise unresolved. Never force causality or report classification.

The decorative bird (#121), richer processing feedback (#99) and general redesign
are outside the functional cut. Diagnostics (#134/#157) support observed failure
recovery; they do not substitute for functionality. Full completion remains the
goal; do not expand a bounded slice into language perfection or unblock a material
capacity/component/font decision with a hidden workaround.
