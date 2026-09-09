# Review dispositions for `c89e622`

The standard fresh-context Claude Sonnet/high replacement review reported no
blocking findings and two independently valuable follow-ups. Commit
`765728c91227c73da90f9417d575a328eb45f55b` resolves both with bounded changes.
No live Stage 2 application-model call is authorized by this record.

## FOLLOW-UP 1 — missing case-replay safe-failure test

Resolved. The reviewer correctly identified that the deterministic runner tests
cover provider failure but do not directly exercise a proposal envelope that
the authoritative case-command boundary rejects. The actual `stopCaseReplay`
implementation is at `tools/model/run-stage-2-gate.ts:265`; the result's
`960-969` location came from the reviewer's expanded diff display rather than
the source file's line numbering.

The resolving test supplies an invalid source location and proves attachment
failure stops after one model attempt, before human review, and returns neither
a rich nor repeated case. This closes Issue #47's named safe-failure evidence
without expanding the runner.

## FOLLOW-UP 2 — acceptance occurs after all three passing verdicts

Resolved. The reviewed runner accepted pending groups after every passing
semantic verdict at `tools/model/run-stage-2-gate.ts:213`, while Issue #47
explicitly requires acceptance after the repeated-product opening only, to
create reviewed context for the update. The result's `908-922` location
likewise refers to its expanded diff display.

The resolving change accepts only the repeated-product opening. Rich-opening
and repeated-update results remain mechanically attached proposals with a
separate human gate verdict. Focused coverage proves the rich result remains
proposed and the repeated case retains its reviewed pre-update start date,
matching the approved manual sequence.

## Closure evidence

- `npx vitest run tests/server/stage-2-gate-runner.test.ts tests/server/model-sample-artifacts.test.ts tests/architecture/source-boundary.test.ts` — 12 passed.
- `PATH="$PWD/.venv-pdf-evidence/bin:$PATH" npm test` — 101 passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `PATH="$PWD/.venv-pdf-evidence/bin:$PATH" npm run test:e2e` — 2 passed.
- `git diff --check` — passed.
- No application-model call was made.

These local fixes implement the originating review's exact bounded findings and
introduce no new product, semantic, architectural, privacy, scope, or evidence
premise. The originating review covers them under `docs/DELIVERY.md`'s
proportional-closure rule; no recursive review was run.

## Review-process incidents

- The first authorized review read the diff, but its final stdout and usage were
  lost after the coordinator failed to preserve the yielded process handle.
- Steve authorized one replacement review after a separate Sonnet liveliness
  check passed.
- A corrected launch followed one CLI rejection caused by the coordinator
  typing `son`; that rejection consumed zero model tokens and cost USD 0.
- The replacement review durably captured incremental events and the complete
  final result. It made no repository edits, network requests, or subagent calls.

The actual Claude judgment remains verbatim in `claude-review-result.md`; this
file records coordinator dispositions and correct source locations without
rewriting that judgment.
