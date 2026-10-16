# Issue223 — supplied device date precision

Fictional data only. Scope is device implant E6a and explant E6b. The pinned FDA3500 (09/2025) page6 and official instructions explicitly distinguish these from E7 reprocessing. Official instructions allow month/year or year-only when components are unknown: https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500

Explicit complete dates retain native formatting. Partial notes retain exact supplied wording/context/source; no missing day/month, implantation/removal status, chronology, duration, clinical outcome or causality is inferred. E6a/E6b continuations have copy-local native pointers, global device ordinal and report reference. Extra E copy retains the correct identity even for same-named devices. Non-device/F roles retain facts with non-carried notices.

Browser v27 accepts current precision and validates genuine v26 against its frozen schema before lossless migration. Invalid legacy full dates remain retained and block fresh output. Device-detail raw drafts survive reload; malformed partial drafts cannot become accepted facts. Model boundary requires exact cited wording and explicit year; this is structural/mock evidence, not a claim of broad live interpretation reliability.

Verification records below will identify final local tests, independent review and CI checkpoints. No new dependencies or live application-model calls.

Local candidate: 1,038 unit tests/98 files, typecheck/build and two focused mocked browser journeys passed. Full161-journey run is in progress. Current retained PDFs: implant-month (9 pages), explant-month (9), second-device-mixed-dates (19), each independently read with pypdf and rendered with macOS PDFKit (9 captures). Native page6/extra-copy page14 markers and continuation bodies were visually inspected: readable and unclipped. Full browser/hosted artifacts and independent review/CI outcomes are pending at this snapshot.
