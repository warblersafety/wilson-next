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
| 3 | Repeated-product update | Boundary accepted | Passed during run; later evidence limitation recorded | 3,537 | 1,999 | 22,868 ms | $0.027064 |
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
conflict with `2026-07-01`. The date excerpt omitted the separate sentence
`I cannot resolve which date is correct`, however, so the evidence did not
independently explain why the new date remained an alternative rather than a
correction.

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
shows that the current prompting did not consistently produce evidence excerpts
that were self-contained enough for operator review on any of the three calls,
and that one clinically meaningful modifier was omitted.

This is not a clean pass against every prewritten Stage 2 criterion. It does
not establish a failure rate, clinical reliability, assembled browser-product
behavior, operator usefulness, PDF agreement, production readiness, or value
with real clinical data. Those questions remain outside this three-call gate.

## One bounded remediation confirmation

Steve authorized one general prompt/schema remediation and one bounded
confirmation batch. Commit `f126c8e` made completeness outrank brevity,
required preservation of explicitly stated descriptive detail except for the
two approved normalizations, added the same guidance to the structured schema,
and changed no runtime semantic validation or expected-answer boundary.

The confirmation used `claude-sonnet-5`, prompt revision
`wilson-experiment-2-boundary-v2`, schema revision
`wilson-grounded-proposals-v7`, zero retries, and the same USD 5 cap. The first
rich-opening call used 3,079 input tokens and 3,357 output tokens, took 28,514
ms, and cost an estimated $0.039728.

The remediation fixed the lost modifier: the model proposed `diffuse hives`
and `facial swelling`. It also produced substantially more complete product
and event quotations. It did not fully satisfy the evidence rule, however.
Patient and event quotations such as `he was treated with epinephrine and
diphenhydramine` and `he recovered and was discharged on 05-Aug-2026` still
depend on an unidentified pronoun and therefore cannot independently identify
`TEST-68` without surrounding input or target metadata.

The operator recorded a failed semantic verdict. The runner stopped before the
repeated-product opening and update, so the confirmation made exactly one model
call with no retry. No further prompt iteration is authorized or recommended
inside this slice. Across the initial batch and confirmation, Stage 2 made four
application-model calls and recorded $0.142374 total estimated spend.

## Owner disposition

On 2026-09-09, Steve accepted the remaining pronoun/context evidence weakness
as a known, non-blocking limitation for proceeding toward the remaining
synthetic operator experiment. Stage 2 is therefore complete as a qualified
result, not an unqualified pass. The correct values, product identity, and later
update behavior provide enough signal to move toward the separately controlled
assembled-product work without another Stage 2 prompt change or model call.

This decision preserves rather than closes the limitation. Reconsider it if the
assembled workflow causes practical evidence confusion or wrong attribution,
or when later external-participant, clinical, or production readiness makes
independently understandable evidence necessary. No separate issue is created
while no remediation is planned; create one if later evidence makes the work
independently valuable.

## Final narrow review

Claude Sonnet 5 at high effort reviewed the exact post-review delta
`54c0211...65c7dca` under `wilson-review-v1`. After a same-session continuation
completed two initially omitted governing-document reads, the canonical result
reported no blocking findings and two non-blocking follow-ups limited to the
one-time interruption recovery: reduced proposal/evidence detail on resume and
missing focused tests for resume-fail and malformed retained state.

Both follow-ups are retained with dispositions in
[`../reviews/65c7dca/dispositions.md`](../reviews/65c7dca/dispositions.md). No
further Stage 2 use of the recovery path is planned, so neither finding justifies
additional implementation or a separate issue now. Reconsider them before
reusing that recovery mechanism. The complete invocation prompts, canonical
result, measurements, and review-process deviations are retained beside the
dispositions.
