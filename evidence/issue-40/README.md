# Issue 40 correction/conflict integrity evidence

**Status:** Root cause confirmed and independent pre-implementation review complete; implementation pending

**Issue:** [#40](https://github.com/warblersafety/wilson-next/issues/40)

## Observed protected-preview failure

Steve's synthetic operator run reached the correction composition but could not
resolve the apixaban start-date conflict. Diagnostic reference
`404be11d-e10a-4159-9814-1a472af34c8d` reconstructed one 13-event case request
on protected deployment `dpl_8xtFijntjaRBS66g9pbmvLmjkGKS`.

The browser submitted `resolve-date` from `correct`, revision 7. The server
accepted proposal group `apixaban-date-conflict`, but the resulting case was
`output-resolved`, revision 8, with 12-Aug-2026 still resolved, no conflicting
values, and the correction source added to the existing value. The next
`resolve-conflict` command therefore failed because the fact was not
conflicted. The response was HTTP 400 and the browser retained revision 7.
Four deliberate operator attempts repeated the same deterministic failure;
there was no hidden retry or provider call during resolution.

The source excerpt stated that the medication administration record listed
13-Aug-2026 while the note said 12-Aug-2026. The correction model nevertheless
proposed the already accepted 12-Aug value. The correction request supplied
only the new paragraph and no relevant reviewed case context. The UI then hid
that model error by rendering fixture-expected dates rather than actual
proposal values, and the service assumed accepting the group necessarily
created a conflict.

The request-local repository discarded the intermediate command state when the
request failed, so accepted browser state remained intact. This evidence
confirms a model-context, presentation, and deterministic action-contract
defect rather than Vercel transport, persistence, or source-offset failure.
No raw Runtime Logs or provider response were retained.

## Pre-implementation review

Steve authorized exactly one targeted Claude Sonnet/high read-only review of
the proposed fix before implementation. The review ran from a fresh,
non-persistent Claude Code 2.1.241 session at exact commit
`c13289857f0963593284bc57dbc773ec0178817f`. Anthropic API and gateway
variables were unset; the preflight reported the active `claude.ai` Max
subscription. The session used `claude-sonnet-5`, high effort, read-only tools,
no web search/fetch, no subagent, and no permission denial. It made no file,
GitHub, application-model, or deployment change.

The reviewer found no governing-document contradiction and confirmed all three
root-cause elements. It identified one blocking scope gap: the same duplicate
proposal sent through `leave-date-unresolved` would not throw. It would silently
advance to `output-resolved`, losing the clinician's decision to defer. That is
the same defect and must be covered by Issue #40 rather than split out.

## Dispositions before implementation

- **Include both actions.** The distinct-value requirement governs direct
  resolution and leaving the date unresolved. Neither action may accept a
  same-value proposal as a conflict.
- **Check before acceptance.** The reviewer suggested checking the resulting
  fact after accepting the group. That would still merge the duplicate source
  into the active value and can silently reach resolved output. Wilson instead
  checks the pending proposal against the reviewed value before accepting the
  group. A duplicate remains proposed and visibly blocks conflict actions.
- **Pass minimal current context.** Only the reviewed naproxen dose and
  apixaban start date needed by the fixed correction catalog enter the
  correction request. This is fresh server-supplied request context, not hidden
  model conversation state or full-case disclosure.
- **Render actual state.** The correction explanation, current value, proposed
  value, evidence, and available actions derive from the snapshot. No expected
  date is hard-coded as though the model returned it.
- **Keep the valid path small.** A genuinely distinct alternative retains the
  existing single clinician action and request-local two-command sequence. The
  precondition makes the second command reachable only after the first is
  known to create a conflict. No new command type, persistence, or workflow is
  introduced.
- **Keep duplicate behavior honest.** A repeated current value is not silently
  accepted, rejected, repaired, or treated as a conflict. The UI explains that
  Wilson did not identify a distinct alternative and does not offer conflict
  resolution from that state.
- **Preserve schema meaning.** The prompt revision changes because the model
  receives reviewed context. The structured output schema does not change and
  therefore does not receive a cosmetic revision bump.
- **Focused tests only.** Cover the correction request context, the distinct
  conflict path, and both direct-resolution and leave-unresolved behavior for a
  duplicate-value model double. Do not add a component framework, live call,
  or new browser fixture solely for this branch.

The review's command-ID observation is non-blocking. Both paths intentionally
accept the same semantic proposal group and are mutually exclusive after a
successful action, so Issue #40 does not add identifier churn without evidence
of a defect.

## Boundaries

Issue #40 does not implement source-localization Issue #39, later evals,
physician participation, real clinical data, persistence, another diagnostic
store, automatic retry, provider comparison, a paid plan, or production
deployment. A protected live operator run requires separate authorization.
