# Slice 0 PDF compatibility evidence

**Verdict:** PASS for the TypeScript `@cantoo/pdf-lib` 2.9.1 candidate. The
pre-approved Python filling fallback was not needed.

This directory contains synthetic evidence only. No report narrative, model
payload, credential, real clinical data, or production artifact is retained.

## Automated gate

Run on 2026-09-05 with Node.js 24.20.0, Vitest 4.1.11,
`@cantoo/pdf-lib` 2.9.1, and independent `pypdf` 6.16.2 readback:

```text
npm run typecheck
PYPDF_PYTHON=<pypdf-6.16.2-venv>/bin/python npm test
npm run build
```

The focused tests establish that:

- modified source bytes are rejected and the official source checksum matches
  `1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c`;
- representative text, multiline narrative, checkbox, choice, and both
  supported product rows fill and read through ordinary supported APIs;
- the saved output remains eight pages; and
- `pypdf` 6.16.2 reloads the output without a password and reads every expected
  representative value.

[`gate-result.json`](gate-result.json) is the machine-readable result and
[`filled-form.pdf`](filled-form.pdf) is the checked output. Its SHA-256 is
`51c3967c7054823ec726c166942df2d188193a9a856072cf939ae19de448a3c6` and
was stable across consecutive generation runs.

## Residual marker disposition

Reloading the generated output through `@cantoo/pdf-lib` reports the known
residual `NEEDS PASSWORD` marker. This is recorded in `gate-result.json`; no
inspection-mode bypass was used. It does not fail the approved gate because
the output is unencrypted to `pypdf`, opens and renders normally in Chromium,
and independently reads back correctly. The library also reports that it
removes unsupported XFA data while saving. The retained rendering evidence
shows the AcroForm output preserves the approved visible form identity and
representative appearances.

## Chromium inspection

Playwright 1.63.0's pinned Chromium 153.0.8010.12 opened the output in its
native PDF viewer at 1440 × 900. Manual inspection of the retained screenshots
on 2026-09-05 confirmed:

- no password prompt or corruption;
- the FDA, MedWatch, Form 3500, OMB expiry, page identity, and eight-page count
  remain visible;
- page 1 renders the patient text and hospitalization checkmark;
- page 2 renders the two-line narrative;
- page 4 renders suspect product row 1 and the `Oral` choice; and
- page 5 renders suspect product row 2.

[`chromium-result.json`](chromium-result.json) records the browser version,
viewport, page targets, and screenshot names.

## Regenerate

Use the pinned Node runtime and install the independent parser in an isolated,
git-ignored environment:

```text
python3 -m venv .venv-pdf-evidence
.venv-pdf-evidence/bin/pip install -r requirements/pdf-evidence.txt
PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm run evidence:pdf
node_modules/@playwright/test/cli.js install chromium
npm run evidence:chromium
```

`evidence:chromium` uses Playwright's pinned Chromium executable by default;
`CHROMIUM_EXECUTABLE_PATH` may override it for a named compatible Chromium
binary. Inspect all four regenerated screenshots before accepting them.

Chromium rendering is intentionally retained manual evidence in Slice 0, not a
CI browser check. Until Slice 2 adds the approved `test:e2e` command, any change
to the PDF adapter, official source, `@cantoo/pdf-lib`, or Playwright must
regenerate and manually inspect this evidence in the same PR.
