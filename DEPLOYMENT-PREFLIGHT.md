# Wilson deployment preflight

**Status:** Approved by Steve on 2026-09-04; no implementation authorized by
this document

**Prepared:** 2026-09-04

**Applies to:** `ARCHITECTURE-PROPOSAL.md`, `EXPERIMENT-1-PROPOSAL.md`, and
`VERIFICATION-STRATEGY.md`

## Executive summary

Wilson Next should begin as one small web application, running on one ordinary
server. The clinician sees the approved Wilson screens in a browser; the same
application keeps the temporary case, asks one model to extract candidate
facts, and fills the official FDA PDF. There is no database, account system,
microservice, agent framework, or cloud platform inside the platform.

The recommended stack is mostly the already-proven Wilson baseline: Node,
strict TypeScript, React through Next.js, Zod, Claude Sonnet 5, Vitest, and
Playwright. It deploys as one continuously running Render service behind a
simple Wilson preview password. One browser test uses predetermined model
responses to make the application journey repeatable; the deployed preview and
physician session use the real model.

This is intentionally a short-lived, production-shaped preview rather than a
production system. The choices below buy the shortest credible path to the
physician session while preserving the case-integrity rules already approved.
The first implementation slice resolves the only meaningful library risk—the
FDA PDF—before substantial UI work is built.

## Approved decision

The approved stack and execution boundary for Experiment 1 are:

- Node.js 24.20.0 LTS, npm, strict TypeScript, React, and Next.js 16.3.3;
- plain CSS with CSS Modules and the approved Wilson visual tokens, with no UI
  kit or CSS framework;
- Zod 4 for the one runtime case/model schema boundary;
- Claude Sonnet 5 through Anthropic's TypeScript SDK, with structured output and
  synthetic data only;
- `@cantoo/pdf-lib` 2.9.1 as the first low-level implementation of the real FDA
  PDF filler, subject to the small compatibility gate below;
- Vitest 4.1.11 for focused domain tests and Playwright for one Chromium
  journey, following prior Wilson's established test setup;
- one paid, single-instance Render web service with in-memory session state;
- a shared preview password followed by a signed, secure browser cookie; and
- one short-lived `codex/` issue branch and reviewed pull request per meaningful
  slice, a committed npm lockfile, one small CI workflow, and no Nightjar
  involvement.

Approval also authorizes the time-boxed `pypdf` fallback described below if the
TypeScript PDF candidate fails its compatibility gate. It does not authorize
real clinical data, durable storage, production release, broad Form 3500
coverage, any deferred feature, or an external purchase without confirming the
then-current price and permission to spend.

## Why this is the next step

The product, UI checkpoint, architecture, browser experiment, and minimum
verification floor are settled. The remaining uncertainty is whether those
decisions can be assembled and deployed without choosing infrastructure that
quietly contradicts them.

This preflight closes that stack gap. It does not start implementation. Steve's
remaining topics must be discussed, and implementation still requires an
explicit go-ahead. When that happens, work starts with a narrow technical proof
and then follows the approved journey to the physician.

The doctor-first rule is still the filter. Every selected tool either enables
the browser-to-PDF journey, protects the canonical case, or makes the physician
session safe and interpretable.

The [Experiment 1 system diagrams](docs/experiment-1-system-diagrams.md) show
where these selected runtime choices fit while separating the experiment's
actual build from future possibilities. They do not independently authorize
implementation.

## What comes from prior Wilson and Lucy

This is a validated baseline and reuse audit, not a greenfield stack design.

- Prior Wilson already used Next.js, React, strict TypeScript, Zod, Claude
  Sonnet 5 structured output, and Vitest. WN keeps that combination, with only
  current patched versions.
- Prior Wilson already placed the live Claude call behind a narrow proposal
  function and supplied scripted responses at the same seam for deterministic
  testing. WN keeps that pattern. The scripted path tests the application; the
  live path tests the model and powers the physician preview.
- Lucy established the server-side filled-FDA-form pattern for Form 3500B.
  Prior Wilson carried it to the real Form 3500 with a versioned field manifest,
  Python filler, API wrapper, and tests. WN should reuse the validated form,
  field names, mapping evidence, fixtures, and relevant tests.
- WN does not reuse prior Wilson's PDF-field-keyed case record, correction
  machinery, or broad question flow. Those are the parts the recovery found
  structurally wrong for the new product.

The genuinely new choices are therefore narrow: the semantic case and single
write boundary already approved, a host compatible with server-owned in-memory
state, the preview gate, and whether the final FDA form can be filled without
carrying forward PyMuPDF's licensing obligation.

## Recommended stack in plain English

| Choice | What it means for a non-technical reader | Why it is the 80/20 choice |
|---|---|---|
| Node 24 LTS + TypeScript | The application uses one current, well-supported programming environment, and the code describes the kinds of data it expects. | Node recommends an LTS line for production, and this continues prior Wilson's language and runtime direction. |
| Next.js 16.3.3 + React | One framework supplies the web screens, server endpoints, build, and deployment entry point. | It is the patched continuation of prior Wilson's framework, without requiring advanced caching or server-action features. |
| Plain CSS Modules | Wilson's approved visual system is implemented directly rather than translated into a third-party design kit. | Four checkpoint screens do not justify a component system or styling framework. |
| Zod 4 | One schema checks untrusted model output at runtime and also supplies the JSON shape requested from the model. | It avoids maintaining separate TypeScript, validation, and model-output definitions. |
| Claude Sonnet 5 | One capable model proposes structured facts from the clinician's words. It does not run the conversation or change the case. | It matches prior Wilson operational experience, supports schema-constrained JSON, and avoids comparing providers before evidence says that is necessary. |
| `@cantoo/pdf-lib` | A small TypeScript library performs the last step of the real FDA PDF filler: writing reviewed values into the official form. | A local probe shows that it handles this encrypted form and produces visible text and checkmarks, so a second service or language is probably unnecessary. |
| Vitest + Playwright | Small logic tests protect case rules; one headless browser repeats the whole synthetic journey using scripted model responses. | These continue prior Wilson's established tools but apply only the approved minimum checks. There is no coverage platform or browser matrix. |
| One Render service | One continuously running server holds each temporary case in memory and serves the preview over HTTPS. | It matches the approved single-process state model without adding Redis or a database. |
| One shared preview gate | The physician enters one temporary Wilson password, then uses the app normally for that browser session. | It protects a synthetic preview without building accounts or imposing a vendor login on the physician. |

Node's release guidance says production applications should use an Active or
Maintenance LTS release; Node 24 is the current LTS line. Next.js supports a
standard Node server with all framework features, and its August security
release identifies 16.3.3 as Active LTS. See the official
[Node release table](https://nodejs.org/en/about/previous-releases),
[Next.js deployment guide](https://nextjs.org/docs/app/getting-started/deploying),
and [Next.js release notice](https://nextjs.org/blog).

## Deliberately simple framework use

Next.js is used as an application shell, not as an architectural pattern.

- Browser interactions call explicit route handlers.
- `applyCaseCommand` remains the only consequential write boundary.
- Domain modules have no Next.js imports.
- The model and FDA PDF filler remain behind narrow server-only adapter
  boundaries.
- No Server Actions, edge runtime, static regeneration, framework cache,
  streaming protocol, or serverless-only feature is needed for Experiment 1.
- No state needed by the case is stored in React components or browser storage.

A React Router/Express application would also work, but Wilson would need to
assemble its own server integration, API conventions, production build, and
asset handling. That is more wiring for the same one-page experiment. A static
SPA is not viable because the model credential, authoritative case, and PDF
generation belong on the server.

## Model selection and boundary

Use `claude-sonnet-5` for the first real-model samples. Send each clinician
input to one Messages API call with `output_config.format` set to the JSON Schema
derived from the Zod proposal schema. Do not set temperature, top-p, or top-k;
Sonnet 5 rejects non-default sampling values. Record the returned model ID,
prompt revision, schema revision, latency, token use, and approximate cost in
the short experiment report.

The model receives the fixed synthetic transcript and returns proposals plus
source excerpts. Authored application copy asks the single follow-up. The model
does not receive tools, browse, maintain a hidden conversation, decide which
facts are true, resolve conflicts, or produce PDF fields.

Anthropic documents Sonnet 5 at USD 2 per million input tokens and USD 10 per
million output tokens and describes it as its speed/intelligence balance. Its
structured-output feature guarantees schema-shaped JSON through constrained
decoding. See the official
[Sonnet 5 notes](https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5),
[structured-output guide](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
and [TypeScript SDK guide](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript).

GPT-5.6 Terra is a credible fallback, not a model to test in parallel. Official
OpenAI documentation describes it as balancing intelligence and cost, with
structured outputs at USD 2 input and USD 12 output per million tokens. Running
both providers before the selected model fails would double integration and
evaluation work without improving the first physician signal. See the official
[GPT-5.6 Terra model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

### Data boundary

Experiment 1 remains synthetic-only even though Anthropic documents that normal
Messages API conversation content is not retained by default for eligible
models and that structured outputs can be eligible for zero data retention.
Those statements do not substitute for an executed agreement or authorize PHI.
See Anthropic's current
[API and data-retention policy](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

The API key exists only in Render and local environment secrets. Narratives,
model payloads, case facts, and PDFs are not logged. The model adapter emits
only request ID, model/prompt/schema versions, timing, token counts, status, and
case revision.

## PDF decision and compatibility gate

### Evidence already gathered

On 2026-09-04 the current PDF downloaded from the FDA was byte-for-byte
identical to the historical Wilson copy:

```text
Form FDA 3500 (09/2025)
SHA-256 1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c
```

The current form is an encrypted PDF with an empty viewing password. In a
temporary, non-product probe, `@cantoo/pdf-lib` 2.9.1:

- opened the official bytes with the empty password;
- enumerated 239 terminal form fields;
- filled representative patient, narrative, product, and checkbox values;
- allowed those values to be read back; and
- produced a page that macOS Quick Look rendered with the expected text and
  checkmark.

The package is MIT-licensed, runs in Node, supports encrypted documents, and can
fill forms. See its maintained
[npm package documentation](https://www.npmjs.com/package/@cantoo/pdf-lib).
The authoritative source remains the FDA's
[current Form 3500 PDF](https://www.fda.gov/media/76299/download?attachment=).

This probe reduces risk; it is not enough to declare the adapter complete. The
library's reload path also reports a residual encryption marker unless loaded
in inspection mode, even though an independent parser regards the output as
unencrypted. That quirk is one reason to keep the first implementation gate
explicit.

### First implementation gate

Before building substantial UI, create the versioned FDA PDF filler behind the
approved narrow adapter boundary for only the Experiment 1 fields. It must:

1. reject any source PDF whose version or checksum differs;
2. fill a representative text field, multiline narrative, choice, checkbox,
   and both supported product rows;
3. read the supported values back programmatically;
4. render the relevant pages in Chromium and inspect them visually; and
5. preserve the expected eight-page form and approved visible form identity.

Time-box this to half a working day. If it passes, `@cantoo/pdf-lib` is the
Experiment 1 adapter and no Python or container is introduced.

If it fails, do not repair or fork a PDF engine. Use `pypdf` 6.16.2 plus its AES
dependency in a small Python subprocess behind the same adapter port, packaged
with the Node application in one Render container. The temporary probe already
showed that `pypdf` decrypts the current form, finds 282 field/group entries,
fills text and checkboxes, writes an eight-page result, and reads the values
back. Give the fallback no more than one additional working day to pass the same
visual gate; otherwise stop and reopen the PDF premise.

PyMuPDF is not selected despite its historical Wilson success. Its publisher
states that proprietary use requires a commercial license or compliance with
the AGPL. That licensing decision is unnecessary while permissive candidates
remain viable. See the official
[PyMuPDF licensing page](https://pymupdf.io/).

## Runtime state and preview access

The server holds cases in a module-owned `Map` behind a repository interface.
A cryptographically random session ID in a secure browser cookie selects the
case. Entries expire after eight hours of inactivity and the preview supports
only a small fixed number of simultaneous sessions. Restarting or redeploying
loses the case, as already approved.

The preview gate is deliberately not an account system:

1. an unrecognized browser sees a Wilson-branded password screen;
2. the server compares the submitted shared secret with the Render environment
   secret;
3. success sets a signed, non-persistent `__Host-` cookie with `Secure`,
   `HttpOnly`, `SameSite=Strict`, and `Path=/`; and
4. every page and API route except login, static assets, and a content-free
   health endpoint requires that cookie.

State-changing requests use non-GET methods and reject a mismatched Origin.
Responses containing case data or PDFs use `Cache-Control: no-store`. The app
also sends `X-Robots-Tag: noindex, nofollow`, but indexing directives are not
treated as access control. OWASP recommends secure, HttpOnly, SameSite cookies
and cautions against storing session identifiers in browser storage; see its
[session-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Deployment decision

Deploy one instance of the ordinary Next.js Node server to Render in the same
US region for the whole experiment. Use the smallest continuously running paid
web-service plan during physician access, managed TLS, environment secrets, and
a `/healthz` readiness check. Pin Node with `.node-version`; Render itself
recommends pinning and an upper-bounded package engine rather than inheriting a
moving default. See Render's
[web-service](https://render.com/docs/web-services),
[health-check](https://render.com/docs/health-checks), and
[Node-version](https://render.com/docs/node-version) documentation.

Do not use Render's free plan for the physician session. It spins a service down
after 15 idle minutes and can take about a minute to wake, which creates exactly
the sort of avoidable first-use friction Wilson is meant to reduce. See
[Render's free-service limits](https://render.com/docs/free).

Do not use Vercel for Experiment 1. Vercel is a natural Next.js host, but its
compute dynamically routes requests among instances. Making Wilson's in-memory
case dependable there would require an external store or a change to the
approved state boundary. See Vercel's official
[compute description](https://vercel.com/docs/fundamentals/what-is-compute).

Run only one Render instance: multiple instances would each have a different
in-memory case map. No database, Redis, persistent disk, worker, queue, object
store, analytics service, or custom domain is needed. Do not deploy or restart
during the physician session. Remove the service or its access after the
approved review window.

## Testing and repository controls

Use npm and commit `package-lock.json`. Pin direct dependencies, the Node patch,
the PDF checksum, the model/prompt/schema revisions, and the Playwright Chromium
version resolved by the lockfile. Dependabot, Renovate, automated releases, and
multi-environment infrastructure are deferred.

Use Vitest 4.1.11 for the small pure-domain suite. Prior Wilson already used and
configured Vitest for its TypeScript domain and model-boundary tests. Retaining
that known setup is simpler than introducing a new runner merely to remove one
development dependency. WN does not port prior Wilson's hundreds of tests; it
uses Vitest only for the approved focused behaviors. See the official
[Vitest 4 guide](https://v4.vitest.dev/guide/).

Use Playwright Test with Chromium only for the one approved deterministic
browser journey. Playwright supplies isolation, accessible locators, tracing,
screenshots, and headless execution without a separate browser harness; see its
[installation and capability guide](https://playwright.dev/docs/intro).

One GitHub Actions workflow runs, in order:

```text
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The end-to-end test uses predetermined model responses and does not need
credentials. It validates rendering, flow, case behavior, and PDF generation,
not model reasoning. Real-model samples and deployed smoke checks remain
explicit, capped operator actions; they do not run on every push. Coverage
collection and thresholds remain deferred.

Implementation follows the approved
[development process](DEVELOPMENT-PROCESS.md): one short-lived `codex/` issue
branch and one pull request per meaningful slice, one fresh-context technical
review, and Steve's approval before squash merge. `main` rejects direct pushes,
force pushes, deletion, and routine bypass. The single `verify` job becomes a
required status check after the initial workflow exists. Multiple promotion
branches, merge queues, release automation, and a multi-package repository
would add process without protecting the first physician session.

## Stop-and-reconcile rule

Implementation is expected to reveal places where the plan is incomplete or
wrong. That discovery is evidence, not permission to hide the mismatch in a
special case. Stop only the affected slice when continuing would require any of
the following:

- changing clinician-visible behavior or the meaning of accepted knowledge;
- bypassing or duplicating the semantic case or `applyCaseCommand` authority;
- putting form-widget, UI, model-provider, or deployment details into the
  domain to make an awkward path work;
- weakening an invariant, validation failure, stopping criterion, privacy
  boundary, or test so the implementation passes;
- adding a silent fallback, retry, coercion, or data loss path; or
- expanding supported fields, journeys, infrastructure, or model
  responsibilities beyond the approved experiment.

When a trigger occurs:

1. Preserve the smallest failing example and stop the affected work; unrelated
   work may continue.
2. Record a short repository note in the active change: what the plan expected,
   what implementation revealed, which authority owns the mismatch, the
   smallest viable options, and the recommended choice.
3. If it is an ordinary implementation defect within the approved behavior,
   fix the code and add only the focused evidence needed to prevent recurrence.
4. If the product, interaction, architecture, experiment, or preflight premise
   is wrong or ambiguous, update that owning artifact and obtain approval for
   the consequential change before resuming the affected work.
5. Change tests only after the owning decision changes; a test may not be
   weakened merely to bless the workaround.

This rule is not an RFC process for routine coding choices. Reversible naming,
file organization, local refactoring, library API adaptation, and visual polish
within the approved behavior remain implementation discretion. Escalation is
required when the choice changes user experience, semantic truth, authority,
scope, privacy, evidence, or an externally consequential technical commitment.

## Implementation order when implementation is later approved

### Slice 0 — prove the FDA PDF filler

Scaffold the pinned application and pass the half-day TypeScript PDF gate. Stop
or take the pre-approved bounded fallback if it fails.

### Slice 1 — protect the case

Implement the semantic case, `applyCaseCommand`, in-memory repository, pure
views/projection, Zod boundary, and the focused deterministic tests. No polished
UI is required yet.

### Slice 2 — assemble the approved browser journey

Build the four checkpoint screens and seven-state journey from the approved
mockups. Connect them to explicit routes and the scripted model-response seam
already proven in prior Wilson. Complete the one Playwright Chromium test and
generate the checked real FDA PDF.

### Slice 3 — try the real model

Connect the live Claude model and inspect no more than four samples or USD 5. A
stopping failure reopens the model boundary; it does not trigger hidden retries,
prompt-platform work, or a second provider comparison by default.

### Slice 4 — physician-ready preview

Add the preview gate, deploy one Render instance, run the operator smoke test,
and visually compare the downloaded PDF. If the minimum evidence is green,
schedule the observed synthetic session with one physician immediately.

No slice waits for broad coverage, reusable eval infrastructure, general form
support, durable data, or UI polish beyond what makes the approved journey
clear and credible.

## Inputs needed during implementation

These are setup inputs, not new design phases:

- access to an Anthropic API organization with billing and a server-side key;
- access to a Render workspace and permission to create one small paid service;
- a temporary high-entropy preview password and cookie-signing secret; and
- the physician-session date, browser constraints, and person authorized to
  observe and take brief notes.

If an account or credential is unavailable, report that concrete blocker before
substituting a provider or host. Do not broaden the stack silently.

## Approval consequence

Approval closes the deployment-preflight topic for Experiment 1. It does not
start implementation: Steve has identified additional topics to discuss, and
an explicit implementation go-ahead remains required. When that authorization
arrives, work follows the order above under the approved architecture,
experiment, UX checkpoint, and verification strategy. The first external
milestone is not “finish the application”; it is “put the smallest credible
assembled Wilson journey in front of one physician and learn whether the
direction deserves another slice.”

### Approval record

On 2026-09-04, Steve approved the complete Experiment 1 deployment preflight,
including the selected stack, PDF compatibility gate and bounded fallback,
model boundary, single-instance Render deployment, temporary in-memory state,
shared preview lock, minimal test and repository controls, implementation
sequence, and stop-and-reconcile rule. This approval closes the preflight; it
does not start implementation.
