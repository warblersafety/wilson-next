# Experiment 2 Stage 2 live result

**Run date:** 2026-09-09

**Branch target before recovery:** `54c02117ccdbab69d9d4143b44d0a4640e62930e`

**Authorization:** Issue #47's rich opening and repeated-product opening/update,
exactly three application-model calls, no retries, and a USD 5 total cap.

**Model:** `claude-sonnet-5`

**Prompt revision:** `wilson-experiment-2-boundary-v1`

**Schema revision:** `wilson-grounded-proposals-v6`

The expected answers remained solely in `assessment.md`. The production model
request and runtime validation received no answer catalog. Runtime checks
accepted only mechanically valid structured proposals and exact source spans;
the operator compared every displayed proposal with the external assessment
before allowing the next call.

## Results

| Call | Input | Model result | Human assessment | Input tokens | Output tokens | Latency | Estimated cost |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | Rich opening | Boundary accepted | Continue with recorded limitations | 2,741 | 2,641 | 22,083 ms | $0.031892 |
| 2 | Repeated-product opening | Boundary accepted | Continue with recorded limitations | 2,790 | 3,811 | 25,974 ms | $0.043690 |
| 3 | Repeated-product update | Boundary accepted | Pass | 3,537 | 1,999 | 22,868 ms | $0.027064 |
| **Total** | **Two fictional cases** | **Exactly three calls; zero retries** |  | **9,068** | **8,451** | **70,925 ms** | **$0.102646** |

### Call 1 — rich opening

The model proposed the correct patient, product, event, dates, dose, frequency,
route, indication, stop, hospitalization, treatment, outcome, and discharge
values. It represented the symptoms as `hives` and `facial swelling`, omitting
the modifier `diffuse`. Several exact excerpts supported the value but were too
short to identify both subject and claim without surrounding text, including
`and was hospitalized`, `treated with epinephrine and diphenhydramine`, and
`discharged on 05-Aug-2026`.

Steve directed the experiment to continue so this small failure would not
prevent collection of the remaining bounded evidence. The operator recorded
the omissions as non-stopping limitations; runtime code did not repair or
compare them with the oracle.

### Call 2 — repeated-product opening

The model correctly represented acetaminophen and Tylenol as one product,
ibuprofen as a second product, and attached the right roles, doses, dates,
indications, stop status, event, treatment, outcome, and discharge values to
each. Several evidence excerpts were again too short to identify both subject
and claim without surrounding text. No wrong value, alias split, or
cross-product attachment was observed.

### Call 3 — repeated-product update

The model used the reviewed application-owned product IDs. It proposed the
ibuprofen dose as a correction to `200 mg` and the acetaminophen start date
`2026-07-02` as an alternative, preserving rather than hiding the unresolved
conflict with `2026-07-01`. Both exact excerpts were semantically sufficient.

## Runner interruption and recovery

After call 1, the original Vitest worker could not receive the operator's
terminal verdict. The process was stopped before call 2. The first response,
metrics, and awaiting-review state remained owner-readable only; no call was
retried or replaced.

The bounded repair moved terminal interaction out of the Vitest worker and
allowed only this exact retained rich-opening review to resume. A deterministic
regression proves recovery records the pending verdict, retains its cost, and
starts with only the two unused calls. The repaired run completed calls 2 and 3
in the same terminal process. Raw provider responses and local verdict files
remain ignored, owner-readable local artifacts and are not committed.

## What this establishes

This sample shows that the generalized production model/case boundary can
represent both selected fictional cases, keep repeated products distinct, and
target the later correction and unresolved alternative correctly. It also
shows that the current prompting does not consistently produce evidence
excerpts that are self-contained enough for operator review, and that one
clinically meaningful modifier was omitted.

This is not a clean pass against every prewritten Stage 2 criterion. It does
not establish a failure rate, clinical reliability, assembled browser-product
behavior, operator usefulness, PDF agreement, production readiness, or value
with real clinical data. Those questions remain outside this three-call gate.
