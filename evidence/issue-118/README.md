# Issue #118 — non-blocking browser diagnostic delivery

Browser telemetry no longer gates useful request dispatch, response acceptance,
PDF availability or error feedback. Each diagnostic fetch starts immediately
with a one-second abort deadline; reporting returns without waiting for network
delivery. Synchronous errors and rejected delivery promises are contained. Event
payloads are serialized when sent, retaining redaction, operation/run correlation,
sequence and cumulative traces without a durable queue or new service.

The deadline limits native fetch resources, not useful application latency.
Telemetry can be lost on timeout, offline state or navigation and can arrive out
of order. No guarantee of complete runtime logs or live-model reliability is
introduced. The application/PDF transport and semantic authority are unchanged.
The original strict usability test and its timeouts are unchanged.

## Verification

Explicit Node 24.20.0; installed dependencies and independent PDF reader only.
Typecheck, fresh build and all 295 unit tests across 39 files pass. Twelve new
unit checks hold, reject or synchronously throw diagnostic delivery while useful
JSON/PDF responses and errors complete; they verify correlation, trace snapshots,
request redaction, malformed/transport error preservation, native abort signals
at the resource deadline and timer cleanup. No live application-model calls.

The new real-control Chromium journeys hold every diagnostic request or abort
logging transport. Both modes must load the initial UI, retain failed opening
and update text/accepted state, accept synthetic successful transport responses,
and recover a PDF failure by generating the actual PDF from the retained case.
Two-second UI assertions run while telemetry remains held/offline. The synthetic
unchanged case responses isolate browser transport/feedback from interpretation;
existing full mock journeys retain interpretation/review/PDF regression evidence.
All 23 full mock Chromium journeys pass (1.3 minutes), including both new modes.
Independent-review and exact-head CI results are recorded on the PR.

Actual Opus high review found no blocking findings. F1 notes that the existing
keepalive transport can reject large reports or overlapping bodies under browser
quotas; this loss cause is now explicit in Architecture. The Fetch Standard's
[keepalive budget](https://fetch.spec.whatwg.org/#http-network-or-cache-fetch)
rejects requests exceeding 64 KiB including in-flight keepalive bodies. Actual
successful-case diagnostic sizes and a transport/payload adjustment remain a
follow-up; this slice does not claim complete browser-report delivery. The
reviewer ran no tests and did not independently inspect CI.
