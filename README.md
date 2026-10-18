# Wilson Next

Wilson helps a healthcare professional describe a suspected adverse event,
review and correct source-backed case knowledge, and download a faithful Form
FDA 3500. Conversation is primary; the form is an output of reviewed knowledge.
Wilson does not diagnose, judge causality, recommend treatment or submit reports.

This is a protected **fictional-data-only development preview**, including
fictional reporter identity/contact details. It is not a complete Form 3500
replacement or a real-patient-data release. Browser-local save/resume supports
one active case and separate reusable reporter details, without accounts.
Successful mocked journeys do not establish live interpretation reliability.
See [coverage and acceptance limits](docs/COVERAGE.md) before testing or making
readiness claims. Preserve the existing conversation-first UI and visual design.

## Current guidance

| Guide | Owns |
|---|---|
| [Product](docs/PRODUCT.md) | Purpose, full-form artificial-data target, interaction contract and non-goals |
| [Architecture](docs/ARCHITECTURE.md) | Semantic case, write/model boundaries, persistence and PDF contracts |
| [Coverage](docs/COVERAGE.md) | Implemented boundaries, remaining scope, paused work and acceptance limits |
| [Development](docs/DEVELOPMENT.md) | Local setup, mock tests and independent PDF checks |
| [Operations](docs/OPERATIONS.md) | Protected-preview provenance, access and non-secret host procedures |
| [Delivery](docs/DELIVERY.md) | Issues, review, authority, merge controls and durable evidence |

Read Product, Architecture and Delivery for implementation; use the other guides
for the selected task. Product governs user outcomes, Architecture governs
semantic authority, and Delivery governs execution. Narrower task instructions
still apply. Reconcile a material conflict in its owning guide before proceeding.
Each lasting decision has one current owner; historical plans are evidence.

## Development entry point

Use the pinned runtime in [.node-version](.node-version) and the installed npm
dependencies. [Development](docs/DEVELOPMENT.md) explains prerequisites and safe
mock verification. The ordinary commands are:

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run test:e2e
```

For existing test layers, counts, fixture provenance, focused selections and live
evidence limits, see the [test and eval catalog](tests/README.md).

Local development refuses live application-model construction; the deterministic
browser suite uses authored responses. Do not export application credentials
into an ordinary development or subscription-review shell.

## Evidence and history

[Evidence navigation](evidence/README.md) distinguishes retained synthetic
artifacts, reviews and historical results from current requirements. The pinned
[FDA source](assets/fda/README.md) owns form provenance. Completed experiment
plans, assessments and checkpoint instructions are available through pinned Git
history, not mandatory current reading. Pre-cleanup originals are also preserved
outside this checkout in the existing Mini-local Wilson archive; it is not a
verified off-device backup. No private originals are published here.

Wilson remains one modular Next.js application, not a monorepo. Legacy Wilson
is read-only evidence and a selective donor requiring revalidation; it is not
the foundation to evolve. Excluded external workflow tools supply no lifecycle
or implementation authority; see [Architecture](docs/ARCHITECTURE.md#deferred-mechanisms-and-stop-conditions).
