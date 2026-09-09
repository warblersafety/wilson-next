# Experiment 2 Stage 4 protected live observations

This record summarizes the synthetic-only runs made through the protected
Vercel preview on 2026-09-09. It retains the decision evidence without storing
raw model payloads or any real clinical data.

All five calls used `claude-sonnet-5`, prompt revision 2, schema revision 7,
temperature 0, and no retry.

| Journey and turn | Input tokens | Output tokens | Latency | Cost | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Rich opening | 3,079 | 3,800 | 26,093 ms | $0.044158 | `Revise`: diagnostic reference `747868d1-93aa-4e3a-9087-8d7b5aa1d1df`; `symptoms` was a scalar, and event treatments were misclassified as concomitant products; revision remained 0 |
| Sparse opening | 3,005 | 1,368 | 10,929 ms | $0.019690 | Viable; matched the expected opening case state |
| Sparse operator correction | 3,337 | 133 | 2,596 ms | $0.008004 | Viable; retained the product identity, added the high-A1c indication, and preserved evidence history |
| Repeated-product opening | 3,128 | 5,063 | 35,709 ms | $0.056886 | Viable; kept one stable product entity while exposing the dose conflict |
| Repeated-product correction | 3,909 | 796 | 8,322 ms | $0.015778 | Viable; retained the alias, accepted the corrected dose with history, and left conflicting dates unresolved |
| **Total** | **16,458** | **11,160** | **83,649 ms** | **$0.144516** | Two journeys viable; one safely rejected |

The sparse and repeated journeys both reached `POST /api/case/pdf` with HTTP
200. The sparse PDF followed the additional operator correction. The downloaded
live PDF bytes were not retained, so these runs prove route completion but not
independent live PDF agreement. Stage 3 separately retained and read the
deterministic PDFs for agreement.

The disposition is `Revise`, with remediation deferred. No second live samples
ran. Issue #55 preserves the failure classes and objective revisit triggers.

Evidence provenance:

- Vercel Runtime Logs for deployment `dpl_DiWtsH4SqAYvKZJ3D8bbyyfAkqVx`.
- [Protected-preview diagnosis](https://github.com/warblersafety/wilson-next/pull/52#issuecomment-5609150637).
- [Stage 4 outcome summary](https://github.com/warblersafety/wilson-next/pull/52#issuecomment-5609446904).
