# Wilson post-mortem review and source inventory

**Status:** Evidence review complete as of 2026-09-04  
**Role:** Supporting evidence for `RECOVERY-BRIEF.md`; not product or
architecture authority

This file records where the Wilson post-mortem work landed, what was reviewed,
how later evidence corrected earlier claims, and which preservation gaps remain.
It does not copy the research corpus or turn Nightjar material into recovery
instructions.

## Result

The integrated Wilson and sofa-claude post-mortems live primarily in the local
`nightjar-research` repository, not in legacy Wilson, sofa-claude, or the actual
Nightjar repository. The corpus is clean at commit `589aaa3` (`Close Milestone
1 review findings`) but has no configured remote.

Legacy Wilson contains the primary product evidence and governing documents.
sofa-claude issue #49 contains an earlier process retrospective. The actual
Nightjar repository deliberately excludes the post-mortems and contributes no
additional Wilson evidence.

## Sources reviewed

### Integrated synthesis and detailed reviews

- `nightjar-research/reviews/executive-summary.md` — best combined overview.
- `nightjar-research/reviews/wilson/{assessment,postmortem,evidence-ledger}.md`
  — Wilson's state, causal analysis, classified claims, and evidence limits.
- `nightjar-research/reviews/wilson/evidence/` — bootstrap PR, architecture,
  staging, and recovery traces.
- `nightjar-research/reviews/sofa-claude/{assessment,postmortem,evidence-ledger}.md`
  — producing-process analysis and evidence limits.
- `nightjar-research/reviews/sofa-claude/evidence/sofa-claude-github-trace.md`
  — pre-Wilson process changes and the later retrospective trail.

### Corrective and independent review material

- `nightjar-research/meta-review/operator-record.md` — curated recovery of 661
  contemporaneous user messages and sampled assistant replies. It is the
  strongest source for stated operator intent, with the limits described below.
- `nightjar-research/meta-review/{report,executive-summary}.md` — independent
  review that sampled thirteen load-bearing claims, separated representation
  from enforcement, and corrected Wilson's completion verdict.
- `nightjar-research/meta-review/slice0-review.md` and
  `milestone1-review-disposition.md` — later checks confirming that corrections
  entered the research while warning that proposed remedies remained
  hypotheses rather than experimental proof.
- `nightjar-research/reviews/lucy/comparative-assessment.md` — verifies that
  Lucy retained a semantic case record and form-projection boundary that Wilson
  discarded. It also establishes that Lucy was not proven production-ready and
  that greater human contact confounds any claim that architecture alone caused
  smoother development.

### Contemporary product and process evidence

- Legacy Wilson's `docs/{charter,design,ask-copy,round-gate}.md`, Git history,
  source, tests, issues, pull requests, and Actions history.
- [Round-gate #1 evidence](https://github.com/warblersafety/wilson/blob/fb00b17/runs/gate/7f8f1bdb2ef990c4fdb6e3f769e7b4abdb51c8bf/README.md),
  which recorded `NOT READY` and eight assembled-product findings while 885
  tests and typecheck were green.
- Untracked legacy `runs/steve/run1/session-bundle-2026-08-28.json`, interpreted
  with the contemporaneous verdict "somewhat successful" and "tremendous
  slog." It is sensitive, unversioned evidence and not acceptance.
- sofa-claude
  [issue #49](https://github.com/smansf/sofa-claude/issues/49), the earlier
  consolidated process retrospective. It correctly diagnosed missing
  assembled-product review but predates the fuller architectural analysis and
  overstates the historical absence of real-model calls.
- The complete August 25
  [Wilson retrospective](https://claude.ai/code/artifact/1bfb100f-668b-4a12-9745-0dae6e5c37a9),
  also recoverable from local Claude session `4a6aebbb`. It supplies the first
  economics baseline: roughly 28 hours to v1, 14 sessions, 8–52 minute PR
  cycles, about 72 review findings with about 60 fixed pre-merge, and an
  estimated one-third token overhead. Its analysis is earlier and narrower
  than the later post-mortems.
- Wilson [PR #174](https://github.com/warblersafety/wilson/pull/174) and current
  GitHub refs, used to correct the terminal staging chronology.

### Recovery-task provenance

- Codex task `Wilson review (local repo)`
  (`01a05442-f16c-72a0-b5ad-fb8a2bbce8aa`) produced and reorganized much of
  the research corpus before it moved to `nightjar-research`.
- Codex task `Review Nightjar meta-review`
  (`01a05a4a-f195-7132-a7ad-953ac2c9f0a4`) integrated the operator record,
  corrections, and bounded Lucy comparison.
- Codex task `Locate Wilson post-mortem work`
  (`01a06d3b-3fb5-78c3-a762-1ec58fdcac22`) recovered the source trail and
  contains the explicit recovery decisions written into `RECOVERY-BRIEF.md`.

These task transcripts are provenance and context, not higher authority than
the confirmed repository brief or inspected primary evidence.

## Corrections and qualifications carried forward

1. **Real-model history.** Registered live-evaluation workflows had zero runs,
   but ad hoc real-model use occurred against deployed builds. Earlier absolute
   "zero real-model calls" wording is false outside the formal proof system.
   Both registered workflow run counts were rechecked as zero on 2026-09-04.
2. **Terminal promotion.** Contrary to the 2026-09-01 handoff and operator
   record, PR #174 merged `dev` to `staging` at 2026-08-29 23:54:06 UTC. It was
   a declared no-gate promotion with known urgent defects, not acceptance.
3. **Completion.** Wilson's v1.2 completion condition was not met. This is
   determinate. The separate question of whether the final code could have
   become acceptable is unknown.
4. **Failure classes.** Representation, elicitation, and invariant enforcement
   are related but separable. A semantic record and a mandatory enforcement
   boundary address different risks.
5. **Lucy comparison.** Lucy proves that Wilson discarded a real semantic-to-
   form boundary; it does not prove that copying Lucy would have made Wilson
   successful. Lucy also had failures and much more frequent human contact.
6. **August 25 retrospective.** The cloud artifact was listed as missing, but
   its complete text remains recoverable in local session `4a6aebbb`.
7. **Round-gate meaning.** A driver exit code of zero established that scripted
   cases were driveable. It was not the product verdict; the human-readable
   evidence record said `NOT READY`.

## Negative-location findings

- Legacy `warblersafety/wilson` has no standalone final post-mortem.
- `sofa-claude` has process history and issue #49; the integrated detailed
  post-mortem lives in `nightjar-research`.
- The actual `nightjar` repository contains derivative references only and
  deliberately excludes Wilson/Lucy post-mortems.
- `sofa-claude-legacy` contains no Wilson material in the inspected checkout.

This inventory covers post-mortem and directly supporting material found in
the locally available Wilson, sofa-claude, sofa-claude-legacy, Nightjar,
Nightjar-research, Codex-task, and recovered Claude-session stores. It does not
claim that every Wilson issue, commit, source file, or private/missing session
was exhaustively audited. A Git-history path search across the five local
repositories found no additional deleted or moved post-mortem document set.

## Preservation and evidence risks

- `nightjar-research` has local Git history but no remote mirror.
- Raw Wilson and sofa-claude transcripts sit outside repository/versioning
  discipline and may contain credentials, private data, or clinical-style
  narratives. Archiving requires privacy review rather than a blind Git copy.
- Legacy `runs/steve` is untracked and contains a full clinical-style bundle.
- The original Nightjar-research authoring sessions were not located, so parts
  of that corpus lack session-level provenance and cost data.
- The August 23 Vercel token revocation was not verified during this review.
- The local legacy `origin/staging` ref points to PR #158 and is stale; GitHub
  shows remote `staging` at PR #174's merge commit `35c3df3`.
- Wilson remains public, unarchived, and has `dev` as its default branch. Its
  deployment, open urgent issues, evidence retention, terminal notice, and
  eventual naming cutover still require an explicit operational disposition.

## Review boundary

The causal investigation is sufficient to govern the next recovery phase.
Further archaeology needs a named uncertainty that could materially change a
decision and a bounded evidence plan. The source corpus remains available when
a later product, architecture, or reuse claim needs audit support.
