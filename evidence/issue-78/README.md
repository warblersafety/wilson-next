# Issue #78 operator-readiness evidence

This directory contains retained synthetic evidence for the Issue #78
operator-readiness slice. Application-model responses were predetermined. No
live application-model call was made, and the exact-evidence localization
contract was not weakened or tuned around the intentionally mismatched
citations.

## Exercised recovery path

The deterministic opening response cites the suspect product name and category
with capitalization and punctuation that do not occur exactly in the synthetic
clinician input. Both proposals are therefore quarantined outside accepted
case state. The product declaration remains as stable `Product 1` because its
reviewable dose, frequency, route, start date, and role proposals survive.

After review and direct reporter entry, output stays blocked and names both
missing identity facts. The operator navigates to the retained product card,
adds the name and category through direct typed controls, and sees the workflow
return to the one newly applicable medication-indication clarification. The
final browser preview and PDF then agree on the repaired product. The journey
asserts that this recovery uses no additional model call.

The same test matrix also covers these fail-closed rules in ordinary CI:

- every supported product identity field blocks output when missing;
- missing category is not treated as implicitly non-device;
- non-carried accepted or historical branch facts stay visible with an
  explicit omission reason;
- stable collection-ordinal labels do not change after an earlier product is
  rejected;
- zero retained products offers a truthful new-case action;
- a concomitant device and multiple suspect devices block unsupported output;
- a relevant-test declaration is pruned when its required result proposal is
  quarantined; and
- the UI product-control registry covers the domain-owned product fact
  contract.

## Browser and PDF agreement

`issue78-reporter-{1280x800,1440x900}.png` and
`issue78-indication-{1280x800,1440x900}.png` are viewport screenshots taken
after geometry, hit-target, trial-click, and document-overflow assertions.
`issue78-blocked-output-1280x800.png` shows the named readiness failure and
disabled PDF actions. `issue78-repaired-output-1440x900.png` shows the repaired
reviewed case and same-revision preview.

Manual inspection of all six Chromium screenshots confirmed that the reporter
identity/contact controls, reporter selections, readiness action, and
indication controls remain visible, bounded, and usable at both required
desktop viewports. The exact-citation quarantine remains visible during repair
without being mistaken for accepted case knowledge.

`issue78-identity-recovery.pdf` is the downloaded official form. Independent
pypdf 6.16.2 readback found an unencrypted eight-page document and verified 45
named fields, including patient, event, outcomes, test, history, repaired
product identity and indication, dose, frequency, route, start date, and direct
reporter details. Its byte length and SHA-256 digest are recorded in
`pdf-agreement.json`.

`issue78-identity-recovery-pdf-page-{1,2,3,4,7}.png` are independent PDFKit
renders. Manual inspection confirmed intact FDA/MedWatch and Form 3500 identity,
OMB expiry 09-30-2027, the eight-page layout, and visible agreement for Sections
A, B, C, D, and G. The rendering manifest is
`pdf-rendering-result.json`.

`journey-trace.json` records the browser version, the assembled suite's 22
predetermined application-model calls and zero live calls, the exact recovery
checkpoint, and the newly applicable clarification trace.

## Verification

```text
npm run typecheck
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm test
npm run build
env PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm run test:e2e
env WILSON_RETAIN_STAGE3_EVIDENCE=1 WILSON_STAGE3_EVIDENCE_DIRECTORY=evidence/issue-78 PYPDF_PYTHON=.venv-pdf-evidence/bin/python npm run test:e2e
clang -fobjc-arc -framework Foundation -framework AppKit -framework PDFKit tools/pdf/capture_issue_78_rendering.m -o /tmp/wilson-capture-issue-78 && /tmp/wilson-capture-issue-78
```

## Boundary

This evidence covers only the existing synthetic, bounded Form FDA 3500 paths.
It does not establish live-model extraction reliability, comprehensive device
or product coverage, broad clinical usability, real-data readiness, direct FDA
submission, durable persistence, or production readiness.
