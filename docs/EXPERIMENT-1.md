# Wilson Experiment 1

**Status:** Approved by Steve; Slices 0–4A and Git-backed preview delivery are
complete; Issue #32 adds synthetic-only deployed observability before Slice 4B,
which still requires Steve's separate explicit go-ahead

**Owns:** The fixed journey, supported and deferred scope, interaction
composition, selected stack, implementation sequence, verification, deployment,
retention, and stopping criteria

**Depends on:** [`PRODUCT.md`](PRODUCT.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md), and [`DELIVERY.md`](DELIVERY.md)

## Purpose and outcome

Build the smallest production-shaped browser journey that can falsify the
semantic case, single write boundary, and interaction composition under the
failure pressure that broke legacy Wilson.

One entirely fictional report contains two suspect medicines, one concomitant
medicine, a later dose correction, and two sources that disagree about a
treatment date. The clinician describes the case, checks Wilson's proposals,
answers one useful question, submits the correction and contradiction, resolves
the conflict, inspects the supported Form 3500 projection, and downloads the
official PDF.

The dominant risk is **reviewable information density with correct entity
identity**. The experiment asks whether similar products remain distinct,
whether source excerpts make proposals reviewable, whether incompatible
evidence stays visible without leaking into the form, and whether review and
PDF agree at one case revision.

The experiment is not a general Form 3500 release or a usability study. Once
its minimum integrity evidence is green, one physician uses the synthetic
journey and supplies the highest-value early product feedback.

## Scope

### Included

- one adult adverse-event report;
- exactly two suspect drugs and one concomitant drug;
- the patient, event, treatment, outcome, and product facts in the fixed
  narrative;
- one authored follow-up about both suspect-product indications;
- one natural-language update containing a correction and contradiction;
- explicit review of the correction and resolution of the conflict;
- supported Form FDA 3500 Sections A, B, D, and F;
- four screen compositions covering Describe, Check understanding, Correct and
  resolve, and Inspect output;
- one seven-state desktop Chromium journey at 1440 × 900 CSS pixels;
- browser review, form preview, and official PDF download;
- one deterministic browser run, operator-initiated real-model use under an
  operator-chosen runtime budget, one deployed operator run, and one formative
  physician session; and
- synthetic information only.

### Deferred

- reporter entry and Section G;
- devices and Section E;
- product-problem-only, medication-error-only, pregnancy, congenital, death,
  no-patient, and more-than-two-suspect-product paths;
- New case, interrupted-session recovery, and browser-level model/PDF failure
  branches;
- model-generated questions or a general question planner;
- mobile, a second viewport, and a browser matrix;
- broad accessibility audit beyond semantic HTML, labels, visible focus,
  keyboard operation, and the main path;
- accounts, collaboration, submission, analytics, and durable storage;
- a public or production launch, general authentication, hosted case
  persistence, and packaging or distribution for Noah; and
- a multi-participant study or general preference claim.

The UI discloses the experiment's limited coverage before input and identifies
Wilson as an experimental, synthetic-only tool that must not be used for a real
report. Unsupported content is not accepted, approximated, or silently dropped,
and unsupported form sections do not masquerade as unknown or complete.

## Fixed synthetic journey

All people, identifiers, events, and clinical details are fictional.

### Opening account

> Patient TEST-57 is a 57-year-old woman. She was taking apixaban 5 mg by mouth
> twice daily; I recorded the start as 12-Aug-2026. She also took naproxen 500
> mg by mouth twice daily starting 10-Aug-2026, and lisinopril 10 mg by mouth
> daily as a concomitant medicine. On 18-Aug-2026 she developed melena and
> dizziness and was hospitalized. Her hemoglobin was 7.8 g/dL. Apixaban and
> naproxen were stopped, she received two units of packed red cells, and she
> recovered and was discharged on 21-Aug-2026. I suspect apixaban and naproxen.

The clinician's `I suspect` statement supplies report roles; Wilson does not
make a causality judgment.

### One consequential follow-up

Wilson asks exactly one authored group:

> What was apixaban being used for, and what was naproxen being used for?

Fixture answer:

> Apixaban was for postoperative VTE prophylaxis after knee replacement.
> Naproxen was for postoperative pain.

This is the complete question budget. No other blank or unsupported field earns
a question. An additional group, a repeated request for known information, or
splitting the group without evidence that clarity requires it fails the
interaction hypothesis and reopens the question policy.

### Correction and contradiction

> Correction: the naproxen dose was 250 mg twice daily, not 500 mg twice daily.
> Also, the medication administration record lists apixaban starting
> 13-Aug-2026, but my note says 12-Aug-2026. I can't resolve that yet.

The model may propose the correction, but 500 mg remains active until the
clinician explicitly accepts it. Acceptance activates 250 mg everywhere and
retains 500 mg only as superseded history.

Both apixaban dates remain visible with their excerpts. Neither is active or
reaches the pre-resolution projection.

### Conflict resolution

The clinician selects the medication administration record and confirms:

> Use 13-Aug-2026 as the apixaban start date.

The next revision, review, projection, and PDF use 13-Aug-2026. The 12-Aug
statement remains traceable but inactive.

### Semantic oracle

| Entity | Required result |
|---|---|
| Patient | `TEST-57`; 57 years; female |
| Event | melena and dizziness; onset 18-Aug-2026; hospitalization; hemoglobin 7.8 g/dL; transfusion; recovered; discharge 21-Aug-2026 |
| Apixaban | suspect; 5 mg; twice daily; oral; postoperative VTE-prophylaxis indication; resolved start 13-Aug-2026 after explicit resolution |
| Naproxen | suspect; corrected 250 mg; twice daily; oral; start 10-Aug-2026; postoperative-pain indication |
| Lisinopril | concomitant; 10 mg; daily; oral; never promoted to suspect |
| Evidence | every material result points to the exact account, answer, correction, or resolution supporting it |
| History | naproxen 500 mg inactive; both apixaban dates traceable; neither date active before resolution |

The narrative says both suspect products were stopped but supplies no stop
date. Both Form 3500 stop-date fields remain blank; the undated discontinuation
fact may remain in the supported event narrative. Unaddressed relevant medical
history also remains blank and is never translated into a reported absence.

## Interaction composition

Primary form factor is keyboard-and-mouse desktop or laptop, stable Chromium,
at 1440 × 900 CSS pixels.

```text
+-----------------------------------------------------------------------+
| Wilson                  Synthetic experiment                 Status   |
+-----------------------------------+-----------------------------------+
| Active task                       | Case so far / needs attention     |
| Describe, check, answer, or       | Patient                           |
| resolve one focused item          | Event                             |
|                                   | Suspect products as separate cards|
| Compact evidence; exact excerpt   | Other products                    |
| expands when attention is needed  |                                   |
+-----------------------------------+-----------------------------------+

Output only:
+-----------------------------------+-----------------------------------+
| Included / not included /         | Form FDA 3500 preview             |
| needs resolution                  |                                   |
+-----------------------------------+-----------------------------------+
```

The four compositions are:

1. **Describe:** full populated narrative, clear experiment boundary, native
   dictation hint, and no form preview.
2. **Check understanding:** patient, event, two suspect-product cards, and one
   concomitant-product card with Change, Remove, compact evidence, and one
   case-level Continue action.
3. **Correct and resolve:** proposed naproxen correction with expanded source,
   both apixaban dates with exact sources, and explicit actions for either date
   or leaving the conflict unresolved for now. The old dose remains active
   until a separate explicit acceptance applies the correction.
4. **Inspect output:** Included, Needs resolution, and Not included summaries
   beside the supported Form 3500 projection. Before resolution the start date
   is blank and explained; download is disabled for this fixed sequence.

Ordinary groups do not require one confirmation per fact. Flagged conflict,
material uncertainty, role ambiguity, correction, or rejection always requires
an explicit decision; a case-level Continue cannot silently resolve it.
Evidence is compact by default and expands automatically where it affects a
decision. Corrected/resolved knowledge is primary and superseded history is
available but quieter. No model rationale or confidence percentage is shown.

This written composition is authoritative. Create visuals before Slice 2 only
if they answer a remaining composition question; visuals are never acceptance
evidence.

## Browser sequence

1. Describe and submit the full narrative; show extraction loading.
2. Check five semantic groups and their evidence.
3. Answer the one indication question.
4. Submit the combined correction/contradiction and explicitly accept the
   proposed dose correction.
5. Inspect the pre-resolution projection with the start date omitted.
6. Resolve the conflict to 13-Aug-2026 and regenerate review/projection.
7. Download the official PDF.

The pre-resolution download restriction is specific to this fixed experiment,
which deliberately exercises resolution before download. It does not establish
a product-wide rule that every unresolved optional fact blocks partial output.
Before physician testing, browser evidence must check both the visible control
and direct access to every official-PDF route: before resolution, download and
preview access return a no-store `409` response. A disabled button alone does
not prove the gate.

Backward editing remains allowed. Any visible Change or Remove control is a
real affordance. In Check understanding, Change records a clinician correction
and Remove rejects the proposed semantic group through `applyCaseCommand`;
controls are absent wherever this fixed experiment does not support the action.
Before physician testing, separate synthetic browser runs exercise at least one
Change and one Remove path without altering the authoritative golden journey.
Retain screenshots only for understanding, unresolved conflict, and final
output unless another state diagnoses a failure.

## Success and stopping

The experiment passes only if:

1. Every case write uses `applyCaseCommand`.
2. Every oracle fact survives with the correct entity, role, and source.
3. Explicit acceptance makes naproxen 250 mg active everywhere; 500 mg remains
   only in history.
4. Neither apixaban date reaches the conflicted projection; explicit resolution
   updates every view and the projection together.
5. Wilson asks only the one indication group and repeats nothing known.
6. No surface exposes widget IDs or implementation/model vocabulary.
7. Semantic projection and downloaded PDF agree for every supported value;
   unsupported and omitted content has a truthful explanation.
8. Full realistic content, evidence, and conflict remain understandable.
9. Ordinary groups avoid repetitive confirmation while flagged knowledge
   requires explicit action.
10. The model sample passes its gates.
11. Operator review finds no severe reason to withhold the synthetic preview.
12. One physician completes the journey and their observations inform the next
    product decision.

Immediately stop and classify the owning premise for silent loss, invention,
reversal, wrong-entity attribution, bypassed authority, hidden conflict, or
case/PDF disagreement. Also stop if domain behavior needs widget identity,
correction/conflict requires UI-specific writes, a view owns case values, the
grouped question confuses products, or unsupported content is accepted.

More generally, stop the affected slice before changing user behavior,
semantic truth, authority, scope, privacy, evidence, or a consequential
technical commitment. Preserve the smallest failing example, record expected
versus observed behavior and options in the issue/PR, update the owning active
document, and obtain approval before resuming. Ordinary defects and reversible
implementation choices remain local.

The experiment ends after physician-feedback review whether it passes or
fails. It never expands automatically. A technical pass cannot overrule
feedback that the direction is confusing or not useful.

## Verification

### Deterministic evidence

Use focused, table-driven tests where useful to prove:

- proposals cannot resolve without review;
- stable product identity and suspect/concomitant roles;
- accepted correction with inactive retained history;
- conflict with no active/projected value before resolution;
- stale/duplicate command idempotency; and
- agreement among reviewed case, semantic projection, and supported PDF.

Also reject malformed model output before review and run one narrow automated
source-boundary assertion preventing route/UI imports of lower-level mutation
helpers. This runs under the ordinary test command; do not build an architecture
test platform or coverage regime.

### Deterministic browser journey

Playwright drives the seven states with predetermined model responses while
real browser, command, case, projection, and PDF behavior remain intact. Use
visible labels and accessible roles. Assert three distinct products, exactly one
question group, accepted correction everywhere, conflicted date omitted,
resolution updating review/output, and successful download. Retain the useful
trace and screenshots, not a visual-regression service. Here, useful trace
means a sanitized ordered checkpoint record with no cookies, browser storage,
request bodies, page snapshots, or raw network/session state; do not retain a
raw Playwright trace archive.

### Real-model evidence and runtime policy

Slice 3's accepted sample remains historical evidence gathered under its then
approved four-sample/USD 5 gate. That completed gate does not limit later
development, verification, or interactive use.

For subsequent Wilson operation, provider-default adaptive thinking and effort
are the default. The API-required output limit uses the provider's full
supported capacity rather than a Wilson development ceiling. Wilson imposes no
token, thinking-token, cost, sample-count, turn, or wall-clock maximum on an
operator-initiated run. Steve chooses the practical runtime budget and may
explicitly supply a supported effort or output setting at launch. Quality is
the primary constraint; do not reduce thinking, output, or latency without
measuring the effect on extraction and correction quality.

Disable automatic retries and record model ID, parameters, prompt/schema
revisions, token use, latency, and cost. A human scores each retained evidence
run against the semantic oracle and verifies that each excerpt supports the
proposed value and relationship. CI, builds, deterministic browser tests, and
independent review make no paid model call.

Any comparative model/effort experiment is separately authorized with scope
and a budget selected by Steve. It is never triggered as an automatic response
to a failure or review finding. This is the governing decision requested by
[Issue #25](https://github.com/warblersafety/wilson-next/issues/25).

Require zero invented material facts, zero wrong-product/role attachments,
supporting text for every material proposal, and every projection-required fact
in every run. Any failure stops expansion and reopens prompt, schema, model, or
responsibility. Passing makes no general reliability claim.

### PDF, operator, and physician evidence

Compare supported semantic projection values and checkboxes programmatically
with the PDF and inspect its rendered pages visually. Then the operator
completes the deployed synthetic journey unaided using the real model and PDF
filler. This is an operator-initiated runtime use under the policy above.

When all minimum evidence is green, one physician uses the experimental,
synthetic-only preview and discusses confusion, effort, fidelity, reviewability,
the value of the one follow-up, missing emphasis, and preference versus the
direct form. Keep concise observations, not a pseudo-scientific score.

Before that session, proposed work must protect case integrity, enable the
complete browser-to-PDF journey, or make the feedback safer or interpretable.
Otherwise defer it.

Do not add coverage targets, a simulated-clinician harness, broad adapter
matrices, property or mutation testing, an LLM judge, large eval corpus,
scheduled model runs, visual regression, multiple browsers/viewports, load
testing, production monitoring, or browser tests for deferred failure branches
without evidence that the first physician decision needs them.

## Selected stack

- Node.js 24.20.0 LTS for local development and CI, npm, strict TypeScript,
  React, Next.js 16.3.3. Vercel selects only the Node major and controls minor
  and patch rollout; the Slice 4A build used Vercel's then-current Node 24.19.0
  under project setting `24.x`, an accepted deployment-platform variance that
  does not weaken the repository or CI pin.
- Plain CSS Modules; no UI kit or CSS framework.
- Zod 4 for the runtime model/case boundary.
- `claude-sonnet-5` through Anthropic's TypeScript SDK with structured output,
  default sampling, no tools, and synthetic text only.
- `@cantoo/pdf-lib` 2.9.1 subject to the Slice 0 gate; bounded `pypdf` 6.16.2
  fallback if it fails.
- Vitest 4.1.11 and Playwright Chromium.
- One Vercel Hobby project. Slice 4A established the pinned transient Vercel CLI
  fallback; the subsequently installed GitHub integration supplies protected
  feature-branch previews. Repository configuration disables automatic Git
  deployment from `main`, leaving production deployment deliberate.
- Origin- and tab-scoped `sessionStorage` for the disposable synthetic case and
  minimum conversation state; no hosted case persistence.
- Vercel deployment protection when it provides workable reviewer access;
  otherwise one minimal application-level preview lock.
- One npm lockfile, one `verify` CI job, and one issue branch/PR per slice.

This remains one Next.js application. No database, cache, worker, queue,
persistent disk, object store, agent framework, custom domain, or multi-package
repository is approved. No paid Vercel plan is authorized by this document;
Slice 4A must stop and report if Hobby cannot provide a workable path.

Next.js is an application shell: explicit route handlers call application
commands/queries; domain modules have no Next imports; model and PDF adapters
are server-only; and Experiment 1 uses no Server Actions, edge runtime, static
regeneration, or framework cache. Browser retention follows the narrow
synthetic-preview exception in Architecture and does not create a browser-side
semantic write path.

The model receives the fixed transcript and returns grounded proposals. Authored
application copy supplies the one question. It does not browse, use tools,
maintain hidden conversation state, establish truth, resolve conflict, or
produce form fields.

## Slice 0 PDF gate

The official Form FDA 3500 (09/2025) recorded on 2026-09-04 has SHA-256:

```text
1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c
```

The encrypted source uses an empty viewing password. A preliminary probe found
that `@cantoo/pdf-lib` opened it, enumerated fields, filled representative
values, allowed readback, and rendered visible text/checkmarks. The library's
reload path reported a residual encryption marker, so Slice 0 remains a real
compatibility gate.

Scaffold the pinned application and prove only this representative adapter
capability before substantial UI work:

1. Reject a source PDF whose form version or checksum differs.
2. Fill a text field, multiline narrative, choice, checkbox, and both supported
   product rows.
3. Read those representative values through ordinary supported APIs.
4. Open without a password prompt and render relevant pages in Chromium.
5. Preserve eight pages and the approved visible form identity.

The residual marker alone does not fail if the output opens normally, renders,
and `pypdf` 6.16.2 independently reads expected values. Record it. A password
prompt, corruption, failed independent readback, or consumer-specific
inspection-mode requirement fails the TypeScript candidate.

Time-box the TypeScript gate to half a working day. If it fails, use `pypdf`
plus its AES dependency in a small Python subprocess behind the same adapter,
packaged with Node in the same deployable application. Give the fallback no
more than one additional working day against the same gate; otherwise stop and
reopen the PDF premise. Do not repair or fork a PDF engine. PyMuPDF remains
unselected because its proprietary/AGPL licensing decision is unnecessary.

Slice 0 does not define the complete Experiment 1 semantic projection. Full
supported mapping lands with the projection and browser integration in Slices 1
and 2. Before mapping evidence is accepted, record the FDA instructions'
authoritative URL and retrieval date.

## Runtime and preview

The browser retains the latest complete server-returned case, revision, and
minimum conversation stage in origin- and tab-scoped `sessionStorage`.
Refreshing that tab may continue the preview; closing it, opening another tab,
using a new browser/device, clearing site data, or encountering an incompatible
state version starts over. Concurrent-tab use is unsupported. Provide an
obvious reset action and a concise instruction for clearing the preview after
review. Do not add a Vercel database, key-value store, encrypted server
envelope, revision/hash anchor, or affinity mechanism for Experiment 1.

The deployment-only preview lock is not a product account. Slice 4A established
Vercel Authentication on generated deployment URLs and identified one
revocable Shareable Link as the no-cost, non-technical reviewer candidate.
Hobby permits only one Shareable Link in total for the account; a read-only
account check during Slice 4A found no existing alias-level protection bypass,
so that slot appeared available. The link is bearer access and must be scoped
to the review deployment and revoked afterward. Slice 4B must confirm that path
end to end before sharing the preview. If it is not practical, Slice 4B may add
one minimal shared-secret screen and signed, secure, non-persistent cookie.
Before an Anthropic secret is installed or a reviewer link is shared, every
model, case, and PDF route must be behind the selected protection; the
Anthropic key never reaches the browser. An unprotected 4A gate deployment may
contain only the existing deterministic synthetic experience, remain unshared,
and be removed when the gate ends. Its checks stop at build completion, initial
page/static delivery, and access-path discovery; they do not exercise or make
claims about the multi-request journey.

State changes use non-GET methods and reject mismatched Origin. Case/PDF
responses use `Cache-Control: no-store`; all pages send `X-Robots-Tag: noindex,
nofollow`, which is not treated as access control. For this fixed synthetic-only
experiment, Vercel Runtime Logs are the single diagnostic location. One opaque
run identifier spans the browser journey and one operation identifier spans
each request. Structured events are emitted immediately for meaningful browser,
route, model, schema/domain-boundary, case-command, state-transition, and
response phases, so a crash or early stop remains reconstructable without a
final state.

Those protected logs may include the complete relevant fixed synthetic model
request and response, proposals, entity and field assignments, values, source
evidence, validation results, control flow, response metadata and body, and
caught error details. They never include authorization headers, cookies,
protection bypasses, API or deployment tokens, environment values, SDK secret
configuration, browser storage, or other credential-bearing material. Binary
PDF bytes remain excluded as redundant. Inputs outside the approved fixed
synthetic fixture are not recorded as content. Hobby's one-hour Runtime Log
retention is accepted because the operator inspects logs during or immediately
after each run; no drain, dashboard, trace archive, or second diagnostic store
is added.

Each case-route response also emits a single reconstruction checkpoint with the
already-sanitized events accumulated during that request. The immediate events
remain the evidence for an early crash; the checkpoint makes a completed
request reconstructable if Vercel's live stream omits individual log lines. The
checkpoint is held only in request memory until it is logged and is not a
second diagnostic or case store.
Each browser report is likewise immediate and carries the cumulative browser
events for that operation, so a response or browser failure remains tied to its
initiating action if Vercel omits an earlier line. That trace exists only in the
browser reporting closure for the current request.

The preview is disposable, synthetic-only, likely less secure than a production
healthcare system, and never presented as production-ready. Remove access after
the approved review window unless continued access is separately approved. An
Issue #32 delivery exception retains one unshared, protected synthetic Git
preview until it is replaced by a later verified protected preview or a
production deployment is separately approved. Vercel treats the first
deployment of an otherwise empty project as production regardless of the Git
branch; retaining this one protected deployment prevents the no-production
project from re-entering that bootstrap state. It is not a release, durable case
store, or reviewer access grant.

### Vercel deployment credential handoff

The Vercel access token is a short-lived local administration credential, not
an application runtime secret. It is never sent through chat, committed,
stored in the repository, or installed as ambient Codex/builder authentication.
Do not reuse the legacy Wilson token.

For Slice 4A, use this handoff:

1. Before requesting a token, ignore `.vercel/`, `.env.vercel`, and equivalent
   local credential files. Vercel project-link metadata is local and
   non-secret but still remains uncommitted.
2. Codex prepares
   `/Users/sofa-claude/.config/wilson-next/vercel.env` outside the repository,
   with its directory readable only by the owner and the file mode `0600`.
3. Steve creates a new Vercel token with the shortest practical expiry—one day
   by default—and scopes it to the `warblersafety` team when that scope permits
   the required project operations. Broader account scope requires Steve's
   explicit approval after a narrower attempt fails.
4. Steve pastes the value directly into that file as `VERCEL_TOKEN=...` using
   an interactive editor or hidden prompt, then reports only that the handoff is
   ready. The value is never pasted into the Codex conversation.
5. Codex sources the file only for the bounded Vercel CLI/API commands. It may
   check presence and account/team access without printing the value, and must
   not use shell tracing, echo the environment, write the token to command
   output, or persist a Vercel login.
6. After the gate is complete, Codex removes the local handoff file and Steve
   revokes the token (or confirms its expiry). Documentation records only that
   the handoff and revocation/expiry checks passed.

Any later Vercel administration session repeats this process with a new
short-lived token; the 4A token is not retained for 4B.

Runtime secrets are separate. Slice 4A requires no Anthropic key. Before Slice
4B, Steve enters the Anthropic API key and any human-chosen preview secret
directly in Vercel's environment-secret interface; Codex verifies names and
availability without retrieving values. Generated cookie-signing material may
be created and installed without displaying it. Never use `vercel env pull` to
copy hosted runtime secrets back to the development machine.

Local Slice 3 model access uses the Mini-local handoff below; never export its
credential into an ordinary development shell or the shell used for
subscription-backed code review. The synthetic diagnostic exception above does
not permit the local or deployed model credential, its environment, or PDF
bytes to enter logs.

### Local Slice 3 model credential handoff

The local Anthropic credential is stored under the `sofa-claude` Mini account,
never on the MacBook or in this repository. Its non-secret coordinates are:

```text
keychain:  ~/Library/Keychains/login.keychain-db
namespace: wilson-next
variable:  ANTHROPIC_API_KEY
envchain:  ~/.local/bin/envchain (version 1.1.0)
tmux:      socket wilson-next, session wilson-next, pane wilson-next:0.0
```

The operator entered the value through envchain's hidden prompt. This repository
records neither the raw value nor the provider-side key identifier. The item is
approved only for Wilson Next model calls; it is not Claude review
authentication and must not be reused for legacy Wilson.

The headless Codex execution session cannot unlock this file-based keychain.
An interactive terminal logged into the Mini as `sofa-claude` therefore starts
one persistent, credential-bearing Wilson shell:

```sh
envchain wilson-next tmux -L wilson-next new-session -d -s wilson-next \
  -c /Users/sofa-claude/code/warblersafety/wilson-next
```

Run local real-model commands only inside that named tmux session. A fresh task
first checks `tmux -L wilson-next list-sessions`, then verifies readiness inside
the pane without displaying the value:

```sh
node -e 'process.stdout.write(process.env.ANTHROPIC_API_KEY ? "WILSON_KEY_READY\n" : "WILSON_KEY_MISSING\n")'
```

Do not run `env`, `printenv`, `set`, `tmux show-environment`,
`envchain --list --show-value`, shell tracing, or any command intended to
recover the raw value. Do not run the subscription-backed Claude reviewer
inside this tmux session. Its existing preflight still requires all Anthropic
API variables to be unset.

The tmux process keeps the credential only until that server exits or the Mini
restarts. To recover, use an interactive `sofa-claude` terminal, without
`sudo`:

1. Run
   `security unlock-keychain "$HOME/Library/Keychains/login.keychain-db"`;
   enter its password only at the hidden prompt.
2. If the Anthropic key was intentionally rotated or removed, restore it with
   `envchain --set --noecho wilson-next ANTHROPIC_API_KEY` and enter the value
   only at the hidden prompt.
3. Recreate the named tmux session with the command above and repeat only the
   non-revealing readiness check.

The envchain binary was built per-user from the upstream version 1.1.0 archive;
its source SHA-256 matched Homebrew's published
`832bcf58037db6187f7327282e347e45627ea617c2e09a9e6d18629e7310fff9`.
`/opt/homebrew` belongs to a different Mini account, so do not change its
ownership to reinstall envchain.

## CI and implementation order

Commit `package-lock.json`; pin direct dependencies, Node patch, PDF checksum,
model/prompt/schema revisions, and Playwright Chromium through the lockfile.
Dependabot, Renovate, automated releases, and multi-environment infrastructure
are deferred.

One GitHub Actions `verify` job runs:

```text
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Create the `verify` workflow with the Slice 0 scaffold. Add each command when
the slice that first produces its evidence arrives; do not create empty
placeholder tests for later slices merely to populate the initial workflow.

The deterministic browser test needs no credentials. Real-model use and
deployed smoke checks are explicit operator actions, never push-triggered
automation; their runtime budget remains Steve's decision. Require `verify` on
`main` after the workflow exists.

Core implementation follows the completed Slices 0–3 and the split Slice 4:

1. **Slice 0 — prove the FDA PDF filler:** scaffold and pass the bounded gate
   or its pre-approved fallback.
2. **Slice 1 — protect the case:** semantic case, `applyCaseCommand`, temporary
   repository, pure views/projection, Zod boundary, focused tests, and the one
   source-boundary assertion.
3. **Slice 2 — assemble locally:** implement the four compositions and
   seven-state journey with predetermined model responses and checked PDF.
4. **Slice 3 — try the real model:** connect Claude and inspect the capped
   sample; failures reopen the model boundary without hidden retries or an
   automatic second-provider comparison.
5. **Slice 4A — prove the Vercel Hobby deployment path:** from synchronized
   `main`, attempt direct import of the public `warblersafety/wilson-next`
   repository first. If Vercel refuses or cannot use that Git connection on
   Hobby, deploy the same application commit with the reusable Vercel CLI or
   REST API. Create/link a distinct Wilson Next project; prove that the build,
   initial page, and static assets are reachable; determine the practical
   non-technical reviewer access path; confirm that this non-commercial,
   open-source organization-repository use is eligible under the current Hobby
   terms; record exact repeatable steps and cost; and make no live-model call or
   physician-facing product change. Stop rather than purchasing Pro.
6. **Slice 4B — physician-ready live preview:** connect the real browser journey
   to the live model, move disposable case/conversation continuity to the
   browser boundary above, close the Change/Remove false affordances, add the
   selected preview protection and the approved synthetic-only diagnostics, run operator
   conversation/PDF acceptance, and then meet one physician when the minimum
   evidence is green.

Slice 4A passes only when the Wilson Next build, initial page, and static assets
have a Vercel URL; the Hobby Git-import result is conclusive; the CLI/API
fallback works if needed; current Hobby terms permit this non-commercial,
open-source organization-repository use; a non-technical access path is
identified; the process is documented and repeatable; no credential is retained
or committed; and no paid plan is purchased. Its result selects the deployment
mechanism for 4B; it does not select hosted persistence or claim that the
current multi-request journey works on Vercel.

Slice 4A selected a distinct `wilson-next` Hobby project created through the
Vercel REST API and deployed from a clean repository commit with transient,
pinned Vercel CLI 59.11.7. Direct import of the public
`warblersafety/wilson-next` repository failed because its Vercel GitHub
integration was not installed at the time; no installation or paid plan was
required for the selected fallback. Omit `--target` for preview deployment:
the first empty-project deployment classified an explicit `--target preview`
request as production, so that deployment was removed after evidence and the
corrected command was verified to produce a preview. The complete result,
repeatable commands, terms basis, and cleanup record live in
[`evidence/slice-4a/README.md`](../evidence/slice-4a/README.md).

After Slice 4A merged, Steve installed the Vercel GitHub integration for only
`warblersafety/wilson-next`. Issue #30 adds the no-cost Git delivery path:
feature branches create protected preview deployments and pull-request comments,
while `vercel.json` disables automatic Git deployment from `main`. Vercel's
project-level deployment policies would express the same distinction centrally,
but its API requires Pro or Enterprise; that paid control remains excluded.
API verification found previews and fork protection enabled, pull-request
comments enabled, Vercel Authentication on generated deployment URLs, zero
protection bypasses, and no paid deployment policy. The Vercel project still
identifies `main` as its production branch so any later production deployment
must be an explicit, separately authorized act. The retained evidence is in
[`evidence/issue-30/README.md`](../evidence/issue-30/README.md).

Issue #32 found one additional Vercel lifecycle constraint: after every prior
deployment had been removed, the next feature-branch push was treated as the
empty project's first deployment and promoted to production even though the
Git link still named `main` as the production branch. The repository's
`git.deploymentEnabled.main: false` rule prevents a `main` push from deploying;
it does not override Vercel's first-deployment bootstrap behavior. The bounded
recovery creates and verifies a protected Git preview before deleting the
accidental production deployment, then retains that unshared protected preview
under the exception above. Evidence and the cleanup record live in
[`evidence/issue-32/README.md`](../evidence/issue-32/README.md).

The merged Slice 1–3 application still keeps case/session state in a
process-local `Map`. That mechanism is already known to be unreliable across
Vercel requests and is intentionally replaced only in 4B. Do not exercise the
seven-state journey as 4A acceptance, interpret warm-instance success as
continuity evidence, or repair session behavior under the deployment gate.

Slice 4A may change only deployment metadata, secret-ignore rules, and the
documentation needed to establish that result. If Vercel requires an
application behavior change, dependency, persistence mechanism, or paid plan,
or if current Hobby terms do not permit the planned use, stop and bring that
finding back for approval instead of expanding the gate.

Slice 4B passes only when the operator and remote physician can open the
protected synthetic preview without technical setup; complete a meaningful
multi-turn live-model journey; refresh without losing the current compatible
state in the same tab; inspect correct product identity, evidence, correction,
and conflict behavior; and verify that the reviewed case, onscreen projection, PDF
preview, and downloaded FDA form agree. Failures must return an opaque
diagnostic reference and enough correlated Runtime Log evidence to diagnose the
phase and model behavior under the synthetic-only policy above.
No Anthropic credential reaches the browser, and the preview plainly forbids
real patient data and disclaims production readiness.

Manual 4B acceptance uses the fixed synthetic journey:

1. Open the remote preview as a non-technical reviewer and confirm the
   synthetic-only boundary before entering anything.
2. Submit the opening account and confirm exactly one live request occurs.
   Inspect every proposed fact, product identity, role, and source excerpt;
   stop on invention, omission, unsupported content, or wrong attachment.
3. Judge whether Wilson's single grouped indication question is natural,
   useful, and unambiguous about both products. Confirm the answer attaches to
   the correct product cards.
4. Submit the correction and contradiction and confirm exactly one further live
   request occurs, with no hidden retry.
5. Confirm 500 mg remains active until 250 mg is explicitly accepted, then
   remains only in superseded history.
6. Leave the date conflict unresolved and confirm both alternatives remain
   visible, neither reaches the projection, and direct PDF access returns the
   required no-store `409`.
7. Refresh the same tab after extraction and again after correction/conflict;
   confirm the same compatible state and revision return.
8. Resolve the date to 13-Aug-2026 and compare the reviewed case, onscreen
   projection, PDF preview, and downloaded FDA form field by field.
9. Confirm an induced safe failure shows an opaque reference and that the
   matching logs reconstruct the synthetic request, model/boundary/control-flow
   detail, phase, timing, token use, and model/schema versions without
   credentials.
10. Record separate judgments for conversational coherence, factual fidelity,
    evidence usefulness, interaction burden, latency, correction/conflict
    handling, and form accuracy; then reset the preview and close the tab.

Any invention, silent loss, wrong-product attachment, hidden conflict,
unexpected retry, same-tab refresh loss, inaccessible diagnostic reference,
or disagreement among case, projection, preview, and PDF fails Slice 4B.

Slice 2 established the assembled path but also exposed a false-affordance
risk: visible Change and Remove controls were not functional. Slice 4A does not
exercise or repair them; close the gap inside 4B before operator or physician
use. Slice 3 remains complete and its historical evidence is unchanged.
Approved planning amendments and independently valuable defects follow the
ordinary issue-and-branch rule without otherwise renumbering the slices.

No slice waits for broad coverage, eval infrastructure, general form support,
durable data, or polish unrelated to the approved journey.

## Retention, disposal, and inputs

Retain only the synthetic fixture/oracle, source revision, focused results,
useful sanitized trace/screenshots, short model table and cost, checked PDF,
operator verdict, and concise physician notes. Vercel Runtime Logs containing
complete synthetic diagnostics remain only under Hobby's one-hour retention
and are inspected in place; do not export or retain them as raw infrastructure
logs. Never retain credentials, real clinical data, exported browser storage,
or deployed case state. Reviewers clear the disposable local browser state after the session.
The retained browser trace is the sanitized checkpoint record defined above,
not a Playwright archive or another capture of browser/network session state.
Remove preview access after review unless continued access is approved.

A passing implementation remains an experiment until separately accepted as a
production seed. Preserve a failed branch or named commit as falsification
evidence rather than merging it. Copy nothing into legacy Wilson or Nightjar.

Slice 4A requires Vercel team/project access and the short-lived credential
handoff above. Slice 4B additionally requires an Anthropic API organization/key,
the selected preview/cookie secrets, and physician-session logistics. Missing
access is a concrete blocker; it does not authorize silent provider, plan, host,
or persistence substitution.

## Authorization boundary

The product, interaction, architecture, fixed journey, question budget,
supported/deferred scope, stack, verification, deployment, retention, stopping,
and delivery topics are closed for Experiment 1 as amended above. Legacy reuse
is decided only when a slice proposes a specific asset, and legacy Wilson's
operational disposition is separate work.

Nothing in this document authorizes application implementation, external
deployment, spending, real clinical data, production release, or expanded
scope. Slice 4A and Slice 4B each begin only after Steve's explicit
implementation go-ahead.
