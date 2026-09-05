import { describe, expect, it } from "vitest";
import { applyCaseCommand, StaleCaseRevisionError } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import type { CaseValue, Source } from "../../src/domain/case/types";
import {
  acceptCorrectionAndConflict,
  acceptOpeningCase,
  attachCorrectionAndContradiction,
  createOpeningCase,
  resolveApixabanDate,
} from "./fixture";

describe("applyCaseCommand", () => {
  it("keeps grounded model values proposed until semantic groups are reviewed", () => {
    const proposed = createOpeningCase();
    expect(proposed.revision).toBe(1);
    expect(proposed.patient.facts.identifier.state).toBe("proposed");
    expect(proposed.patient.facts.identifier.resolvedValue).toBeUndefined();
    expect(proposed.products.map(({ id, state }) => [id, state])).toEqual([
      ["product-apixaban", "proposed"],
      ["product-naproxen", "proposed"],
      ["product-lisinopril", "proposed"],
    ]);
    expect(proposed.patient.facts.identifier.proposedValues[0].sourceIds).toEqual(["source-patient-id"]);
    expect(() => {
      proposed.products.push(proposed.products[0]);
    }).toThrow();

    const reviewed = acceptOpeningCase(proposed);
    expect(reviewed.revision).toBe(2);
    expect(reviewed.patient.facts.identifier.resolvedValue?.value).toEqual({ kind: "known", value: "TEST-57" });
    expect(reviewed.products.map(({ id, state }) => [id, state])).toEqual([
      ["product-apixaban", "resolved"],
      ["product-naproxen", "resolved"],
      ["product-lisinopril", "resolved"],
    ]);
  });

  it("supersedes an accepted correction and keeps incompatible dates unresolved until explicit resolution", () => {
    const opening = acceptOpeningCase();
    const attached = attachCorrectionAndContradiction(opening);
    const naproxenBeforeReview = attached.products.find(({ id }) => id === "product-naproxen")!;
    expect(naproxenBeforeReview.facts.dose.resolvedValue?.value).toEqual({ kind: "known", value: "500 mg" });
    expect(naproxenBeforeReview.facts.dose.proposedValues[0].value).toEqual({ kind: "known", value: "250 mg" });

    const conflicted = acceptCorrectionAndConflict(attached);
    const naproxen = conflicted.products.find(({ id }) => id === "product-naproxen")!;
    const apixaban = conflicted.products.find(({ id }) => id === "product-apixaban")!;
    expect(naproxen.facts.dose.resolvedValue?.value).toEqual({ kind: "known", value: "250 mg" });
    expect(naproxen.facts.dose.supersededValues.map(({ value }) => value)).toEqual([{ kind: "known", value: "500 mg" }]);
    expect(apixaban.facts.startDate.state).toBe("conflicted");
    expect(apixaban.facts.startDate.resolvedValue).toBeUndefined();
    expect(apixaban.facts.startDate.conflictingValues.map(({ value }) => value)).toEqual([
      { kind: "known", value: "2026-08-12" },
      { kind: "known", value: "2026-08-13" },
    ]);

    const resolved = resolveApixabanDate(conflicted);
    const resolvedDate = resolved.products.find(({ id }) => id === "product-apixaban")!.facts.startDate;
    expect(resolvedDate.resolvedValue?.value).toEqual({ kind: "known", value: "2026-08-13" });
    expect(resolvedDate.resolvedValue?.sourceIds).toContain("source-date-resolution");
    expect(resolvedDate.supersededValues.map(({ value }) => value)).toContainEqual({ kind: "known", value: "2026-08-12" });
    expect(resolvedDate.sourceIds).toEqual(expect.arrayContaining([
      "source-apixaban-start",
      "source-apixaban-date-alternative",
      "source-date-resolution",
    ]));
  });

  it("returns duplicate command IDs unchanged and rejects stale new commands atomically", () => {
    const current = acceptOpeningCase();
    const duplicate = applyCaseCommand(current, {
      type: "review-proposal-groups",
      commandId: "command-review-opening",
      expectedRevision: 0,
      decisions: [],
    });
    expect(duplicate).toEqual({ case: current, applied: false });

    expect(() => applyCaseCommand(current, {
      type: "record-asked-need",
      commandId: "new-stale-command",
      expectedRevision: current.revision - 1,
      key: "suspect-product-indications",
      productIds: ["product-apixaban", "product-naproxen"],
    })).toThrow(StaleCaseRevisionError);
    expect(current.revision).toBe(2);
    expect(current.askedNeeds).toEqual([]);
  });

  it.each<[string, CaseValue<unknown>]>([
    ["known", { kind: "known", value: "TEST-57" }],
    ["unknown", { kind: "unknown" }],
    ["explicitly absent", { kind: "explicitly-absent" }],
    ["inapplicable", { kind: "inapplicable" }],
    ["declined", { kind: "declined" }],
  ])("keeps the resolved meaning %s exclusive", (_label, value) => {
    const initial = createSemanticCase(`case-${value.kind}`);
    const text = `Clinician resolution: ${value.kind}`;
    const source: Source = {
      id: `source-${value.kind}`,
      inputId: `input-${value.kind}`,
      inputType: "answer",
      excerpt: text,
      start: 0,
      end: text.length,
      actor: "clinician",
      recordedAt: "2026-09-05T20:00:00.000Z",
    };
    const next = applyCaseCommand(initial, {
      type: "record-clinician-facts",
      commandId: `command-${value.kind}`,
      expectedRevision: 0,
      source,
      facts: [{
        id: `fact-${value.kind}`,
        target: { entity: "patient", entityId: "patient", field: "identifier" },
        intent: "fact",
        value,
      }],
    }).case;
    expect(next.patient.facts.identifier.state).toBe("resolved");
    expect(next.patient.facts.identifier.resolvedValue?.value).toEqual(value);
    expect(next.patient.facts.identifier.conflictingValues).toEqual([]);
  });

  it("distinguishes an empty fact from every resolved missing meaning", () => {
    const fact = createSemanticCase("case-empty").patient.facts.identifier;
    expect(fact).toMatchObject({
      state: "empty",
      conflictingValues: [],
    });
    expect(fact.resolvedValue).toBeUndefined();
  });
});
