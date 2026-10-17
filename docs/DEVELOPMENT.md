# Development and verification

Use fictional clinical and reporter/contact information only. Read [Product](PRODUCT.md),
[Architecture](ARCHITECTURE.md) and [Delivery](DELIVERY.md) before implementation;
[Coverage](COVERAGE.md) bounds what existing checks establish. This guide documents
installed tooling, not authority to install dependencies or call live models.

## Runtime and local application

The exact runtime is pinned in [.node-version](../.node-version), [.nvmrc](../.nvmrc),
[package.json](../package.json) and [CI](../.github/workflows/verify.yml). On the Mini,
the existing official Node 24.20.0 executable is:

```text
/Users/sofa-claude/Documents/Codex/2026-10-13/task-2/wilson-runtime/node-v24.20.0-darwin-arm64/bin/node
```

Use its bin directory explicitly in the task shell's PATH; verify `node --version`
without changing the machine's default Node. Keep one npm lockfile. A clean
checkout normally requires `npm ci`; use existing installed dependencies when
available and respect the task's installation restrictions. Do not introduce a
framework, UI kit or new dependency to work around an unresolved contract.

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The mock browser suite requires a fresh build, installed Playwright Chromium and
independent Python PDF reader. [playwright.config.ts](../playwright.config.ts) starts
its own Next server on 127.0.0.1:3100 with one worker and no reused server. Its
temporary fixture file/preload selects authored deterministic responses before
any Anthropic adapter is constructed. `WILSON_E2E_SCENARIOS` narrows named fixture
scenarios only for appropriate focused work; final full-suite requirements remain.
Do not inject live credentials or mistake authored model outputs for live efficacy.
Local application development refuses live-model construction by design.

## Independent PDF and browser evidence

Existing `.venv-pdf-evidence/bin/python` can be selected with `PYPDF_PYTHON`.
[requirements/pdf-evidence.txt](../requirements/pdf-evidence.txt) pins the independent
reader; CI provisions Python and Chromium as declared in its unchanged workflow.
Use installed tools rather than silently installing/upgrading them for a task.
For a generated scratch PDF:

```sh
.venv-pdf-evidence/bin/python tools/pdf/independent_readback.py /tmp/report.pdf --named --page-text
```

The reader reports actual native values and optional page text/laboratory rows;
continuation text and flattened additional D/E pages need independent content and
render inspection too. [continuation_readback.py](../tools/pdf/continuation_readback.py)
is an existing continuation helper. A semantic adapter echo is not independent
readback. Inspect the actual filled pages in a second renderer/viewer for clipping,
glyph substitutions, cross-references, field/entity alignment and detached-page
attribution. Retain hashes, exact source/commit and declared inspected pages; do
not call rendering alone visual inspection or infer that uninspected pages passed.

The package `evidence:pdf`, `evidence:chromium` and `evidence:slice2:pdf-render`
commands regenerate historical Slice0/Slice2 artifacts at tracked evidence paths.
They are not generic scratch commands: do not run them casually or overwrite
retained history. Existing `tools/pdf/capture_*.m` PDFKit and TypeScript capture
helpers likewise have slice-specific inputs/outputs. Inspect their supported
paths before using them; keep new temporary captures outside immutable evidence.

Use complete synthetic/mock UI journeys for behavior changes, including acceptance,
correction, persistence and actual downloaded PDF where relevant. Browser restart
means a new browser process, not merely reload. Keep useful sanitized checkpoints,
not raw Playwright/session/network archives with cookies or storage. Follow the
owning issue's evidence scope; no live-model run is implied by npm, CI, PDF tooling
or subscription review. [Operations](OPERATIONS.md) covers separately authorized
hosted checks and [Delivery](DELIVERY.md) owns review/merge requirements.
