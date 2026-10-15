# Wilson Next: current-state assessment — 15 October 2026

Historical assessment checkpoint, retained for continuity. Subsequent explicit implementation authority resumes the already selected issue128 slice; this document does not place completed work behind a new general approval gate. See [issue128 implementation evidence](../evidence/issue-128/README.md) for delivery status after this snapshot.

## Executive summary

Wilson is a substantial, carefully bounded synthetic preview with a coherent semantic architecture and extensive deterministic regression evidence. It is **not yet a complete Form FDA 3500 product**, and passing mock tests does not establish reliable interpretation of arbitrary clinician narratives. The highest-value remaining work concerns faithful output, conversational correction targeting, and an explicit coverage/acceptance contract for the selected milestone.

The [14 October assessment](ASSESSMENT-2026-10-14.md) is historical baseline evidence. Several of its gaps have since been addressed: product-count readiness, browser-local save/resume, separate fictional reporter defaults, non-blocking browser diagnostics, and named test acceptance cards. This supplement distinguishes those delivered changes from remaining issues and the unfinished work found in the working directory. It does not authorize or implement a completion plan.

Fresh assessment checks: **359 tests in 49 files passed**, including independent PDF readback; TypeScript checking passed. Current merged-main CI is successful. No new application implementation, installs, model calls, deployments, issue edits or commits were made for this assessment. The only intended durable edit is this report.

## Baseline, provenance and preservation

The requested short repository path was absent. The matching checkout was verified locally with origin `https://github.com/warblersafety/wilson-next.git`; machine-specific paths and identity are retained only in the private assessment record.

- HEAD: `e488ea0a49938218eae647db15a922fc513884f6`, committed 14 October 2026 at 23:10:52 −07:00 (15 October UTC), PR149.
- Branch: `codex/128-faithful-pdf-representations`.
- Existing modified tracked files: `app/journey.tsx`, `src/server/journey/service.ts`, `src/server/pdf/form-3500.ts`.
- Existing untracked files: `tests/fixtures/pdf-representability.ts`, `tests/pdf/route-representability.test.ts`, `tests/server/pdf-representability.test.ts`.
- No AGENTS.md was found in the repository inventory or checked ancestor directories. Product, Architecture, experiment documents and Delivery provide the repository's substantive instructions. The current assessment-only request narrows Delivery's standing implementation authority.

The existing changes were preserved. Tests below exercise that working tree, not a clean checkout of HEAD. Committed-code claims are explicitly distinguished where the unfinished patch changes behavior. No other project or Codex session was consulted.

## Purpose and expected user outcomes

[Product](PRODUCT.md) defines a clinician-facing aid for preparing a voluntary Form FDA 3500 report: describe a suspected adverse event naturally; inspect source-backed proposed knowledge; explicitly accept or correct it; answer useful follow-ups; inspect and download a faithful form. It does not diagnose, assess causality, recommend treatment or submit to FDA.

The recorded next milestone is full Form 3500 functionality using **artificial clinical and reporter information throughout**, preserving conversation as the primary interaction and the existing visual design. One active case must resume in the same browser, and reusable reporter defaults must remain separate from case-specific choices. Accounts, cross-device recovery, a case list and portable backups are excluded from this selected milestone. Real-data use and external clinician participation require separate readiness decisions.

A capability is complete only when its conversation, accepted knowledge, correction/review and actual PDF agree. A field existing in the domain or editor is insufficient. The documents establish that principle, but do not yet provide an exhaustive, current form-path acceptance matrix or a quantitative interpretation-reliability threshold. Those are decisions to make explicit, not values this assessment invents.

## How it was built

Git history supports an incremental implementation rather than a single prototype rewrite:

1. September 4–5: recovery/product/architecture decisions, then PDF proof (`c825d8e`, PR12), semantic write-boundary proof (`91c5c7d`, PR16), and local assembly (`93e6019`, PR18).
2. September 5–8: live-model and protected deployment experiments, observability and correction-integrity work. Experiment 1 ended with qualified technical success; Experiment 2 generalized the fixed journey but ended **Revise**, retaining live interpretation limitations. README lines7–29 and the experiment documents preserve those qualifications.
3. Later September: adaptive medication/device/product-quality journeys, explicit correction and quarantine, source references, laboratory rows, reporter handling and UI improvements. PR123 was the original assessment baseline, `b538f5e`.
4. October 14–15: PR127 aligned capacity/readiness; PR130 added native persistence foundations; PR133 removed telemetry from the useful-work path; PR136 captured typed drafts/history; PR138 refreshed restored stage; PR140 integrated durable workspace recovery; PR142 separated remembered reporter defaults; PR145 added protected hosted continuity evidence; PR147 named test cards; PR149 contained one duplicate-allocation failure in correction responses.

Historical technical success and later bounded repairs do not erase Experiment 2's general reliability limitation. The issue105 evidence explicitly says its constructed fixtures are not byte-exact replay of the unavailable original provider response.

## Architecture, dependencies and build workflow

One modular TypeScript/Next.js application separates browser interaction, server orchestration, semantic case authority, model interpretation and PDF output. `src/domain/case/commands.ts` owns authoritative mutations; `model-boundary.ts` validates/quarantines proposals; `completion-policy.ts` chooses bounded follow-ups; `projection.ts` derives supported output; `src/server/pdf/form-3500.ts` owns FDA widgets. Model proposals cannot silently replace accepted facts. Sources, stable semantic entity IDs, conflicts and superseded values are retained.

The browser supplies a versioned complete case to stateless server routes. The origin-scoped IndexedDB workspace retains validated case state, pending interaction, drafts and input history; Web Locks coordinate one active editor, with generation checks for stale writes. Reporter defaults have a separate database/lifecycle. This is not server-authoritative clinical persistence. Architecture lines744–792 document the boundary and collection limits: three products, eight tests and ten asked needs. The PDF supports fewer selected product slots and blocks unsupported capacity rather than pruning accepted knowledge.

Pinned package.json versions: Node24.20.0; Next16.3.3; React/ReactDOM19.2.8; TypeScript5.9.3; Zod4.5.4; Anthropic SDK0.124.0; @cantoo/pdf-lib2.9.1; Vitest4.1.11; Playwright1.63.0. These are recorded versions, not a vulnerability or currency assessment. The PDF asset is pinned to the 09/2025 form; no independent current-FDA coverage audit was performed in this supplement.

Scripts provide typecheck, Vitest, Next build/start, Playwright and opt-in PDF evidence generation. `.github/workflows/verify.yml` installs locked dependencies, Chromium and the independent Python reader in CI, then runs typecheck, tests, build and browser journeys. This assessment used existing installations only. Playwright's default local server loads predetermined model fixtures; hosted acceptance uses a separate opt-in harness. Neither mock suite proves live-provider behavior.

## Current functionality and verification

Recorded implementation/evidence covers bounded medication, device and product-quality reports; proposed-fact review; direct and conversational correction; source excerpts; conflict resolution; withdrawn history; relevant tests and serial observations; adaptive follow-ups; reporter entry; actual PDF preview/download; durable active-case recovery; and separate reusable fictional reporter defaults.

[evidence/issue-139](../evidence/issue-139/README.md) records actual Chromium process restart, unfinished controls, quota/abort failures, corrupt/future records, second-tab handoff, no-action-replay and accepted-response retention. [evidence/issue-143](../evidence/issue-143/README.md) records a protected exact-candidate hosted continuity check with zero interpretation attempts. Its candidate was fixed for the test window; it is not current-main deployment proof or same-origin upgrade/rollback proof.

Fresh checks for this report:

| Check | Result and scope |
|---|---|
| Existing unit suite, explicit Node24.20.0 and existing pypdf environment | **49 files / 359 tests PASS**, Vitest duration3.79s. Includes 8 tests in 2 untracked issue128 files. Local log retained privately. |
| `tsc --noEmit --incremental false` | **PASS**, exit0; avoids writing incremental build metadata. |
| Remote main CI | [38690898304](https://github.com/warblersafety/wilson-next/actions/runs/38690898304): completed/success at exact HEAD `e488ea0`. |
| Prior committed implementation evidence | PR149 evidence records351 tests/47files,65 mocked Chromium journeys, typecheck and fresh build. These are recorded prior results, not freshly repeated browser/build checks by this assessment. |
| Open PR listing | Successful read returned no open PRs at inspection time. The dirty branch is not evidence of a submitted or delivered PR. |

PDF tests emit the library's expected XFA-removal notice. Field readback establishes checked values, not complete rendering, pagination or every possible form field. No fresh build, browser suite, visual PDF inspection, load test, dependency audit, assistive-technology session or live model evaluation was run for this report. CI and existing evidence are identified separately rather than presented as fresh local results.

## Recorded open issues and incomplete commitments

Authorized read-only GitHub access succeeded. The open-issue listing returned twelve items; inaccessible tracking was not assumed empty. Issue bodies may preserve older snapshots: later evidence must be reconciled before action.

| Owner | Current recorded work |
|---|---|
| [150](https://github.com/warblersafety/wilson-next/issues/150) | Semantic serial-test targeting beyond PR149's allocation containment. A valid ID may still identify the wrong observation; a response may mislabel correction intent. Provider-contract changes need an explicit architecture decision and appropriate separately authorized evidence. |
| [128](https://github.com/warblersafety/wilson-next/issues/128) | Reviewed values versus PDF representability, including free-text route and intersex. Existing local work is unfinished, described below. |
| [115](https://github.com/warblersafety/wilson-next/issues/115) | Qualifiers and narrative omissions; structured-quantity fidelity; general qualifier re-entry. Requires a bounded representation/disclosure contract, not indiscriminate concatenation into structured controls. |
| [148](https://github.com/warblersafety/wilson-next/issues/148) | Stable display references when earlier serial observations are discarded. Semantic IDs remain stable; presentation renumbering is a distinct concern. |
| [143](https://github.com/warblersafety/wilson-next/issues/143) | Protected testing checkpoint. Body contains superseded blockers; later repository evidence records successful bounded hosted checks plus remaining origin/credential-lifecycle limitations. Reconcile status rather than infer current access failure from the old body. |
| [134](https://github.com/warblersafety/wilson-next/issues/134) | Measure potential diagnostic keepalive payload loss; practical loss rate is unmeasured. |
| [108](https://github.com/warblersafety/wilson-next/issues/108) | Real assistive-technology spot checks. |
| [99](https://github.com/warblersafety/wilson-next/issues/99) | Richer processing feedback: explicitly not ready to implement. |
| [98](https://github.com/warblersafety/wilson-next/issues/98), [80](https://github.com/warblersafety/wilson-next/issues/80) | Regression/presentation hardening, not established blocking correctness defects. |
| [121](https://github.com/warblersafety/wilson-next/issues/121) | Restore header branding. |
| [89](https://github.com/warblersafety/wilson-next/issues/89) | Historical report-fidelity/demo tracker; reconcile older pointers and delivered items rather than treat every historical paragraph as current work. |

Historical105 was closed by an unintended closing phrase; open successor150 preserves unfinished scope. Issue state alone is not completion evidence. No issue or PR was changed during this assessment.

## Prioritized findings: evidence and confidence

**High — output representability remains incomplete at committed HEAD (known static defect, partly addressed locally).** At HEAD, `form-3500.ts:650–658` accepts only `oral` for route and throws otherwise; the adapter also rejects intersex (`:246` at HEAD, `:248` in this working tree). The editor/domain permit broader values. Issue128 records that a case can reach a late export failure. The existing patch adds native/Other route mapping plus an explicit pre-export intersex limitation (`service.ts:667–673` in this working tree); its8 new tests pass. It is not merged, independently reviewed or browser-verified here. Blocking unsupported representation is truthful containment, not full support for every reviewed value. Never infer or substitute a different clinical value to fit the form.

**High — accepted meaning can be incompletely represented (known issue115, statically corroborated).** `projection.ts:341–355` assigns known values while qualifiers are only carried by selected explicit transforms; `:376–400` builds B5 from selected facts, with qualifier handling for symptoms/problem detail but not every included narrative fact. This supports the recorded gap; it is not a fresh end-to-end reproduction of all issue115 cases. Completion must test retained qualifiers, non-known/conflicted omissions and actual PDF output, including restore and correction history.

**High — conversational target correctness is unresolved (known issue150).** `model-boundary.ts:159–165` contains correction declarations that would allocate an unmatched observation. That protects against duplication but does not prove selection of the intended valid ID. [Issue105 evidence](../evidence/issue-105/README.md) explicitly limits its claim and records the stopped provider-schema experiment. No live reliability estimate can be inferred from this assessment's mocks. Address the architecture/evidence decision before expanding that semantic work.

**High for completion planning — no current exhaustive acceptance matrix (assessment gap, not a demonstrated runtime defect).** Product includes all current Form3500 categories; Architecture still defers comprehensive question planning, multiple devices and full form coverage (`:879–881`). Existing completion questions are deliberately bounded (`completion-policy.ts:57–125`). A reviewed per-path matrix must distinguish supported, explicitly unsupported, absent and not-yet-verified behavior, with acceptance evidence and owners. Do not turn every optional blank into a mandatory follow-up or define completion by raw field count. This supplement does not claim an exhaustive field audit.

**Medium — documentation and tracker drift (newly observed documentation defect).** Architecture's integrated workspace and reporter sections describe delivered features, but its deferred list still says full case/draft integration is pending (`:874–876`). README's current-status narrative stops well before recent delivery, and Product links the historical assessment as current gaps. Issue143's older body also conflicts with later hosted evidence. This can cause duplicate work or misleading readiness claims. Reconcile authoritative status in a later documentation slice; preserve historical evidence rather than overwrite it indiscriminately.

**Medium — storage/operations acceptance needs a deliberate boundary (documented limitation).** Browser eviction, clearing data, private profiles, changed origins and OS crash/power loss are outside guaranteed recovery. Hosted evidence does not establish cross-release same-origin upgrade/rollback continuity. Architecture lines735–780 and issue143 evidence state those limits. They are not unexpected defects under the selected single-browser synthetic scope, but must be acceptable to Steve before declaring its continuity milestone complete.

**Medium — diagnostics and independent usability evidence remain bounded (known follow-ups).** Non-blocking diagnostics improve resilience, but keepalive payload loss is unmeasured (134); Chromium evidence does not replace assistive-technology checks (108), broader browser acceptance or independent clinician usability. Guided synthetic success is not general usability proof.

## Security, reliability and unknowns

The architecture intentionally restricts this preview to synthetic information. Live adapter selection fails closed outside the declared protected preview context; PDF requests validate supplied state and use non-GET, no-store responses. Reporter defaults do not imply an account or shared clinical record. The browser is not a tamper-resistant authoritative database. Runtime diagnostics may include synthetic input/output; real-data use would require a different privacy/provider/logging and operational decision.

No credential values or private access links were inspected for this report. Deployment protection, token lifetime/disposal, current provider settings and rollback readiness were not freshly audited. Existing hosted evidence explicitly leaves administration-token lifecycle unverified. No authorization or settings changes were attempted. Dependencies were inventoried, not security-audited; no claim of absence of vulnerabilities is made.

Other unknowns: field-by-field current official-form coverage; overflow/continuation behavior across all paths; representative first-response interpretation reliability and latency; broader browser/storage behavior; independent accessibility/usability acceptance; operational ownership and acceptance criteria for an eventual real-data release. These are not all implementation requirements for this milestone. Decide scope before estimating completion.

## Proposed phases and decisions for Steve

1. **Reconcile the starting point.** Preserve the existing issue128 patch and decide its owner/disposition. Refresh current-status links and create a concise evidence-backed coverage matrix. Keep historical experiments and assessments as history.
2. **Faithfulness before breadth.** Select bounded issue128 and115 outcomes, with explicit unsupported representations, preserved case/source/history and independent actual-PDF checks. Separately decide the issue150 semantic/provider premise and acceptable live synthetic evaluation. Do not treat rejection or asking the user to retry as completed semantic correction.
3. **Close selected form-path gaps.** Implement coherent source→review→correction/follow-up→PDF journeys from the matrix. Specify unsupported/overflow policy before adding capacity. Preserve existing visual design and command authority.
4. **Integrated artificial-data acceptance.** Exercise representative medication/device/product-quality paths, difficult states, process restart/failure, same-origin upgrade/rollback, accessibility and realistic interpretation evidence under an agreed budget and threshold. Review remaining limitations explicitly.
5. **Separate readiness decision.** Decide whether the artificial-data milestone is complete. Any real clinical data, broader storage/security or external participation requires its own decision, not an automatic consequence of green CI.

Questions for discussion:

- Does “complete” mean every current Form3500 path for artificial data, with which explicit exclusions and overflow policy?
- For values the native form cannot represent faithfully, is visible pre-export blocking acceptable temporarily, or is a documented supplemental representation required?
- What first-response semantic correctness, latency and failure-recovery evidence will satisfy the milestone, and when should issue150's provider decision be reopened?
- Which browser/origin and storage-loss limitations are acceptable, and who owns the protected upgrade/rollback and credential-lifecycle checks?
- Which accessibility and independent usability checks must precede an external session?

No completion date or cost estimate is defensible until these acceptance boundaries and the coverage inventory are agreed. This assessment stops at the requested report; implementation decisions remain for discussion.
