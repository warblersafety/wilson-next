# Issue #64 — Layer 3 device depth

Layer 3 exercises three bounded single-device paths beyond Layer 2: a combined
adverse-event/product-problem report, conditionally applicable Section E
details, and a later correction plus unresolved alternative with truthful
partial output. Application-model responses were predetermined. The assembled
cohort made 20 predetermined calls and zero live calls while retaining every
deterministic journey through Layer 2 as a regression.

## Risk matrix and predetermined outcomes

| Journey | Risk under test | Predetermined variation | Expected adaptive behavior | Stop condition |
|---|---|---|---|---|
| Combined device report | A single-valued report-type seam may lose one of two clinician selections or the PDF adapter may check only one box | One suspect device with both an adverse event and product problem, accepted event/outcome/context/device facts, and availability | Retain one stable device and one reviewed combined report-type value, keep adverse-event completion applicable, ask only for reporter details, and project both Section B boxes plus Sections C/E | Lost report meaning, wrong entity, redundant clinical/device question, or only one PDF box selected |
| Conditional device details | Optional Section E fields may be interrogated unconditionally or omitted after their prerequisite becomes true | Product-problem-only suspect device with accepted implanted and reprocessed-single-use status but missing implant/explant dates and reprocessor identity | Ask one grouped device-detail turn, accept known implant date, inapplicable explant date, and named reprocessor through `applyCaseCommand`, then ask reporter details once | Question without an accepted prerequisite, missing applicable question, loop after unknown/inapplicable/declined, or PDF disagreement |
| Device correction and uncertainty | Later model input may create a second device, overwrite history, or project incompatible alternatives | Product-problem-only device followed by a serial-number correction and an unresolved model-number alternative against its application-supplied ID | Preserve one device ID, supersede the old serial, keep both model alternatives visibly conflicted, omit the model from projection, and leave partial output enabled | New device identity, lost supersession, hidden conflict, either model value in PDF, unavailable partial output, or repeated completion question |

The fictional narratives, predetermined proposal envelopes, and detailed
evaluation oracles live under `tests/e2e`; runtime behavior cannot import them.

## Result: Proceed

All three journeys reached reviewed output with zero duplicate questions.

- `layer3-combined` preserved one suspect device, both report meanings, the
  product problem, adverse event, availability, patient-operated status, and
  all supported identifiers. Accepted outcomes and context suppressed every
  clarification except direct reporter entry.
- `layer3-conditional` derived one question from accepted implanted and
  reprocessed-single-use states. The answer recorded an implant date, an
  inapplicable explant date, and `ReNew Medical LLC` as reprocessor through the
  existing command boundary. Only the reporter block followed.
- `layer3-correction` retained one opaque device ID. `SN-1002` superseded
  `SN-1001`; `NS-7` and `NS-8` remained unresolved alternatives, neither model
  number projected, and preview/download stayed available.

`journey-trace.json` records ordered questions/reasons, semantic checkpoints,
prompt counts, duplicate counts, and observed friction. The combined and
correction journeys each used one grouped prompt after understanding review:
the structured reporter block. The conditional journey used two: one grouped
device-detail turn and the reporter block. The correction journey also
required two explicit update reviews because its correction and alternative
targeted different facts.

## Root-cause gate

The pre-implementation domain audit exposed two lowest-owning representation
gaps required by the planned cohort. Report type admitted only one of the two
Form 3500 meanings, and device facts had no explicit implanted status from
which date applicability could be derived. The bounded remediation adds one
combined report-type value and one semantic implanted fact. Both remain
ordinary reviewed facts, and both use the existing source, proposal, command,
browser-state, projection, and review boundaries. The combined value maps to
two form checkboxes; implanted status determines questions but is not itself a
PDF field. No generic rules engine or device ontology was added.

The first focused PDF run then exposed one projection-adapter readback defect:
the writer selected both checkboxes, but its internal verification read the
adverse-event box first and reported only that meaning. The adapter now detects
the two checked boxes as the combined semantic value. Independent pypdf
readback confirms both named checkbox widgets are selected.

The first assembled run exposed one evidence-harness-only mismatch: the oracle
looked for a symptom substring even though independent field comparison is
exact. It now checks the complete semantic narrative emitted to the PDF. This
changed no runtime behavior. No semantic identity, authoritative command,
completion-policy, model-boundary, interaction, projection, or PDF-adapter
failure remained after these bounded fixes.

## Browser and PDF agreement

`pdf-agreement.json` records independent pypdf 6.16.2 readback, byte length,
and SHA-256 for every Layer 3 journey and retained regression. Each PDF is an
unencrypted eight-page document.

- Combined: both adverse-event and product-problem boxes are selected; the
  complete event/problem narrative, availability, patient information, and
  single device agree across Sections A, B, C, and E.
- Conditional: product-problem and availability boxes are selected; Section E
  contains implant date `12-AUG-2026`, reprocessed `Yes`, and `ReNew Medical
  LLC`, while explant date remains empty as reviewed.
- Correction/uncertainty: Section E contains corrected serial `SN-1002`; the
  superseded serial and both unresolved model alternatives are absent.

`layer3-correction-output.png` and `layer3-correction.pdf` retain the
representative 1440-by-900 Chromium checkpoint and official form. The retained
PDF is 1,052,880 bytes with SHA-256
`6f0e5d73121b01e5a2e8bb45ead4fcb7d9ec6ea1acd51fe27c17114225059a9b`.

## Verification

```text
npm run typecheck
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test
npm run build
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm run test:e2e
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python WILSON_RETAIN_STAGE3_EVIDENCE=1 WILSON_STAGE3_EVIDENCE_DIRECTORY=evidence/issue-64 npm run test:e2e
```

## Still unsupported

This layer does not add multiple devices, concomitant-role device projection,
arbitrary device-detail questions, medication-error reports, product
pictures/comments, a complete Form 3500 ontology, persistence, production
infrastructure, real clinical data, or direct submission. It does not revisit
Issue #55, make a live application-model call, or reopen prior layers. The
evidence supports `Proceed` to Layer 4's bounded failure-and-recovery cohort
under tracker #59 after this layer receives independent review and Steve's
manual approval and merge.
