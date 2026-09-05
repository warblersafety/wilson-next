# Slice 2 assembled-journey evidence

This directory retains only synthetic evidence from the approved fixed journey.
No model call, credential, real clinical data, deployed case, or production
artifact is present.

The deterministic Playwright run uses Chromium at 1440 × 900 and drives the
real route, temporary repository, command, view, semantic projection, PDF
adapter, preview, and download paths. It establishes:

- three distinct products with two suspect roles and one concomitant role;
- one authored indication question and no repeat;
- explicit acceptance of naproxen 250 mg with 500 mg retained only in history;
- both apixaban dates visible while neither reaches the conflicted projection;
- explicit selection of 13-Aug-2026 updating review, preview, and PDF together;
- disabled pre-resolution download and successful final download; and
- visible supported, unresolved, blank, and deferred output explanations.

`understanding.png`, `unresolved-output.png`, and `final-output.png` retain the
three useful interaction states named by the experiment. `journey-trace.json`
is a sanitized checkpoint trace: it records the seven verified states without
retaining cookies, browser storage, request bodies, or page snapshots.
`checked-form.pdf` is the downloaded official-form output, and
`journey-result.json` records its checksum and run shape. `pdf-page-1.png`
through `pdf-page-6.png` and
`pdf-rendering-result.json` retain the Chromium rendering inspection for every
supported form section.

The official FDA instructions were retrieved from the authoritative URL on
2026-09-05. They specify DD-MMM-YYYY dates, two suspect-product rows in Section
D, and concomitant products in Section F. Inspection of the versioned form
shows that Section F supports product name and therapy dates, not concomitant
dose, frequency, or route; those facts remain in reviewed case knowledge and
are truthfully identified as not included in the PDF.

Regenerate after a production build with:

```text
PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test
npm run build
WILSON_RETAIN_EVIDENCE=1 npm run test:e2e
npm run evidence:slice2:pdf-render
```

The browser test writes retained artifacts only when
`WILSON_RETAIN_EVIDENCE=1`; ordinary CI keeps transient test output outside this
directory.
