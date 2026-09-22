# Focused Draft 4 repairs — issue 103

The issue freezes the authorized slice and safeguards from the local handoff and
walkthrough. Local planning documents, mockup archives and walkthrough attachments
remain uncommitted and unchanged, with a private backup/hash manifest.

Successful update submission focuses and scrolls to the proposed-update heading.
Updates that introduce a new card focus that new card ahead of older pending groups.
Per-group decisions restore focus to remaining review, unresolved conflicts or the case summary. The
coverage disclosure separates clinical omissions, reporter information not supplied,
and unsupported form coverage without changing case semantics. Source quotes now
have separate lines, update headings follow the screen hierarchy, button hover text
remains legible, disabled controls have no active shadow, and the mobile privacy
checkbox stays alongside its label.

Local checks: typecheck, 202 deterministic tests, production build, and both focused
Draft 4 browser tests pass (7.4 seconds). Browser assertions cover desktop/mobile
focus and viewport position, retained drafts/proposals, unchanged reporter return,
corrected reporter PDF readback, earlier/current PDF validity and #92 prerequisite
invalidation. Screenshots were visually inspected. The final seven-test browser suite also passes
(1.1 minutes), including newly added new-card and conflict-focus assertions. The
first full run used a legacy helper that clicked navigation after the action, stealing
focus; the assertions now inspect the action directly, without that extra click. Initial test invocation omitted
the existing PYPDF_PYTHON environment and failed PDF imports; rerunning with the
existing .venv-pdf-evidence interpreter passed. No dependency change was needed.

## Bounded PDF discrepancy investigation

The original two attachments retain their recorded SHA-256 values:
- Flattened viewer copy: `95bff917c0c00aefa3a90e6b7d7709c6601cf7a27327f5eb8c1626f7e5800ec0`.
- Direct download: `ba1b73c64ca1e1042dab3b54e5975cb34085a336cac14d83e01fd7af4e334a89`.

**Correction to the local walkthrough observation:** fresh PDFKit rendering of the
original flattened attachment shows D8 “Doesn’t apply” checked. Its page-4 content
stream independently contains the crossing strokes at approximately x=366–375,
y=62–71 in PDF coordinates. `original-flattened-page-4.png` retains that rendering.
The original direct download has `/1` for Prod1ReappearNA and `/Off` for Yes/No.
There is no demonstrated recurrence discrepancy between these retained files.
The earlier observation was incorrect; no recurrence adapter fix is justified.

One bounded same-input reproduction drew all eight pages of the preserved direct
PDF into a macOS PDFKit/Quartz PDF context (`reproduce-flattening.m`). The resulting
`identical-input-quartz-flattened.pdf` has zero form fields and preserves D8’s mark,
visually confirmed in `reproduced-flattened-page-4.png`. Reproduce by compiling with
`clang -fobjc-arc -framework AppKit -framework PDFKit`, then pass absolute input
and output PDF paths. Independent inspection used pypdf 6.16.2.

The original flattened attachment does say “Product stopped” while the direct
attachment and reproduced flattening say “Products stopped.” This wording difference
was not reproduced. The original export route, source revision and possible viewer
edits are unknown. This reproduction used PDFKit/Quartz on macOS 26.5.2, not the
original Firefox/macOS 26.6.2 printing route; it cannot establish that route’s cause.
Original attachments and the historical walkthrough are preserved without edits.

## Deployed verification

Post-PR candidate `658c5a0` / `dpl_BUVydkFQvWgd9JqB1eXTYDvayhj8` served the
protected shared alias; unsigned access returned 302. Share expiry remains September
27 at 21:15:51 UTC. Prior `dpl_6B2PkjFbieBALQVJNXHyXzH4hXoL` is retained for rollback.

The prewritten three-call protocol completed, estimated cost $0.117026, with no
model retry. The opening duplicated symptoms under Product problem (deferred #94);
manual review changed that proposal to Not present before acceptance. The clinical
addition supplied correct serial results and medication history; focus moved into
view, and unchanged reporter save preserved the PDF and revision. The third call
FAILED conversational correction: it proposed a new unnamed third test containing
only 9.6 g/dL instead of correcting September 12. Accepted results stayed unchanged.
The failed path is retained in live-results.json/live-stopped.png and deferred in
#105, independently of #94. This is not a successful unassisted interpretation path.

That response also exposed a UI focus gap for newly introduced cards, now repaired
and checked deterministically. The browser harness stopped on its expected update
panel assertion, before accepting the incorrect proposal. A model-free continuation
will reject that new test and verify the existing direct correction and reporter
edit paths. Independent review and final disposition belong on the PR.
