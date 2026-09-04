# Wilson UI/UX recovery checkpoint

**Status:** Confirmed recovery direction by Steve on 2026-09-04  
**Role:** Bounded bridge from the confirmed product definition to architecture  
**Scope:** Interaction and assembled-product safeguards, not final visual design

## Decision

UI/UX is an input to Wilson's architecture, not a skin applied after the domain
model and orchestration exist. The architecture comparison must therefore be
preceded and constrained by this checkpoint, and its first implementation
experiment must be an assembled browser journey rather than a headless core
that receives a UI later.

Mockups and design tokens may inform a design. Neither is acceptance evidence.
Wilson's UI/UX is acceptable only when realistic content, state transitions,
model behavior, correction, review, and form projection compose into an
experience a clinician could prefer to the direct form.

## 80/20 boundary

This checkpoint exists to remove the largest UI/UX risks without starting a
second design project before the architecture is known.

Do now:

- preserve the evidence-backed root causes and the interaction obligations they
  create;
- describe the minimum user-visible stages and difficult states that the
  architecture must support;
- make the authority and limits of future mockups, tokens, copy, and code
  explicit;
- require the first architectural experiment to expose its behavior through a
  real browser journey; and
- inspect the assembled journey early with realistic synthetic content and a
  small number of budget-capped real-model runs when model behavior matters.

Defer until a slice makes it necessary:

- a comprehensive component library or exhaustive design system;
- polished mockups for every Form FDA 3500 path and edge state;
- complete responsive optimization across every device class;
- visual refinement of surfaces the initial journeys do not reach; and
- exhaustive screenshot or browser matrices.

The ordinary slice budget remains risk-directed: roughly 10–20% for assembled
journey evidence is a working hypothesis, not a quota. More is warranted only
when the dominant risk is interaction or composition.

## What failed previously

### 1. Interaction design arrived after foundational machinery

Legacy Wilson made the PDF widget manifest its canonical record and built the
Agenda, exporter, field walker, and topic overlay before it specified the real
clinician interaction. The later dictation-first UI inherited those decisions.
It could disguise some field walking, but it could not remove the field model's
effects on questioning, correction, completeness, and review.

This is established in the recovered evidence indexed by the
[post-mortem review](POSTMORTEM-REVIEW.md) and in legacy Wilson
[issue #39](https://github.com/warblersafety/wilson/issues/39) and
[PR #46](https://github.com/warblersafety/wilson/pull/46).

### 2. The design inputs were asked to prove more than they specified

The supplied mockups were polished happy-path pitch renders. They showed a
small number of hand-written examples, but not realistic question volume,
checkbox-heavy topics, repeated entities, errors, empty states, uncertainty,
or other variable content that determined whether the interface worked.

The design system primarily supplied brand tokens such as color and type. It
did not fully specify composition, hierarchy, dynamic layout, or every product
state; the legacy design record itself noted that some of the mockups' visual
character lived in hand-tuned styles outside the token set. Token conformance
therefore could not establish visual fidelity or usability.

The historical source is the legacy
[design record](https://github.com/warblersafety/wilson/blob/fb00b1743200759321eb64abeba04237f8b12370/docs/design.md).

### 3. Design authority was fragmented

Mockups governed parts of layout, the design record governed interaction and
exceptions, a later ask-copy inventory governed language and coverage, the PDF
manifest supplied labels and completion machinery, and implementation units
made remaining composition choices. Each artifact could be followed locally
while the assembled experience remained incoherent.

The failure was not merely that a mockup or token was ignored. The project did
not define narrow, compatible roles for its design artifacts or one assembled
product judgment capable of resolving their output.

### 4. Verification measured surfaces and machinery before experience

The v1.1 rebuild had hundreds of tests, per-surface mockup comparisons, manual
browser passes, and a scripted end-to-end flow using a fake model. Its first
realistic deployed contact nevertheless exposed roughly 58–82 asks, generated
robotic wording, raw manifest labels, and visual composition that did not feel
like the intended canvas.

The evidence answered whether components conformed to their local contracts.
It did not answer whether realistic content and model behavior produced a good
session. See legacy Wilson
[PR #84](https://github.com/warblersafety/wilson/pull/84) and
[issue #87](https://github.com/warblersafety/wilson/issues/87).

### 5. The UI was downstream of product behavior that it could not repair

Question selection, information density, correction semantics, entity
identity, uncertainty, completion, and model wording all shape the user
experience. Treating them as backend concerns left the frontend responsible
for presenting behavior it did not control. Visual polish could not make a
58-question field walk feel like handing a case to a competent assistant.

## Minimum interaction contract

The confirmed journey has the following user-visible stages. These are stages
of work, not a requirement for one page per stage or a decision about layout.

1. **Describe:** the clinician enters a natural account by typing or using
   device-native dictation.
2. **Check understanding:** Wilson shows what it understood, including enough
   supporting context for the clinician to detect invention, loss, or
   misattribution before accepting it.
3. **Clarify:** Wilson asks a small number of consequential questions not
   already answered. The clinician may answer, qualify, decline, or state that
   something is unknown when those meanings apply.
4. **Review and correct:** the clinician reviews the case as clinical knowledge,
   not as PDF widgets, and can correct facts, entities, roles, uncertainty, or
   conflicts through the same authoritative write boundary.
5. **Inspect output:** Wilson shows how the reviewed knowledge projects into
   Form FDA 3500 and makes unsupported, omitted, or unresolved material visible
   without implying that optional blanks make the report invalid.
6. **Download or begin again:** the clinician downloads the form or starts a
   new blank case. Starting a new case may discard an unfinished case after a
   clear confirmation; there is no saved-case list or delete operation.

Movement need not be linear. Correction can return the experience to
clarification or review, and a model or export failure must leave an
understandable, recoverable state. The exact navigation, page composition,
form-preview placement, transcript visibility, and visual treatment remain
open design choices.

## Required difficult states

Architecture and early interaction design must not assume only a rich,
single-product happy path. The confirmed product journeys require the UI to
make these states intelligible:

- sparse and partial knowledge without an exhaustive interrogation;
- more than one product with attributes attached to the correct instance;
- a correction that visibly supersedes an earlier active value;
- material uncertainty or contradiction awaiting clinician resolution;
- the distinction among not asked, unknown, explicitly absent, inapplicable,
  and declined when that distinction affects the report;
- a visible model or output failure that does not silently lose accepted work;
  and
- an unfinished case being intentionally abandoned through **New case**.

The first slice need not implement every path. Its chosen journey must include
at least one non-happy-path state capable of discriminating the architecture.
Unsupported paths must be visible rather than silently approximated.

## Artifact authority

Future design artifacts have deliberately limited roles:

| Artifact | Authority | Does not prove |
|---|---|---|
| `PRODUCT.md` | Product promise, scope, journeys, and unacceptable outcomes | Exact composition or implementation |
| This checkpoint | Interaction obligations, architecture constraints, and evidence floor | Final pixels or a component API |
| Wireflow or mockup | A named composition hypothesis for named states and content | Unshown states, dynamic behavior, or usability |
| Design tokens/components | Reusable visual and interaction primitives | Whole-screen hierarchy or product fitness |
| Authored copy | Exact clinician-facing language where deterministic copy is appropriate | Correct question selection or case semantics |
| Running slice | Implemented behavior at a named source revision | Acceptance without assembled evidence and human review |

Any deliberate conflict or deviation is written back before it silently becomes
the new design. No screenshot is allowed to imply authority over states it does
not depict.

## Constraints on the architecture comparison

Candidate architectures must show how the UI can:

- query and present case-level facts and related entities without exposing PDF
  widget identifiers;
- distinguish model proposals from clinician-confirmed knowledge;
- show the evidence or deterministic reason supporting every material value;
- accept corrections, conflict resolutions, and derived changes through one
  unavoidable write boundary;
- calculate consequential follow-up needs from case semantics rather than all
  blank form fields;
- render conversation, review, and Form 3500 projection from one authoritative
  case state without contradictory values; and
- represent loading, rejection, model failure, and projection failure without
  inventing success or losing accepted knowledge.

An architecture that can pass headless examples but makes these user-visible
states awkward, duplicated, or path-specific has failed the comparison.

## Lean evidence for the first browser experiment

Before implementation, the experiment plan must name one deliberately
difficult synthetic journey, its dominant UI/UX risk, the states it traverses,
and its stopping criteria. A low-fidelity wireflow is created only to the extent
needed to settle composition and interaction questions for that journey.

During implementation, the minimum evidence is:

- focused invariant tests at the authoritative write boundary;
- one headless transcript-to-knowledge-to-output check;
- the same journey through the real browser UI with realistic content;
- a transcript or event trace plus screenshots of every user-visible state the
  journey actually traverses;
- a small budget-capped real-model sample when extraction, follow-up selection,
  or conversational behavior is in scope; and
- operator review of the deployed assembled journey before expanding the slice.

The review asks a few product questions, not a large generic checklist:

1. Did the clinician's stated knowledge survive intact and stay attached to the
   right entities?
2. Did every question earn its place, and was anything already known asked
   again without reason?
3. Could the clinician understand and correct Wilson's interpretation without
   learning implementation or form-field vocabulary?
4. Did composition, hierarchy, and copy remain coherent with realistic content
   in every traversed state?
5. Did the reviewed case and Form FDA 3500 projection agree?
6. Is there any reason a clinician would prefer the direct form?

Any severe failure on those questions stops expansion and reopens its owning
product, architecture, interaction, or visual premise. It is not converted
automatically into a local UI patch.

## Phase handoff

This checkpoint is complete enough to constrain architecture without
pretending the final interface is known. The next phase compares canonical
knowledge representations, write boundaries, and model responsibilities while
testing whether each can support this interaction contract.

No existing Wilson UI composition is approved for reuse. No framework,
component library, layout, or visual direction is selected by this document,
and no production implementation is authorized.
