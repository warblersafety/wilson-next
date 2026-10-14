# Wilson Next completion assessment — 14 October 2026

Baseline: `b538f5e6495977e07b9da622e8984448a1d40bb3` (24 September 2026). This is a publication-safe technical assessment; private local planning, conversation and demo originals are preserved separately and are not part of the repository.

## Product and completion target

Wilson helps a healthcare professional describe a suspected adverse event naturally, review source-backed interpretation, correct and accept the case knowledge, answer useful follow-ups, and download a faithful Form FDA 3500. Clinical knowledge is authoritative; the form is a downstream projection. Wilson does not diagnose, judge causality, recommend treatment or submit to FDA.

The selected target is full Form 3500 functionality for real healthcare professionals using **artificial case data only**. This is not a real-patient-data production release. Conversation remains the primary interaction, with direct editing as support. Preserve the existing visual design and working components; expand coverage through independently verified slices.

Required additions include browser-local save/resume of one active case, without accounts or cross-device requirements, and reusable editable reporter details stored separately from the case and replacing the temporary demo-populate shortcut. There is one user per browser; a case manager and portable backups are not required. Resume must preserve accepted facts, pending proposals/conflicts and unfinished work, with honest browser-storage-loss limitations. Reporter identity is entered directly and never inferred by the model.

## Current implementation

The application is a substantial synthetic preview, not a complete general Form 3500 replacement. It implements natural text input, native-dictation guidance, source inspection, explicit proposal acceptance, direct and conversational correction, stable repeated tests, conflict resolution, withdrawal history, bounded deterministic follow-ups, reporter entry and actual PDF preview/download.

The implementation supports selected medication, single-device and product-problem journeys. The semantic case permits three products and eight tests; the PDF adapter supports two non-device suspects, one concomitant product and one suspect device, subject to readiness rules. Same-tab session storage is not durable save/resume; reusable reporter persistence remains unimplemented.

The architecture is one modular TypeScript/Next.js application. `commands.ts` owns authoritative case changes; `completion-policy.ts` selects bounded questions; the model proposes source-grounded values through `model-boundary.ts`; `projection.ts` derives form concepts and omissions; `form-3500.ts` alone handles PDF widgets. Pending interpretation cannot silently replace accepted knowledge. Corrections retain superseded values and entity identity.

Git history records PDF proof (#12), semantic-case enforcement (#16), local assembly (#18), protected real-model experiments (#24–56), adaptive medication/device paths (#58–65), correction/quarantine/readiness work (#69–79), then source/laboratory fidelity and UI improvements (#86–123). Experiment 2 ended `Revise`: technical generalization qualified pass, live interpretation reliability unresolved. Later bounded repairs do not establish a general reliability rate.

## Priority findings

| Priority | Evidence-backed concern | Completion evidence |
| --- | --- | --- |
| High | **Demonstrated capacity-readiness defect:** a command-based synthetic correction produces three reviewed medication suspects with no readiness issues, then the adapter rejects the two-suspect limit. `src/server/journey/service.ts:593` and `src/server/pdf/form-3500.ts:229`. | Align readiness and export capacity; verify both acceptable and excess-capacity cases through actual PDFs. The analogous two-concomitant mismatch is a static inference, not independently reproduced. |
| High | Conversational correction can allocate a new test instead of changing the intended serial test; locally recorded #105 analysis remains relevant. | Diverse corrections and genuine additions preserve identity from source through review and output. A retry or rejection alone is not a fix. |
| High | Narrative is composed from selected fragments (`src/domain/case/projection.ts:376`), with incomplete qualifier/context preservation; #115 records related work. | Reviewed material context and uncertainty reach the report without invention or silent omission. |
| High | Many supported timing, dose, route and demographic facts have no proactive completion need. Current questions are deliberately bounded (`src/domain/case/completion-policy.ts:57`). | Consequential missing information earns useful questions; unknown, declined and done states do not loop or imply answers/acceptance. |
| High | Full form breadth, durable case resume and reusable reporter details remain incomplete. | Complete source → interpretation → review → follow-up/correction → PDF journeys for each selected extension. |
| Medium | Awaited browser diagnostics can delay useful work or error presentation; #118 records the known timing limitation. | Failure feedback remains recoverable even when telemetry is slow or unavailable. |
| Medium | Assistive-technology and unassisted usability evidence remains bounded; #108 records manual screen-reader follow-up. | Appropriate independent checks and realistic artificial-data journeys, without treating guided demos as general validation. |

Form breadth includes patient/context variants, dates/chronology, product categories and identifiers, ongoing therapy/duration, varied device paths, concomitants, overflow/continuation support, reporter entry and applicable special circumstances. Each gap needs a bounded supported journey; adding a field alone is insufficient. Verify current official form/instructions when implementing a selected expansion rather than assuming every conceivable circumstance belongs on Form 3500.

## Verification and limits

At the assessed baseline, 234 deterministic tests in 35 files, typecheck and fresh build passed under Node 22.23.2. The full existing 14 synthetic/mock Chromium journeys subsequently passed locally, including actual PDF readback, through the supported local-server route. A temporary isolated capacity probe reproduced the readiness/export discrepancy. No application-model calls were needed for these checks.

The repository declares Node 24.20.0. That exact official runtime has now been installed and its archive SHA-256 verified without changing the machine default. Fresh verification of the unchanged application baseline under explicit Node 24.20.0 passed typecheck, all 234 tests in 35 files, a fresh build, and all 14 full synthetic/mock Chromium journeys (1.3 minutes). Existing application sources, tests, configuration and dependencies were unchanged. Subsequent delivery checks must retain the explicit runtime path.

Remote main matches the assessed baseline. PR #123 and the resulting main CI passed. Read access through the existing repository-scoped GitHub App broker works; classic branch-protection detail remains inaccessible under its read permissions. Existing protection must not be bypassed.

Tests and successful synthetic journeys are not proof of general live-model reliability, complete coverage or clinical usability. The pinned FDA 3500 (09/2025) asset and its SHA-256 protect mapping consistency; official-source currency was not refreshed for the initial assessment. Dependency advisories, load testing and real-data operational approval are outside this assessment. Temporary local check outputs and private archives are not public deliverables.

## Proposed delivery order

1. Reliable browser-local save/resume, including pending work, failures/incompatible data, replacement and same-browser multi-tab behavior.
2. Separate reusable editable reporter details replacing the fictional shortcut, with successive-case reuse and correction checks.
3. Capacity/readiness and selected fidelity/completion repairs, retaining clinician acceptance and uncertainty.
4. Remaining Form 3500 coverage through assembled, source-to-PDF slices and independent output checks.
5. Full artificial-data workflow, reliability, accessibility and usability acceptance against explicit criteria.

Each slice requires its own PR and appropriate unit, full mock-browser, typecheck/build, independent-review and CI gates. Stop when a slice's design is not working cleanly; do not weaken checks or add hidden workarounds. Full artificial-data functionality does not authorize real-patient use or relax clinician control.
