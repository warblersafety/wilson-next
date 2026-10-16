# Frozen general-context prompt experiment

This branch is an experiment, not a shipping change. Do not merge.

The candidate is the exact frozen paragraph in candidate-v1.txt (SHA256 f8f08082e9a982a59ce35e39daf5beb52601976be6b546a7ce646d2d052cafc5). The test pins the unchanged v19 system text and appended paragraph. Model, schema, messages, output format, token limit and other request fields are unchanged; only system text differs. The prompt revision is diagnostic metadata, outside the provider request.

The paired plan is frozen. Latest authorization on issue194 permits the existing single alias to temporarily expose the reviewed, exact-head-CI-verified protected candidate, retaining the same grant/expiry/protection and restoring stable afterward. At most12 new requests/$2 estimated additional; stop after the first two pairs for no useful material improvement or any clear material regression. No source changes, repair, retries or tuning between runs. The explicit no-patient native A1 and partial-date representation gaps remain separate.

Local verification before review: 753 unit tests across79 files, typecheck and production build passed with official Node24.20.0. Full113 mock Chromium journeys are running; their final result must pass before alias exposure. No application-model calls have run for this candidate. Live evidence and actual review/CI outcomes will be recorded on the draft PR. Private share URL and credential values are excluded.
