# Wilson product and experience

**Status:** Product baseline consolidated 2026-09-05; artificial-data completion
target amended in [Issue #124](https://github.com/warblersafety/wilson-next/issues/124)
on 2026-10-14

**Owns:** Product promise, users, scope, interaction contract, quality floor,
and unacceptable outcomes

## Current delivery status and completion target — 14 October 2026

The existing application is a protected synthetic preview after PR #123. Its
bounded medication, device and product-problem capabilities are not complete
Form 3500 coverage or proof of general interpretation reliability.

The selected next milestone is full Form 3500 functionality for healthcare
professionals using artificial data throughout, including fictional reporter
identity and contact details. Conversation remains primary,
with direct editing as support and the existing visual design retained.
Browser-local save/resume of one active case and separate reusable editable
reporter details are required. Reporter reuse replaces the temporary fictional
population shortcut. Assume one user per browser; no accounts/login,
cross-device requirement, case manager or portable backup feature is included.
These requirements supersede the earlier interrupted-session recovery and
storage exclusions for this artificial-data milestone; they are not delivered
capabilities or approval for real-patient-data production, real personal-data
entry or new external review sessions. Existing synthetic-only access controls
remain in force. The persistence slice must reconcile its design in Architecture
before implementation, including storage/versioning, recovery and multi-tab
behavior; reusable reporter storage remains separate from the active case.

See [the completion assessment](ASSESSMENT-2026-10-14.md) for current technical
gaps and verification limits. Implement and verify each extension as a bounded
slice through the existing semantic authority and delivery controls.

## Product promise

Wilson helps a clinician turn what they know about a suspected adverse event
into a reviewed Form FDA 3500 with less effort and less risk of omission or
distortion than completing the form directly.

The clinician describes the case naturally, sees what Wilson understood,
corrects it, answers a small number of useful follow-ups, and downloads a form
that faithfully reflects the reviewed case knowledge. Preliminary physician
feedback reports a strong preference for this approach if it works accurately,
completely, and with low burden. Wilson therefore succeeds only when the
assembled product first meets that condition and, after separate readiness
approval, representative clinicians confirm the experience in use.

## Product boundaries

- Wilson is a clinician-facing aid for healthcare professionals preparing or
  reviewing voluntary Form FDA 3500 reports. It does not impose a
  physicians-only eligibility gate.
- All report types and FDA-regulated product categories covered by the current
  Form FDA 3500 are product scope. Early experiments may support a smaller,
  visible subset to learn faster without making later paths structurally
  impossible.
- The clinician's knowledge is primary; Form 3500 is a downstream output.
- A model may interpret and propose. It may not silently establish or change
  authoritative case knowledge.
- The clinician reviews and corrects the case before downloading the form.
- Wilson does not diagnose, judge causality, make clinical decisions, code or
  classify the event, recommend treatment, or submit the report to FDA.
- V1 has no accounts, application identity, shared workflow or saved-case list.
  The artificial-data milestone requires browser-local recovery of one active
  case and separately reusable reporter details; broader durable storage remains
  outside this selected scope.
- Wilson must tolerate partial knowledge, uncertainty, refusal, correction,
  contradiction, and repeated products without silently changing meaning.
- A capability is complete only when its assembled conversation, knowledge,
  review, and output have been exercised and agree.

Development uses synthetic information until privacy, provider, logging,
contractual, and operational boundaries for real clinical data are explicitly
approved. No experiment document alone authorizes physician involvement. A
future physician session requires a separate finding that Wilson is complete
and ready enough to justify the participant's time.

## Interaction contract

These are stages of work, not a requirement for separate pages or linear
navigation.

1. **Describe:** enter a natural account by typing, pasting, or device-native
   dictation. Review and edit the captured text before explicitly submitting it
   for interpretation, then review Wilson’s understanding in the next stage.
   Dictation help explains the computer’s controls; Wilson does not capture or
   retain audio.
2. **Check understanding:** inspect a concise, case-oriented read-back with
   enough source context to detect invention, loss, or misattribution.
3. **Clarify:** answer, qualify, decline, or mark unknown only for a small
   number of consequential gaps.
4. **Review and correct:** edit facts, entities, roles, uncertainty, and
   conflicts through the same authoritative write boundary.
5. **Inspect output:** compare the reviewed case with the supported Form 3500
   projection. Unsupported, omitted, and unresolved material remains truthful
   and visible without treating every optional blank as invalid.
6. **Download or begin again:** download the form without submitting it, or
   start a blank case. Starting over during unfinished work requires clear
   confirmation; there is no Delete case concept.

Correction may return the user to clarification or review. A model or output
failure must leave accepted knowledge intact and present an understandable,
recoverable state. The interface never exposes PDF widget identifiers, internal
enum values, record paths, prompts, model payloads, or implementation language.

### Every question must earn its turn

Wilson asks a follow-up only when all are true:

1. The information is genuinely missing, unresolved, or contradictory.
2. The answer materially improves the supported report or resolves an
   important ambiguity.
3. The answer is not already present, declined, or truthfully representable as
   unknown, omitted, or inapplicable.
4. The question can be asked clearly without confusing entities or products.

Related needs may share one question only when attribution remains clear.
Optional or unsupported blanks do not earn questions merely because the form
contains them. Each slice declares a small question budget and justifies any
increase with assembled-journey evidence. This is a value-per-turn rule, not a
universal numerical cap; explicit review and conflict resolution remain
deliberate safeguards.

## Required difficult states

The experience must make these states intelligible when a selected slice
reaches them:

- sparse and partial knowledge without exhaustive interrogation;
- repeated products with attributes attached to the correct instance;
- a correction that visibly supersedes an earlier active value;
- uncertainty or contradiction awaiting clinician resolution;
- the distinction among not asked, unknown, explicitly absent, inapplicable,
  and declined when it affects the report;
- visible model or output failure without silent loss; and
- intentional abandonment through New case.

Unsupported paths must be visible rather than approximated. The first slice
need not implement every difficult state, but it includes at least one state
capable of discriminating the architecture.

## Representative product journeys

1. **Information-rich single product:** preserve all supported facts, present a
   coherent read-back, avoid asking for known information, and keep review and
   form output aligned.
2. **Sparse report:** distinguish missing states, ask only the highest-value
   questions, and permit useful partial output when form and product rules allow
   it.
3. **Repeated products and correction:** preserve each product's identity and
   role, apply a correction consistently, and retain the superseded statement
   without leaving it active.
4. **Uncertainty and contradiction:** preserve alternatives, surface material
   conflict, accept explicit resolution or leave it visibly pending, and never
   project mutually exclusive active values.

Silent loss, invention, reversal, duplication, wrong-entity attribution,
hidden conflict, repeated declined questions, field-by-field interrogation,
and disagreement between reviewed knowledge and the form are unacceptable.

## V1 direction

| Choice | Decision |
|---|---|
| Initial user | A US healthcare professional preparing or reviewing a clinical Form FDA 3500 report |
| Product breadth | All current Form 3500 report and product paths, reached through deliberately varied slices |
| Opening input | Typed narrative plus operating-system or browser dictation; no app audio pipeline |
| Endpoint | Reviewed, downloaded Form FDA 3500; no electronic submission |
| Accounts and collaboration | None in v1; a development-preview lock is separate deployment protection |
| Continuity | Required browser-local save/resume of one active artificial-data case; browser storage loss remains possible |
| Advice | No diagnosis, causality judgment, coding, classification, or treatment recommendation |
| Development data | Synthetic only until real-data boundaries are approved |
| Product proof | First demonstrate accurate, complete, low-burden assembled behavior; after separate product-completeness and readiness approval, representative healthcare professionals validate it in use |

At least one drug or biologic case and one device or product-quality case are
required before claiming meaningful product breadth. Unsupported paths remain
disclosed and a partial release is not described as a general Form 3500
replacement. The V1 direction does not itself define or authorize a physician
readiness threshold.

## V1 non-goals

- Receiving or reconciling a patient report from Lucy.
- Shared clinic queues, assignments, organizational administration, or
  multi-user editing.
- Direct FDA submission or submission-status tracking.
- EHR integration, chart ingestion, patient lookup, or product and clinical
  suggestions.
- Pharmacovigilance case management or a longitudinal database.
- Delivering every Form 3500 path in the first implementation slices.
- Native recording, stored transcription, or voice-biometric features.

These exclusions protect the first product test; they are not permanent product
limits.

## Quality and evidence

Evaluate dimensions separately: fidelity, source evidence, correction,
entity integrity, interaction burden, clarity, output agreement, failure
behavior, model stability, and clinician preference. Do not collapse them into
one pass percentage before useful thresholds exist.

Every material value must trace to clinician input or an explicit deterministic
derivation. Missing information is not automatically unknown or absent.
Corrections must behave consistently regardless of input path. Severe loss,
invention, reversal, wrong attribution, contradictory form values, or silent
failure stops expansion regardless of aggregate performance.

Synthetic and operator evidence cannot prove clinician usability. Preliminary
physician feedback establishes only conditional preference for Wilson's
approach: it does not prove that the assembled product is accurate, complete,
or low burden. Representative clinician evidence will eventually be necessary
for the product claim, but only after a separately approved product-completeness
and readiness decision; it cannot establish general usability, safety, or
clinical validity by itself.

## Form authority

Wilson tracks the then-current FDA form and instructions rather than freezing a
category list into product code. FDA describes Form 3500 as the voluntary form
for health professionals and separately supports consumer reporting through
Form 3500B. Wilson's clinical focus is a product choice, not a claim that only
clinicians may report.

## Practical completion checklist — 16 October 2026

This tracks the approved artificial-data release cut by category. A bounded
implementation is not final integrated acceptance. Keep existing conversation,
review/correction, browser-local case/reporter persistence and visual design.

| Completion category | Current coverage and remaining work |
|---|---|
| Patient and reporter | Explicit participation/A1 and no-patient consistency delivered in PR197/199; age/weight/race native paths exist. Broader sex representation and international reporter/profile/address remain. |
| Clinical narrative and context | B5-B7 context and narrative continuation exist (PR158/160, issue190). Whole-list context scope is implemented in issue159. Independent general Additional comments are implemented in issue202, including shared B6 continuation. Source omissions and faithful field-linked exception support remain. |
| Product details and categories | Native purchase date/seller/address/website are implemented (issues183/188), alongside NDC, expiry, duration and cosmetic choice. Hemp/Other D5, partial dates/durations and unsupported wording still need faithful representation. |
| Devices, concomitants and capacity | One suspect-device path exists. Additional D/E copies, multiple devices, full concomitant rows and test/product overflow remain. |
| Pictures and portable export | Narrative attachments exist. Actual picture/file lifecycle, complete export package, portable glyphs and remaining field-linked supplements are unfinished. |
| Integrity and final acceptance | Preserve accepted/pending/conflict/source/history, draft/resume and one-case controls in every slice. Semantic correction issue150 stays paused; current cross-category, hosted/keyboard/accessibility and bounded live first-response acceptance remain. |

Issue200's proposed blanket B1/B2 gate is not implemented: FDA's life-threatening
criterion includes prospective continued-use risk, and product-problem reporting
also includes dangerous malfunctions. Current booleans cannot establish a universal
literal contradiction without interpreting clinical context. Keep the question
open with its official-source evidence; never infer causality or force a report
classification. PR195's general prompt experiment remains unmerged.
