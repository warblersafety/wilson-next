# Issue #62 — Layer 2 device and product-quality generalization

Layer 2 exercises the first two report/product paths beyond the bounded adult
medication adverse-event flow: one information-rich device adverse event and
one sparse product-quality-only report. Application-model responses were
predetermined; the retained assembled run made 16 predetermined calls and zero
live calls. All Experiment 1, Experiment 2, Issue #57, and Layer 1 journeys ran
in the same cohort as regressions.

## Risk matrix and predetermined outcomes

| Journey | Risk under test | Predetermined input variation | Expected adaptive behavior | Stop condition |
|---|---|---|---|---|
| Information-rich device adverse event | The medication-shaped product and projection seams may misclassify or lose a device | One pump with brand/common name, manufacturer, model, lot, serial, UDI, operator, implant applicability, reprocessing/service status, and availability; rich event/outcome/context facts | Keep one stable suspect product with reviewed device category, ask only for reporter details, project event/availability to B/C and device facts to E, and leave D/F empty | Wrong category/entity attribution, medication-only question, device facts in D, or PDF disagreement |
| Sparse product-quality report | Completion may invent an adverse event/patient or interrogate adverse-event gaps | Product problem selected; no administration or adverse event; only product name, lot, visible defect, and availability supplied | Preserve empty patient facts and explicitly absent symptoms, ask only for reporter details, project problem/availability to B/C and the non-device suspect to D, and leave E empty | Invented patient/event, adverse-event or indication question, unavailable partial output, or PDF disagreement |

The fictional narratives, predetermined proposal envelopes, and evaluation
oracles live under `tests/e2e`; runtime behavior cannot import them.

## Result: Proceed

Both journeys reached reviewed output with zero duplicate questions.

- `layer2-device` retained one stable device ID and the reviewed device category,
  inapplicable implant date, non-reprocessed status, no third-party service, and
  all named Section E identifiers. Accepted outcome and context facts suppressed
  every clinical follow-up; only the direct reporter block remained.
- `layer2-product-quality` left patient facts empty, retained symptoms as
  explicitly absent, selected only the product-problem report type, and kept the
  named non-device product and lot in Section D. It asked no indication,
  serious-outcome, or clinical-context question; only the reporter block
  remained.

`journey-trace.json` records ordered questions/reasons, semantic checkpoints,
prompt counts, duplicate counts, and observed friction. Each new journey used
one grouped prompt after understanding review: the structured reporter block.

## Root-cause gate

The first assembled run exposed one ordinary application request-schema defect:
the UI and journey service supported product-problem selection, but the API
request boundary still admitted only `adverse-event`. The request was rejected
before any proposal or case write, so no knowledge was lost or mutated. The
bounded remediation extends that existing report-type enum at the same API
boundary and is covered by the passing assembled product-quality journey.

A later failure was evidence-harness-only: the independent readback assertion
looked for a substring even though field-value comparison is exact. The oracle
now checks the complete semantic narrative emitted to the PDF. This changed no
runtime behavior. No semantic representation, identity, command-boundary,
completion-policy, projection, or PDF-adapter failure remained after the API
schema fix.

## Browser and PDF agreement

`pdf-agreement.json` records independent pypdf 6.16.2 readback, byte length,
and SHA-256 for both Layer 2 PDFs and every retained regression. Each is an
unencrypted eight-page document.

- Device: the adverse-event and availability boxes are selected; patient/event
  content agrees; Section D is empty; Section E contains Acme FlowGuard,
  infusion pump, manufacturer, model, lot, serial, UDI, healthcare-professional
  operator, not-reprocessed, and not-third-party-serviced values.
- Product quality: the product-problem and availability boxes are selected;
  no patient or adverse-event value appears; the exact problem narrative and
  Cardiovex name/lot appear in Sections B and D; Section E is empty.

`layer2-device-output.png` is the representative 1440-by-900 Chromium output.
`layer2-device.pdf` and `layer2-device-pdf-page-{1,2,3,4,6,7}.png` retain the
representative official-form checkpoint. PDFKit inspection confirmed form
identity/layout and agreement across Sections A, B, C, E, and G, with Section D
empty.

## Verification

```text
npm run typecheck
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test
npm run build
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm run test:e2e
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python WILSON_RETAIN_STAGE3_EVIDENCE=1 WILSON_STAGE3_EVIDENCE_DIRECTORY=evidence/issue-62 npm run test:e2e
clang -fobjc-arc -framework Foundation -framework AppKit -framework PDFKit tools/pdf/capture_issue_62_rendering.m -o /tmp/wilson-capture-issue-62 && /tmp/wilson-capture-issue-62
```

## Still unsupported

This layer does not add multiple devices, combined adverse-event/product-problem
reports, conditional device-detail questions, device correction or uncertainty,
medication-error reports, product pictures/comments, a complete Form 3500
ontology, persistence, production infrastructure, real clinical data, or direct
submission. It does not revisit Issue #55 or make a live application-model call.
The evidence supports `Proceed` to Layer 3's bounded device-depth cohort under
tracker #59, after this layer receives independent review and Steve's manual
approval and merge.
