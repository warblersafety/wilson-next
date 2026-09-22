# Focused Draft 4 repairs — issue 103

The issue freezes the authorized slice and safeguards from the local handoff and
walkthrough. Local planning documents, mockup archives and walkthrough attachments
remain uncommitted and unchanged, with a private backup/hash manifest.

Successful update submission focuses and scrolls to the proposed-update heading.
Per-group decisions restore focus to remaining review or the case summary. The
coverage disclosure separates clinical omissions, reporter information not supplied,
and unsupported form coverage without changing case semantics. Source quotes now
have separate lines, update headings follow the screen hierarchy, button hover text
remains legible, disabled controls have no active shadow, and the mobile privacy
checkbox stays alongside its label.

Local checks: typecheck, 202 deterministic tests, production build, and both focused
Draft 4 browser tests pass (7.4 seconds). Browser assertions cover desktop/mobile
focus and viewport position, retained drafts/proposals, unchanged reporter return,
corrected reporter PDF readback, earlier/current PDF validity and #92 prerequisite
invalidation. Screenshots were visually inspected. Initial test invocation omitted
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

Pending the post-PR candidate. The prewritten three-call protocol is
`live-protocol.json`; no automatic model retries. Independent review and final
disposition will be recorded on the PR, the canonical review record.
