# Issue185: explicit D5 cosmetic subgroup

Fictional data only. Official pinned FDA3500 09/2025:
https://www.fda.gov/media/76299/download?attachment=
Instructions: https://www.fda.gov/safety/medwatch-forms-fda-safety-reporting/instructions-completing-form-fda-3500

D5 globally says Check all that apply; cosmetics subgroup says Select One.
professional-use-only and retail are one optional atomic fact, never two true
booleans. No inferred product category/use/sale classification; separately
accepted medication labels preserved without blanket cross-D5 exclusivity.
Current reviewed suspect non-device routing prints Section D. Unknown category
remains unknown; device/concomitant facts retained with existing disclosure.

698 unit tests/73 files, typecheck/build PASS. Three focused mock Chromium
journeys PASS11.0s: human acceptance/correction and cleared prior checkbox,
genuine v19 unfinished existing draft, new unselected known cosmetic draft
survives reload with Apply disabled/no default, nonknown clearing, and explicit
category correction independent of retained cosmetic fact.
Full108mock journeys, actual Opus review and exact-headCI recorded on PR.

Two PDFs, independent pypdf readbacks/native controls and PDFKit2x renders show
professional-only in slot1, retail in slot2, then correction to professional-only
in slot2 with retail blank. Corrected page4 is byte-identical to visually inspected
original. Three distinct images visually inspected; both professional/retail
native names/states independently verified, including asymmetric pdt2/Pdt2.
Independently reviewed Brand/OTC selections remain intact in the synthetic
coexistence fixture; this tests preservation, not an inferred classification.
Unit coverage exercises both values/both slots, multiple-choice rejection,
pending/conflict resolution, nonknown states, exact sources/qualifier omission,
wrong routes, withdrawal identity and genuine strict saved-state migration.

The initial focused run caught the shared choice editor's first-option default.
Cosmetic requireSelection now starts blank, has a placeholder and keeps Apply
disabled until explicit choice; all other field behavior preserved. Later new
route-test setup/label mismatches corrected before acceptance.

Cosmetic professional/retail support is not full category coverage: cannabinoid/
Other D5, purchase place/address/website, partial dates (#180) and prior inventory
remain open. No live application-model calls or live-model validation claim.

Actual Opus F1 prompted bounded promptv17 clarification of explicit cosmetic-word routing proposals versus automatic fact mutation. Mock opening now uses ordinary explicit cosmetic words, without supplying Wilson routing terminology. Live interpretation remains unverified (#187); targeted recheck and final full-suite/CI recorded on PR.
