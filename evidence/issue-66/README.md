# Issue #66 — directly correctable supported journeys

## Authority and bounded question

Issue #66 starts from merged `main` at `15b3de3`, after PR #76 consolidated
the correction-path contracts and proved all 21 predetermined application-model
calls. The question is whether the existing adult-medication and single-device
prototype can support ordinary deterministic corrections well enough to inform
a later physician-readiness decision.

This slice uses fictional inputs and predetermined application-model responses.
It does not call or tune the live model, remediate Issue #55, authorize an
external participant, expand Form 3500 coverage, or claim physician readiness.

## Before-state audit

The retained `adaptiveRichOpening` medication case and `layer2DeviceOpening`
device case exposed the same gaps recorded on Issue #66:

- an opening `Change` accepted the entire semantic group immediately and could
  edit only one known scalar;
- reviewed facts, report type, and reporter details had no deterministic edit
  action, so the only general correction path required another model call;
- supported empty facts could not be added directly;
- proposed relevant tests and reviewed products/tests could not be made
  inactive while preserving their evidence;
- the represented device stopped/removed fact was not shown on its card;
- explicit absence of relevant tests appeared as unprovided; and
- enum-backed facts could expose implementation literals such as
  `health-professional`.

The existing `Fact<T>`, group-review command, `record-clinician-facts`, typed
target/value contract, supersession rules, projection, and browser-held state
were sufficient. No new clinical or PDF field was needed.

## Delivered behavior

- One UI-only registry gives every currently supported fact a labelled typed
  control. A focused coverage check keeps its keys and shapes aligned with the
  domain-owned value contract without making it a second value authority.
- Multiple opening edits are drafted and accepted atomically with their
  proposal group. The medication journey corrects age and weight together.
- Reviewed or empty supported facts use one deterministic action backed by
  `record-clinician-facts`. The server derives correction versus addition intent;
  corrections retain superseded history.
- Report type and reporter facts use that same path. No correction action calls
  the application model.
- One bounded command changes a reviewed product or relevant test to
  `withdrawn`. Its stable entity, facts, sources, and change history remain;
  active completion, reviewed-model context, projection, and PDF omit it.
- Proposed product and relevant-test groups can be rejected. Explicit no-tests
  and device stopped/removed state are visible in clinician-facing language.

## Showcase fact traces

### Adult medication

`adaptiveRichOpening` -> proposed patient group -> age `72` and weight `64 kg`
drafted as `73` and `65 kg` -> one atomic group review -> ordinary completion ->
directly add discharge date `2026-09-04` -> directly correct report type to the
combined selection, amoxicillin dose from `500 mg` to `250 mg`, and reporter
email -> reviewed output and PDF contain only the active values; earlier dose
and email remain visible history.

### Single device

`layer2DeviceOpening` -> reject one semantically erroneous proposed relevant
test -> draft the device-operator correction from patient/consumer to health
professional -> one atomic product-group review -> ordinary reporter completion
-> directly correct the stable FlowGuard model from `FG-200` to `FG-201` ->
reviewed output and PDF contain `FG-201`; `FG-200` remains visible history. The
device stopped/removed value and explicit no-tests state remain visible.

### Reviewed entity withdrawal

The retained three-test regression -> direct ALT correction -> withdraw the
reviewed bilirubin test -> the entity remains visible with its resolved result
and source history under `withdrawn`, while the recomputed preview and PDF omit
that result and retain the other two tests.

## Deterministic evidence

The retained assembled run used Chromium 153.0.8010.12 at 1440 x 900. It
completed all prior journeys plus the Issue #66 assertions with the same 21
predetermined application-model calls and zero live application-model calls.
Independent `pypdf` 6.16.2 readback agrees with each retained PDF:

- `adaptive-rich.pdf` contains age `73`, weight `65`, discharge
  `04-SEP-2026`, the combined report-type selections, dose `250 mg`, and the
  corrected reporter email; it excludes `500 mg` and the earlier email;
- `layer2-device.pdf` contains model `FG-201`, the health-professional device
  operator selection, and no proposed false test; it excludes `FG-200`; and
- `layer1-tests-withdrawal.pdf` contains the retained ALT and creatinine tests
  but excludes the withdrawn bilirubin result.

Pre-review branch verification passed `npm run typecheck`, all 143 unit and
integration tests with the repository PDF evidence interpreter, `npm run
build`, and the one-test assembled Playwright suite. The two retained output
screenshots were inspected at their full-page capture size for active values,
labels, no-tests and stopped-device wording, history, and PDF agreement.

The exact reviewed commit and required independent review disposition will be
added here and to PR #77 before merge disposition.
