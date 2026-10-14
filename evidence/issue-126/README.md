# Issue #126 — product count/readiness agreement

## Scope and contract

The retained case still supports three products. The bounded form output supports
at most two non-device suspect products and one concomitant product; one suspect
device remains supported separately, while concomitant devices remain unsupported.
Readiness now uses the same D/F capacity constants as the PDF adapter. Excess
counts produce an explicit pre-export limitation, not a late generation error.
No product/fact is pruned, reclassified or withdrawn by capacity checking.
This repair does not implement continuation pages or complete overflow support.

## Synthetic verification

Node 24.20.0, existing dependencies, no live application-model calls:

- Typecheck and fresh build pass.
- All 245 deterministic tests across 36 files pass.
- All 16 mock Chromium journeys pass (1.3 minutes).
- The new 11-case focused suite and two browser journeys pass; stronger final
  independent per-section PDF assertions were separately rechecked successfully.
- New service cases cover two suspects/one concomitant; three non-device
  suspects including an `other` product; two concomitants; a device plus two
  non-device suspects; device/suspect/concomitant; multiple suspect devices;
  and a concomitant device. Supported cases independently read the actual
  D1/D2, E and F product names from the generated PDF with pypdf.
- Excess-capacity preview/download requests return 409 `pdf-not-ready` before
  adapter generation. Adapter count guards remain and reject excess direct calls.
- Snapshots/projections retain all products and do not mutate case knowledge.
  Explicit role corrections restore readiness while preserving identities,
  unrelated facts, other products and supersession history. Explicit withdrawal
  retains inactive history and changes the count only through the existing command.
- Browser cases cover visible limitation, disabled generation without a PDF
  request, narrow layout, explicit correction/recovery, actual eight-page PDF
  download and independent D1/D2/F names, return to excess capacity, truthful
  earlier-PDF status, and a second recovery. Interpretation requests are prohibited
  by the test; none occur.

Existing Review-details and output status text now distinguish capacity limits
from unfinished review, including when an earlier PDF exists. The existing
layout, editor, clinician authority, questions and projection are retained.
Full Form 3500 coverage, more retained products, continuation/attachment support,
conversational test identity and other recorded fidelity gaps remain separate work.

Independent review recorded other PDF representability failures as follow-up
#128; this count-specific fix does not claim that every possible reviewed value
can already be exported. The existing Review-details status messages were also
made truthful for a count block, without changing navigation or acceptance.
