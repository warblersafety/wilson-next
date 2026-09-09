# Experiment 2 Stage 3 deterministic assembled evidence

Captured 2026-09-09 from the production build on Issue #51's branch through
one headless desktop Chromium 153.0.8010.12 path at 1440 × 900.

The path used seven predetermined responses through the ordinary model
boundary and made no live application-model calls. It completed the rich,
sparse, and repeated-product Experiment 2 journeys, exercised generic Change
and Remove controls, and completed the retained Experiment 1 semantic
regression. Expected values and response fixtures remained under `tests/e2e/`;
runtime product behavior did not import them or branch on their cases,
medicines, values, or sequence.

`journey-trace.json` records the browser checkpoints. The four screenshots show
the final reviewed screen and same-revision form preview for each evaluation
case. The four PDFs are the browser downloads. `pdf-agreement.json` records
their SHA-256 digests and complete independent pypdf 6.16.2 field readbacks.
The browser assertions compared the visible case and preview with the external
journey expectations, while the independent readback confirmed the projected
PDF values and the omission of both unresolved repeated-product dates.

Commands:

```text
npm run typecheck
PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test
npm run build
PYPDF_PYTHON=.venv-pdf-evidence/bin/python WILSON_RETAIN_STAGE3_EVIDENCE=1 npm run test:e2e
```

The accepted Stage 2 evidence-context limitation did not become practically
important in this deterministic assembled path: the repeated-product conflict
screen presented each subject, value, and supporting excerpt together without
wrong attribution. This does not upgrade the qualified Stage 2 model result or
authorize live, clinical, or production use.
