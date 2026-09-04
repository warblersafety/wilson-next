# Wilson Experiment 1 proposal: multi-product correction and conflict

**Status:** Approved by Steve on 2026-09-04, including the doctor-first
verification amendment; implementation awaits deployment-preflight stack
approval

**Prepared:** 2026-09-04

**Depends on:** `ARCHITECTURE-PROPOSAL.md` and `VERIFICATION-STRATEGY.md`

## Executive summary

The first experiment will put the proposed design under pressure using one
realistic but entirely fictional report. The case includes two suspected
medicines, another medicine that is not suspected, a dose that is corrected
later, and two sources that disagree about a treatment date.

The user will describe the case naturally, check what Wilson understood,
answer one useful question, make the correction, review the disagreement, and
choose which date to use. Wilson will then show how the reviewed information
appears in Form FDA 3500 and produce a downloadable PDF.

The experiment passes only if each medicine keeps the right details, every
important value can be traced to what the user said, the correction appears
everywhere, the unresolved date stays out of the form, and the final PDF agrees
with the reviewed case. A serious failure stops the work and reopens the design
decision instead of being hidden with a local patch.

This is intentionally not a complete Wilson release. It does not cover devices,
reporter entry, saved cases, every form path, or real clinical data. It is a
small end-to-end test of the hardest architectural assumptions, conducted in a
real browser before the product is allowed to expand. As soon as its minimum
integrity checks pass, one physician will use the synthetic journey and provide
the experiment's most important early product feedback.

## Purpose

Build the smallest production-shaped browser journey that can falsify the
proposed semantic case, write boundary, and UI composition under the failure
pressure that broke legacy Wilson.

The experiment covers one adult drug-report slice containing two suspect
medicines, one concomitant medicine, one correction, and one unresolved date
conflict. It crosses natural input, model proposals, clinician review, one
follow-up, correction, conflict resolution, Form 3500 inspection, and PDF
download.

It is not a general Form 3500 release or a formal clinician-usability study. It
does include one formative physician session to decide what Wilson should do
next.

## Dominant risk

The dominant risk is **reviewable information density with correct entity
identity**. Wilson must show enough structure and evidence for the clinician to
catch a wrong product attachment or interpretation without recreating a PDF
field walk.

The experiment asks:

1. Can similar products and their attributes stay distinct through extraction,
   correction, review, and output?
2. Can the clinician confirm or correct Wilson's interpretation using case
   concepts and exact source excerpts?
3. Can incompatible evidence remain visible without either value silently
   reaching the PDF?
4. Do the review and downloaded form agree at one case revision?

Questions about accounts, persistence, devices, general conversation, and
system-failure recovery do not help discriminate this risk and are deferred.

## 80/20 boundary

### Included

- one adult patient;
- an adverse-event report;
- exactly two suspect drug products and one concomitant drug product;
- the patient, event, treatment, outcome, and product facts supplied by the
  fixed narrative;
- one authored semantic follow-up about the suspect products' indications;
- one later natural-language update containing both a correction and a date
  contradiction;
- explicit conflict resolution;
- semantic projection into supported parts of Form FDA 3500 Sections A, B, D,
  and F;
- one pre-implementation visual checkpoint comprising four annotated,
  realistic static mockups of the fixed journey;
- a browser review, PDF preview, and PDF download; and
- one deployed synthetic-only operator run plus a four-run real-model smoke
  sample; and
- one observed physician session using synthetic information after the minimum
  doctor-ready evidence passes.

### Deferred

- reporter-entry UI and Section G completion;
- devices and Section E;
- product-problem-only, medication-error-only, pregnancy, congenital, death,
  no-patient, and more-than-two-suspect-product journeys;
- New case behavior and session recovery;
- model-generated questions or a general follow-up planner;
- a browser-level model or PDF failure branch;
- a second viewport, mobile layout, and a browser matrix;
- a broad accessibility audit beyond semantic HTML, labels, focus, and keyboard
  operation;
- accounts, collaboration, FDA submission, analytics, or durable storage; and
- a multi-participant usability study or general clinician-preference claim.

The visual checkpoint is a design artifact, not a coded prototype. It does not
authorize production components, a clickable flow, responsive variants, or
visual treatment for states outside this experiment.

The UI identifies the experiment's limited coverage before input. Unsupported
content is not accepted as supported, approximated, or silently dropped. Blank
unsupported form sections remain visibly explained.

## Research basis

- AHRQ says health IT testing should use scenarios and participants that match
  clinical reality and reports that early pilot testing can reveal workflow and
  information-overload problems missed by component design. See
  [Clinical Practice Improvement and Redesign](https://digital.ahrq.gov/key-topics/clinical-decision-support/clinical-practice-improvement-and-redesign-how-change-workflow-can-be-supported-clinical-decision)
  and [Health IT for Improved Chronic Disease Management](https://digital.ahrq.gov/health-it-improved-chronic-disease-management).
  This supports the assembled journey while limiting what an operator-only run
  can prove.
- AWS's [hexagonal testing guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/improve-software-quality.html)
  recommends a known-input/expected-output end-to-end scenario alongside
  focused domain and adapter tests. The experiment follows that small evidence
  pyramid rather than relying on either browser testing or unit tests alone.
- NIST identifies confident confabulation as a material generative-AI risk,
  including false healthcare summaries, and calls for explicit human/AI roles
  and measured human oversight. See the
  [Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  and [Human-AI Interaction guidance](https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/).
- Research on [evidential closure](https://aclanthology.org/2023.emnlp-main.192/)
  and [evidence extraction for review](https://aclanthology.org/2024.fever-1.24/)
  supports grounding proposed claims in source text. A human study found that
  people can over-rely on convincing but incorrect model explanations. See
  [Large Language Models Help Humans Verify Truthfulness—Except When They Are Convincingly Wrong](https://aclanthology.org/2024.naacl-long.81/).
  Wilson therefore shows exact clinician excerpts, not model rationales or
  confidence scores, and requires active review.
- Microsoft's validated [Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/articles/guidelines-for-human-ai-interaction-eighteen-best-practices-for-human-centered-ai-design/)
  call for efficient correction and for scoping AI behavior when the system is
  uncertain. Google's [Feedback and Control](https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/)
  guidance likewise recommends balancing automation with user control. This
  supports one efficient case-level review while reserving mandatory decisions
  for flagged knowledge.
- Google's [Explainability and Trust](https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/)
  guidance recommends explanations at the point they affect a decision and
  progressive disclosure for additional detail. The evidence treatment keeps
  compact source cues available and expands exact excerpts when risk warrants
  attention.
- Human-factors research warns that generative AI can replace productive work
  with burdensome evaluation and interruptions. See
  [Ironies of Generative AI](https://www.microsoft.com/en-us/research/publication/ironies-of-generative-ai-understanding-and-mitigating-productivity-loss-in-human-ai-interaction-2/).
  Wilson therefore does not require a separate approval click for every
  ordinary semantic group.
- The [NHS question-page pattern](https://service-manual.nhs.uk/design-system/patterns/question-pages)
  says every question needs a reason and related questions should be grouped
  only when user research supports it. The two-indication question is a
  hypothesis this experiment measures.
- FDA's current [Form 3500 instructions](https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500)
  distinguish suspect from concomitant products and use two suspect-product
  positions on the base drug form. The fixture exercises that identity boundary
  without requiring continuation forms.

## Fixed synthetic journey

All people, identifiers, events, and clinical details below are fictional.

### Opening account

> Patient TEST-57 is a 57-year-old woman. She was taking apixaban 5 mg by mouth
> twice daily; I recorded the start as 12-Aug-2026. She also took naproxen 500
> mg by mouth twice daily starting 10-Aug-2026, and lisinopril 10 mg by mouth
> daily as a concomitant medicine. On 18-Aug-2026 she developed melena and
> dizziness and was hospitalized. Her hemoglobin was 7.8 g/dL. Apixaban and
> naproxen were stopped, she received two units of packed red cells, and she
> recovered and was discharged on 21-Aug-2026. I suspect apixaban and naproxen.

### One consequential follow-up

The opening account does not state why the suspect products were used. Wilson
may ask one authored group:

> What was apixaban being used for, and what was naproxen being used for?

Fixture answer:

> Apixaban was for postoperative VTE prophylaxis after knee replacement.
> Naproxen was for postoperative pain.

The experiment records whether combining these two closely related asks is
clear or causes wrong-product attribution. A confusing result reopens the copy
and composition; it does not justify a general question engine.

### Combined correction and contradiction

> Correction: the naproxen dose was 250 mg twice daily, not 500 mg twice daily.
> Also, the medication administration record lists apixaban starting
> 13-Aug-2026, but my note says 12-Aug-2026. I can't resolve that yet.

The active naproxen dose must become 250 mg everywhere while 500 mg remains
visible only as superseded history. Both apixaban date statements remain
visible with their excerpts, but neither becomes resolved or reaches the first
PDF projection.

### Conflict resolution

The operator selects the medication administration record and confirms:

> Use 13-Aug-2026 as the apixaban start date.

The next case revision, review, and projection use 13-Aug-2026. The 12-Aug
statement remains traceable but inactive.

## Expected semantic result

| Entity | Required result |
|---|---|
| Patient | `TEST-57`; age 57 years; female |
| Event | melena and dizziness; onset 18-Aug-2026; hospitalization; hemoglobin 7.8 g/dL; transfusion; recovered; discharge 21-Aug-2026 |
| Suspect product 1 | apixaban; 5 mg; twice daily; oral; indication attached to apixaban; resolved start 13-Aug-2026 after explicit resolution |
| Suspect product 2 | naproxen; corrected 250 mg; twice daily; oral; start 10-Aug-2026; indication attached to naproxen |
| Concomitant product | lisinopril; 10 mg; daily; oral; never promoted to suspect |
| Evidence | every material result points to the exact account, answer, correction, or resolution supporting it |
| Supersession/conflict | naproxen 500 mg is inactive; both apixaban dates remain traceable; no apixaban start date is active before resolution |

The oracle must not encode a Wilson causality judgment. The clinician's phrase
`I suspect` supplies product roles for the report.

## Browser composition hypothesis

Primary form factor: keyboard-and-mouse desktop or laptop, current stable
Chromium at 1440 x 900 CSS pixels.

```text
+-----------------------------------------------------------------------+
| Wilson                  Synthetic experiment                 Status   |
+-----------------------------------+-----------------------------------+
| Active task                       | Case so far / needs attention     |
|                                   |                                   |
| Describe, check, answer, or       | Patient                           |
| resolve one focused item          | Event                             |
|                                   | Suspect products as separate cards|
| Compact evidence; full source     | Other products                    |
| expands when attention is needed  |                                   |
+-----------------------------------+-----------------------------------+

Output stage only:
+-----------------------------------+-----------------------------------+
| Included / not included /         | Form FDA 3500 preview             |
| needs resolution                  |                                   |
+-----------------------------------+-----------------------------------+
```

The review surface presents the patient, event, each suspect product, and other
products together as semantic groups. Every group has clear `Change` and
`Remove` actions. Ordinary, unflagged groups do not require five separate
confirmation clicks: after scanning the whole understanding, the clinician uses
one `Continue with this understanding` action.

A specific decision remains mandatory for a conflict, material uncertainty,
role ambiguity, correction, or rejection. The overall continue action cannot
silently accept or resolve one of those flagged items. This is risk-directed
review, not a blanket `Accept all` shortcut.

Each group shows a compact source cue with its full exact clinician excerpt
available on demand. Evidence opens automatically for conflicts, corrections,
or materially uncertain proposals. Wilson does not show a model rationale or
confidence percentage. Corrected and resolved knowledge is visually primary;
superseded history is available but quieter.

The output view groups supported values as `Included`, `Not included`, and
`Needs resolution`. Before the date conflict is resolved, it says the apixaban
start date will be left blank. Section G and other unsupported content are
visibly identified as outside the experiment rather than described as unknown.

This composition is authoritative only for the fixed journey and viewport.

### Pre-implementation visual checkpoint

Before browser implementation, four annotated 1440 x 900 mockups use the exact
synthetic fixture rather than placeholder copy:

1. `Describe`: the populated natural-language case account and the limited
   experiment boundary;
2. `Check understanding`: the five semantic groups, compact evidence cues,
   per-group change controls, and one case-level continue action;
3. `Correct and resolve`: the naproxen dose correction and the unresolved
   apixaban date conflict with automatically expanded evidence; and
4. `Inspect output`: included, omitted, and needs-resolution material beside
   the Form 3500 projection.

The proposed screens and their review annotations are in the
[visual checkpoint](docs/visual-checkpoint/README.md).

Annotations identify the intended action, information hierarchy, retained or
rejected legacy-Wilson ideas, and behavior that a static image cannot prove. A
short cognitive walkthrough asks: what would the clinician do next, what does
Wilson currently believe, what requires attention, how would the clinician
correct it, and what will reach the form?

The checkpoint settles only the composition needed for this experiment. It does
not claim measured time savings, workload reduction, accessibility conformance,
or clinician preference; those require the running journey and representative
use.

## Browser trace

The fixed journey traverses these states:

1. `Describe`, including the populated narrative and extraction loading state;
2. `Check understanding`, with five semantic groups and exact evidence;
3. the single indication question and answer;
4. the combined correction/contradiction update, followed by a review showing
   the corrected dose and unresolved date conflict;
5. pre-resolution output inspection with the date omitted and explained;
6. explicit resolution to 13-Aug-2026 and the updated review/projection; and
7. successful PDF download.

Backward editing is allowed. Retain the browser trace and screenshots only for
the understanding, unresolved-conflict, and final-output states; the other
steps need to work but do not each need a separate evidence artifact.

## Model smoke sample

Run no more than four complete paired-input samples—each containing the opening
account and combined update—or spend USD 5 total, whichever comes first.
Disable automatic retries and record model identifier, parameters,
prompt/schema revision, token use, latency, and cost.

Only the fixed synthetic text may be sent. A human reviewer scores every sample
against the semantic oracle and checks that each excerpt actually supports the
value and entity relationship. JSON-schema validity, an existing span offset,
or model confidence cannot pass a sample by itself.

Smoke-sample gates:

- zero invented material facts;
- zero wrong-product or wrong-role attributions;
- every proposed material value has supporting text; and
- all oracle facts needed for the supported projection are proposed in every
  run.

A failure stops expansion and reopens the model schema, prompt, model choice,
or responsibility boundary. Passing permits this experiment to continue but
makes no general reliability claim.

## Minimum evidence

The experiment is incomplete without:

- the focused critical tests named in `VERIFICATION-STRATEGY.md`;
- one fixed headless-browser journey using the fake model;
- one operator completion of the same journey through the deployed browser at
  1440 x 900 using the real model;
- an inspectable browser and command trace sufficient to diagnose the journey,
  plus screenshots of the three discriminating states;
- a visual PDF check and programmatic comparison of supported PDF values and
  checkboxes with the semantic projection;
- the four-run-or-USD-5 model report; and
- an operator smoke-test verdict; and
- brief observations and feedback from one physician using the synthetic
  journey.

The browser uses semantic HTML, programmatic labels, visible focus, and a
keyboard-operable main path. Broader accessibility testing is deferred.

For the operator run, record unaided completion, visible errors, important path
deviations, proposal corrections, and whether the planned question repeated
known information. For the physician session, retain concise observations and
their own feedback. Do not turn one person's response into a general usability
or preference claim.

## Success and stopping criteria

The experiment passes only if:

1. Every case write uses the authoritative command boundary.
2. Every expected fact survives with the correct entity, role, and source.
3. Naproxen 250 mg replaces 500 mg in review and PDF; 500 mg remains only as
   superseded history.
4. Neither apixaban date reaches the PDF while conflicted; explicit resolution
   updates review and projection together.
5. Wilson asks only the one planned indication group and does not repeat known
   information.
6. No user-visible surface exposes widget IDs, internal fact names, enums,
   record paths, prompts, or model payloads.
7. The semantic projection and downloaded PDF agree for every supported value,
   and all unsupported or omitted content has a truthful explanation.
8. The composition remains understandable with the full realistic content and
   conflict.
9. Unflagged groups can be reviewed without repetitive confirmations, while
   every flagged conflict, correction, or material uncertainty still requires
   an explicit decision.
10. The model smoke sample passes its gates.
11. Operator review finds no severe reason to withhold the synthetic preview
    from the physician.
12. One physician exercises the journey and their observations and feedback are
    recorded as the input to the next product decision.

Immediately stop and classify the owning premise if there is silent loss,
invention, reversal, wrong-entity attribution, a bypassed invariant, a hidden
conflict, or disagreement between case and PDF. Also stop if:

- domain behavior must inspect PDF widget identifiers;
- correction or conflict requires UI-specific write logic;
- a view maintains its own authoritative values;
- the grouped indication question causes product confusion; or
- unsupported content is silently accepted.

The experiment ends after the physician feedback review whether it passes or
fails. It does not expand automatically into deferred features. A technical
pass cannot overrule feedback that the direction is confusing or not useful;
that feedback determines whether to continue, revise, or stop.

An experiment pass is architecture evidence plus formative product feedback,
not clinician usability proof. Before making a broader clinician-facing claim,
the fixture and oracle require appropriate domain review and later evidence must
include more than this single formative session.

## Retention and disposal

- Retain the synthetic fixture, oracle, source revision, tests, screenshots,
  trace, model summary, cost, operator verdict, and concise physician-session
  notes as repository evidence.
- Do not retain credentials, raw infrastructure logs, browser storage, or
  deployed ephemeral case state.
- Remove the protected preview after review unless continued access is
  explicitly approved.
- A passing implementation remains an experiment until separately accepted as
  the production seed.
- Retain a failed branch or commit as falsified evidence; do not merge it into
  the production line.
- Copy nothing into legacy Wilson or Nightjar.

## Approval gate

Implementation may begin only after explicit approval of:

1. the simplified architecture;
2. this fixed journey, four-screen visual checkpoint, composition, and
   supported/deferred boundary;
3. the model/provider and synthetic-only retention boundary;
4. the preview host and access control;
5. the success, stopping, and disposal criteria; and
6. the evidence contract in `VERIFICATION-STRATEGY.md`; and
7. the experiment stack selected during the deployment preflight.

Until then these proposal documents are the only authorized changes for this
phase.

### Approval record

On 2026-09-04, Steve approved the simplified architecture, fixed journey,
supported/deferred boundary, four-screen visual checkpoint and composition,
model/provider responsibility and synthetic-only retention boundary, and the
success, stopping, and disposal criteria. The exact framework, PDF library,
model provider, preview host, and access-control mechanism were deliberately
not selected in those proposals. Their deployment-preflight selection remains
the final technical decision required before implementation begins. The
verification strategy and doctor-first amendment were added as the evidence
checkpoint before that preflight. Steve approved both on 2026-09-04.
