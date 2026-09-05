# Wilson product and experience

**Status:** Approved by Steve; consolidated 2026-09-05 without expanding the
approved product

**Owns:** Product promise, users, scope, interaction contract, quality floor,
and unacceptable outcomes

## Product promise

Wilson helps a clinician turn what they know about a suspected adverse event
into a reviewed Form FDA 3500 with less effort and less risk of omission or
distortion than completing the form directly.

The clinician describes the case naturally, sees what Wilson understood,
corrects it, answers a small number of useful follow-ups, and downloads a form
that faithfully reflects the reviewed case knowledge. Wilson succeeds only if
a representative clinician would prefer that experience to completing Form
FDA 3500 directly.

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
- V1 has no accounts, application identity, shared workflow, saved-case list,
  long-term record storage, or interrupted-session recovery.
- Wilson must tolerate partial knowledge, uncertainty, refusal, correction,
  contradiction, and repeated products without silently changing meaning.
- A capability is complete only when its assembled conversation, knowledge,
  review, and output have been exercised and agree.

Development and early physician sessions use synthetic information until
privacy, provider, logging, contractual, and operational boundaries for real
clinical data are explicitly approved.

## Interaction contract

These are stages of work, not a requirement for separate pages or linear
navigation.

1. **Describe:** enter a natural account by typing or device-native dictation.
   Wilson does not capture or retain audio.
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
| Continuity | An unfinished case may be lost on reload or restart; one running session may start over |
| Advice | No diagnosis, causality judgment, coding, classification, or treatment recommendation |
| Development data | Synthetic only until real-data boundaries are approved |
| Product proof | A real physician uses a production-shaped synthetic journey and compares the direction with the direct form |

At least one drug or biologic case and one device or product-quality case are
required before claiming meaningful product breadth. Exhaustive path coverage
is not required before the first formative physician session, but unsupported
paths remain disclosed and a partial release is not described as a general Form
3500 replacement.

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

Synthetic and operator evidence make physician contact safe and interpretable;
they cannot prove usability or preference. One physician can expose a bad
premise and guide the next slice, but cannot establish general usability,
safety, or clinical validity.

## Form authority

Wilson tracks the then-current FDA form and instructions rather than freezing a
category list into product code. FDA describes Form 3500 as the voluntary form
for health professionals and separately supports consumer reporting through
Form 3500B. Wilson's clinical focus is a product choice, not a claim that only
clinicians may report.
