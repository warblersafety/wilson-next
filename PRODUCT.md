# Wilson product definition

**Status:** Confirmed by Steve on 2026-09-04

**Prepared:** 2026-09-04

**Authority:** Product intent derived from the confirmed recovery brief and
Steve's confirmed product decisions

## Product promise

Wilson helps a clinician turn what they know about a suspected adverse event
into a reviewed Form FDA 3500 with less effort and less risk of omission or
distortion than completing the form directly.

The clinician should be able to describe the case naturally, see what Wilson
understood, correct it, answer a small number of useful follow-ups, and download
a form that faithfully reflects the reviewed case knowledge.

Wilson succeeds only if a clinician would prefer this experience to completing
Form FDA 3500 directly.

## Confirmed product boundaries

These decisions come from the confirmed recovery brief:

- Wilson is a clinician-facing aid for voluntary adverse-event reporting on
  Form FDA 3500.
- Wilson's intended users are healthcare professionals working in a clinical
  setting who prepare, review, or submit Form FDA 3500 reports. Wilson does not
  impose a physicians-only restriction or attempt to determine professional
  eligibility.
- Every report type and FDA-regulated product category covered by the current
  Form FDA 3500 is within Wilson's product scope. Delivery may begin with a
  smaller set of slices when that materially speeds up learning.
- The clinician's knowledge is primary; the form is a downstream output.
- The model may interpret and propose. It may not silently establish or change
  authoritative case knowledge.
- The clinician reviews and corrects the case before downloading the form.
- Wilson does not diagnose, make clinical decisions, classify the event, or
  submit the report to FDA.
- Long-term record storage is not part of the confirmed product.
- Wilson must tolerate partial knowledge, uncertainty, refusal, correction,
  contradiction, and more than one product without silently changing their
  meaning.
- A product capability is not complete until the assembled journey has been
  exercised and its conversation, knowledge, and output agree.

## Intended experience

The ordinary journey should feel like handing a competent assistant a concise
case account—not like completing a PDF one box at a time.

1. The clinician describes the case in their own words.
2. Wilson presents a concise account of what it understood, organized around
   the case rather than the form.
3. The clinician confirms, corrects, or qualifies that understanding.
4. Wilson asks only consequential questions whose answers are not already
   available.
5. The clinician can review and edit the assembled case knowledge.
6. Wilson shows how that knowledge will appear in Form FDA 3500.
7. The clinician downloads the reviewed form and decides what to do with it.

The experience must not expose PDF widget identifiers, internal enum values,
record paths, model mechanics, or implementation vocabulary.

## Representative journeys

These journeys define product behavior before architecture. Their narratives
will later become synthetic evaluation cases, but the wording and precise
clinical content are not yet fixtures.

### Journey 1: information-rich single-product report

**Situation:** A clinician provides a compact narrative containing patient
context, one suspect product, dose and timing, the adverse event, relevant
treatment, outcome, and several useful dates.

**Wilson should:**

- recover all material facts supported by the narrative;
- preserve which statements support each fact;
- present a concise, clinically coherent read-back;
- ask only for consequential missing information;
- allow corrections before and during final review; and
- produce a form projection that agrees with the reviewed knowledge.

**Unacceptable:** losing a stated fact, inventing an unstated value, asking for
information already supplied, or requiring a long field-by-field walk after a
rich opening account.

### Journey 2: sparse and incomplete report

**Situation:** A clinician knows that an adverse event followed a treatment but
has limited patient, product, timing, or outcome information. Some answers are
unknown; the clinician declines to provide others.

**Wilson should:**

- prioritize a small number of high-value follow-ups;
- distinguish not yet asked, unknown, explicitly absent, inapplicable, and
  declined where the difference affects the report;
- explain important remaining gaps without trapping the clinician in an
  exhaustive interview;
- permit completion with partial information when the form and product rules
  allow it; and
- avoid translating missing information into a claim of "unknown" or "none."

**Unacceptable:** treating every blank form field as a question, repeatedly
asking declined questions, implying completeness that was not established, or
blocking useful output merely because optional facts are unavailable.

### Journey 3: multiple products and a correction

**Situation:** The clinician names two suspect products and at least one
concomitant product, then corrects a dose, date, or product role later in the
conversation.

**Wilson should:**

- keep each product and its attributes distinct;
- attach evidence and corrections to the intended product;
- preserve the difference between suspect and concomitant roles;
- apply a correction consistently wherever that knowledge is presented or
  projected; and
- make the change visible to the clinician without retaining a contradictory
  active value.

**Unacceptable:** dropping a later product, attaching an attribute to the wrong
product, silently overwriting confirmed knowledge, duplicating a product, or
showing different values in conversation, review, and the form.

### Journey 4: uncertainty and contradiction

**Situation:** The clinician expresses uncertainty, gives two incompatible
values, or later supplies evidence that conflicts with an earlier statement.
The case also exercises the difference between no concomitant products and not
knowing whether any existed.

**Wilson should:**

- preserve uncertainty rather than forcing false precision;
- surface a material contradiction for resolution;
- keep incompatible alternatives from simultaneously becoming authoritative;
- accept a clinician's explicit resolution or leave the conflict visibly
  pending; and
- project only knowledge whose state has a defined form meaning.

**Unacceptable:** choosing a side silently, checking mutually exclusive form
values, treating `none` and `unknown` as synonyms, erasing the earlier evidence,
or claiming the report is ready while a consequential conflict is hidden.

## Product-quality scorecard

Early evaluations should report these dimensions separately rather than reduce
them to one pass percentage:

| Dimension | Product question |
|---|---|
| Fidelity | Were stated facts preserved without invention, reversal, loss, or misattribution? |
| Evidence | Can each material value be traced to clinician input or an explicit deterministic derivation? |
| Correction | Do corrections and conflicts behave consistently regardless of where the original value entered? |
| Entity integrity | Do repeated patients, events, and products remain distinct and correctly related? |
| Interaction burden | Did Wilson extract substantial value per turn and avoid redundant or low-value questions? |
| Clarity | Was the conversation concise, natural, and free of form or implementation jargon? |
| Output agreement | Did the reviewed knowledge and generated Form FDA 3500 say the same thing? |
| Failure behavior | Were failures visible, understandable, and recoverable rather than silent? |
| Stability | Did representative real-model runs remain acceptably consistent? |
| Preference | Would a representative clinician choose Wilson over completing the form directly? |

Exact thresholds remain open until we have a direct-form baseline and the first
production-shaped experiment. Silent loss, invention, reversal, wrong-entity
attribution, or contradictory form values are unacceptable regardless of an
aggregate score.

The core value proposition is not proven until at least one real physician has
used a production-shaped Wilson journey and compared it with completing the
form directly. Synthetic cases and operator evaluation should make that session
safe and worthwhile, but cannot substitute for the physician's feedback.

## Confirmed v1 direction

These choices keep v1 focused on demonstrating the core value proposition.

| Choice | Decision | Reason |
|---|---|---|
| Initial user | A US healthcare professional preparing or reviewing a clinical Form FDA 3500 report; not physicians only | Matches the form's clinical users without inventing a narrower professional gate |
| Product scope | All report types and product categories covered by the current Form FDA 3500, including devices | Keeps Wilson aligned with the form it exists to improve |
| Delivery slices | Early slices may cover a representative subset of Form FDA 3500 when sequencing makes implementation and learning faster | Product scope need not force every form path into the first experiment |
| Opening input | Typed narrative plus operating-system/browser dictation; Wilson does not capture or retain audio | Provides natural dictation without adding an audio-data pipeline |
| Endpoint | Reviewed, downloaded Form FDA 3500; no electronic FDA submission | Already confirmed and keeps the clinician as the submission authority |
| Accounts | No accounts or application authentication in v1 | Keeps v1 centered on the core reporting experience; protecting a development preview is a separate deployment concern |
| Continuity | No interrupted-session recovery is required; the active case may be lost when the browser session ends | Avoids persistence machinery that is not needed to prove the core experience |
| New case | The user can begin a blank case after completing a report or abandon the active case and start over | Supports multiple sequential reports in one user session and recovery from a botched case without requiring a saved-case collection |
| Collaboration | No shared clinic queue, multi-user editing, or handoff workflow | Avoids identity, synchronization, and organizational workflow before single-user value is proven |
| Advice | No diagnosis, causality judgment, coding, classification, or treatment recommendation | Keeps Wilson focused on faithful reporting rather than clinical authority |
| Development data | Synthetic cases until privacy, provider, logging, and contractual boundaries are explicitly approved | Prevents product discovery from depending on unresolved PHI handling |
| Product proof | Feedback from a real physician after Wilson is ready for a production-shaped comparison | Direct user evidence is required to show that Wilson is faster and preferable to the form |

## Explicit non-goals for v1

- Receiving or reconciling a patient report from Lucy.
- Multi-user clinic workflow, shared records, assignments, or organization
  administration.
- Direct FDA submission or submission-status tracking.
- EHR integration, patient lookup, or automatic chart ingestion.
- Product, diagnosis, laboratory, device, MedDRA, or causality suggestions.
- Longitudinal safety-case management or a pharmacovigilance database.
- Delivering every Form FDA 3500 path in the first implementation slices. Those
  paths remain in product scope and must not be made structurally impossible.
- Native audio recording, transcription storage, or voice-biometric features.

These exclusions are intended to protect the first product test, not establish
permanent limits.

## Resolved product decisions

### Session continuity and starting over

Wilson has no requirement to recover an interrupted session. If the clinician
closes or reloads the application, the unfinished case may be lost.

Within a running user session, the clinician can start a new blank case:

- after completing or downloading the current report, so multiple cases can be
  prepared sequentially; or
- while a case is in progress, so the clinician can abandon a botched path and
  start over.

The product therefore needs a clear **New case** action, with confirmation
before discarding an in-progress case. There is no **Delete case** concept in
v1 because Wilson does not maintain a saved-case list or longitudinal record.
Concurrent editing of multiple open cases is not required.

### Breadth required to call the product v1

All current Form FDA 3500 report and product paths are Wilson product scope.
Smaller implementation slices may be used to reach v1 and to prepare for
physician evaluation.

**Decision:** use a small set of deliberately varied slices to prove the
knowledge workflow first, including at least one drug/biologic case and one
device or product-quality case. Do not require exhaustive path coverage before
physician evaluation, but document unsupported paths visibly and do not call a
partially supported release a general replacement for Form FDA 3500.

### Are any listed non-goals actually required for initial value?

This question was a safeguard against accidentally excluding something without
which the core experience cannot be tested. On review, none of the listed
capabilities is necessary to test whether a clinician can describe, review,
correct, and download one faithful report. Full Form FDA 3500 breadth is not a
permanent non-goal; only delivering it all in the first slices is deferred.

The listed non-goals are accepted for v1.

## Regulatory product reference

FDA describes Form FDA 3500 as the voluntary reporting form designed for health
professionals, with examples including physicians, pharmacists, nurses, and
respiratory therapists. FDA also accepts voluntary reports from patients and
consumers and provides the consumer-oriented Form FDA 3500B. Wilson v1 targets
the clinical health-professional experience; that is a product focus, not a
claim that only clinicians may report.

Wilson's scope should track the then-current FDA form and instructions rather
than freeze today's category list into the product definition.

## Product-definition decision

Steve confirmed the product promise, v1 direction, representative journeys,
unacceptable outcomes, and non-goals on 2026-09-04.

This confirmation authorizes architecture comparison against the product
definition. It does not authorize implementation or silently select any data
model, framework, provider, storage mechanism, UI composition, or legacy asset.

The interaction obligations and UI/UX evidence floor that constrain that
comparison are recorded in [UX-RECOVERY.md](UX-RECOVERY.md).
