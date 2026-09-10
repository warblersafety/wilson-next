# Issue #60 — Layer 1 medication stress probes

Layer 1 exercises three high-risk interactions inside the bounded adult
medication adverse-event path. Application-model responses were predetermined;
the run made 14 predetermined calls and zero live calls. The Experiment 1 and
Experiment 2 journeys ran in the same assembled cohort as regressions.

## Risk matrix and predetermined outcomes

| Journey | Risk under test | Predetermined input variation | Expected adaptive behavior | Stop condition |
|---|---|---|---|---|
| Conditional death detail | A parent outcome can be retained while only its dependent detail remains open | Death stated; death date omitted; indication, one relevant test, and absence of other history stated | Preserve death, ask only unresolved outcome flags, then ask date of death, then collect reporter details directly | Lost death, unconditional date question, duplicate indication/context question, or PDF disagreement |
| Multiple tests with correction | Repeated entities can merge or a correction can hit the wrong row | Three tests with range/date variation; later ALT-only correction | Keep three stable test identities, propose the correction, supersede only old ALT, and reopen no completion group | Merge, duplication, wrong attribution, silent overwrite, or stale ALT in PDF |
| Role correction creates applicability | A correction can change which follow-up is materially applicable | One suspect and one concomitant product; later concomitant-to-suspect correction | Preserve both product identities, reopen only the newly applicable acetaminophen indication, and move that product from Section F to D | Repeated earlier groups, identity replacement, missing indication, or product left in Section F |

The synthetic narratives, predetermined proposal envelopes, and evaluation
oracles live under `tests/e2e`; none are reachable from runtime behavior.

## Result: Proceed

All three journeys reached reviewed output with zero duplicate questions.

- `layer1-death` used three grouped prompts: remaining serious outcomes, the
  now-applicable date of death, and reporter details. The terminal semantic
  case retained death `true`, recorded `2026-09-07`, retained one accepted
  biopsy result, and recorded exactly those three asked needs.
- `layer1-tests` used one grouped prompt for reporter details plus one explicit
  correction review. Its three stable test IDs survived unchanged. ALT changed
  from `132 U/L` to `123 U/L` with the old value in superseded history; AST and
  bilirubin were unchanged. No completion group reopened.
- `layer1-role` used one reporter prompt, one explicit correction review, and
  one newly applicable indication prompt. The acetaminophen product kept its
  ID, its former concomitant role moved to superseded history, and the final
  case contained two suspect products and no concomitant product.

`journey-trace.json` contains the ordered questions, reasons, answers,
terminal-state assertions, interaction counts, and observed friction. The
largest unavoidable burden was the structured reporter block. The correction
journeys each added one review decision; only the role correction added a new
completion answer.

## Root-cause gate

The first assembled run found one coarse failure: the semantic case and browser
projection accepted the common regimen “every six hours,” but PDF generation
rejected it because the adapter recognized only `Daily` and `BID`. This was a
projection-adapter vocabulary gap, not a conversation-policy or identity
failure.

The bounded remediation keeps the semantic value unchanged and translates the
small standard set supported by the pinned form (`Daily`, `BID`, `TID`, `QID`,
`HS`, and `PRN`) only at the PDF boundary. Other frequencies use the pinned
form's own `Other` selection and companion text field, so this journey carries
the exact text “every six hours.” A focused adapter test verifies both the
semantic round trip and independent dropdown/text values. No domain,
completion-policy, or model-boundary design changed.

Two earlier interruptions were evidence-harness selector/build-order issues;
neither represented product behavior and neither caused runtime changes. After
the adapter remediation, the complete cohort passed without another product
failure. This supports `Proceed` to Layer 2 rather than `Revise` or `Stop`.

## Browser and PDF agreement

`pdf-agreement.json` records independent pypdf 6.16.2 readback, byte length,
and SHA-256 for all three Layer 1 PDFs and all retained regressions. Each was an
unencrypted eight-page document.

- Death: the independent readback contains the checked death field and
  `07-SEP-2026` date.
- Tests: the readback contains corrected ALT `123 U/L`, unchanged AST and total
  bilirubin rows, and does not contain superseded ALT `132 U/L`.
- Role: Sections D #1 and #2 contain warfarin and acetaminophen respectively,
  acetaminophen carries indication `headache`, frequency selection `Other`, and
  exact frequency text `every six hours`, and the
  Section F concomitant slot is absent.

`layer1-role-output.png` is the representative 1440-by-900 Chromium output.
`layer1-role.pdf` and `layer1-role-pdf-page-{1,3,4,5,6}.png` are the retained
representative PDF and independent PDFKit renders. Visual inspection confirmed
the official FDA/MedWatch identity and layout, the patient/event/test values,
both Section D suspect products, and an empty Section F product list.

## Verification

```text
npm run typecheck
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test
npm run build
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm run test:e2e
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python WILSON_RETAIN_STAGE3_EVIDENCE=1 WILSON_STAGE3_EVIDENCE_DIRECTORY=evidence/issue-60 npm run test:e2e
clang -fobjc-arc -framework Foundation -framework AppKit -framework PDFKit tools/pdf/capture_issue_60_rendering.m -o /tmp/wilson-capture-issue-60 && /tmp/wilson-capture-issue-60
```

## Still unsupported

This layer does not add device or product-problem paths, pediatric cases, a
complete Form 3500 ontology, arbitrary medication-frequency or route mappings,
persistence, production infrastructure, real clinical data, or direct FDA
submission. It does not revisit Issue #55 or make any live application-model
call. Under tracker #59, Layer 2 should next probe one information-rich device
adverse event and one sparse product-quality report in its own bounded issue;
Issue #60 does not authorize that expansion.
