# Experiment 2 Stage 2 external assessment

This is the human semantic oracle for the controlled early live gate. Executable gate code must not import or parse this file. Runtime validation establishes only provider, structured-output, selected-domain, identity, exact-quotation, metrics, and authoritative-command validity.

## Call 1 — rich opening

- Exactly one cephalexin product, with suspect role.
- Patient: `TEST-68`, 68 years, male.
- Product: cephalexin, 500 mg, twice daily, oral, start 2026-08-01, indication cellulitis, stopped.
- Event: diffuse hives and facial swelling, onset 2026-08-04, hospitalization, epinephrine and diphenhydramine treatment, recovered, discharge 2026-08-05.
- Every stated supported fact appears once with correct attribution and semantically sufficient exact evidence; no unstated fact appears.

## Call 2 — repeated-product opening

- Acetaminophen and Tylenol are one application-owned product; ibuprofen is a second product. Both are suspect.
- Patient: `TEST-44`, 44 years, male.
- Acetaminophen: 1,000 mg, twice daily, oral, start 2026-07-01, indication back pain, stopped.
- Ibuprofen: 400 mg, twice daily, oral, start 2026-07-03, indication back pain, stopped.
- Event: nausea and right upper abdominal pain, onset 2026-07-05, hospitalization, intravenous fluids, recovered, discharge 2026-07-07.
- Every stated supported fact appears once on the correct entity with semantically sufficient exact evidence; no unstated fact appears.

## Call 3 — repeated-product update

- No product is declared.
- The ibuprofen dose correction proposes 200 mg twice daily against the supplied ibuprofen ID and retains the statement that it replaces 400 mg twice daily.
- The acetaminophen date alternative proposes 2026-07-02 against the supplied acetaminophen ID and preserves the unresolved disagreement with 2026-07-01.
- Both proposals use semantically sufficient exact evidence from the update; no unstated proposal appears.

## Verdict rule

Stop on the first material invention, supported-fact omission, wrong entity or role, alias split, unsupported quotation, hidden conflict, incorrect correction target, mechanical boundary failure, or architectural falsification. A pass is one bounded observation, not evidence of a general failure rate, assembled-product behavior, usefulness, clinician usability, or production readiness.
