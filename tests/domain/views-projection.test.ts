import { describe, expect, it } from "vitest";
import { projectForm3500 } from "../../src/domain/case/projection";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { createClarificationView, createReviewView, createUnderstandingView } from "../../src/domain/case/views";
import {
  acceptCorrectionAndConflict,
  acceptOpeningCase,
  answerIndications,
  attachCorrectionAndContradiction,
  completeResolvedCase,
} from "./fixture";

describe("pure case views and semantic Form 3500 projection", () => {
  it("asks the one authored indication group once and stops after the answer", () => {
    const opening = acceptOpeningCase();
    expect(createClarificationView(opening)).toEqual({
      key: "suspect-product-indications",
      status: "new",
      productIds: ["product-apixaban", "product-naproxen"],
      question: "What was apixaban being used for, and what was naproxen being used for?",
    });
    const asked = applyCaseCommand(opening, {
      type: "record-asked-need",
      commandId: "command-ask-indications",
      expectedRevision: opening.revision,
      key: "suspect-product-indications",
      productIds: ["product-apixaban", "product-naproxen"],
    }).case;
    expect(createClarificationView(asked)?.status).toBe("open");
    expect(() => applyCaseCommand(asked, {
      type: "record-asked-need",
      commandId: "command-repeat-indications",
      expectedRevision: asked.revision,
      key: "suspect-product-indications",
      productIds: ["product-apixaban", "product-naproxen"],
    })).toThrow("already recorded");
    expect(createClarificationView(answerIndications(opening))).toBeNull();
  });

  it("shows a proposed correction and exact conflict evidence without mutating the case", () => {
    const attached = attachCorrectionAndContradiction(answerIndications(acceptOpeningCase()));
    const before = structuredClone(attached);
    const review = createReviewView(attached);
    expect(review.attention).toContainEqual(expect.objectContaining({
      target: "product:product-naproxen:dose",
      kind: "correction",
    }));
    expect(review.attention.find(({ target }) => target.endsWith("dose"))?.values[0].evidence[0]).toContain("250 mg");
    createUnderstandingView(attached);
    expect(attached).toEqual(before);

    const conflictReview = createReviewView(acceptCorrectionAndConflict(attached));
    const dateConflict = conflictReview.attention.find(({ target }) => target.endsWith("startDate"));
    expect(dateConflict).toMatchObject({
      target: "product:product-apixaban:startDate",
      kind: "conflict",
    });
    expect(dateConflict?.values.map(({ evidence }) => evidence[0])).toEqual([
      "start as 12-Aug-2026",
      "medication administration record lists apixaban starting 13-Aug-2026",
    ]);
  });

  it("omits the conflicted date, then projects the complete resolved oracle with stable entity roles and trace", () => {
    const conflicted = acceptCorrectionAndConflict(
      attachCorrectionAndContradiction(answerIndications(acceptOpeningCase())),
    );
    const beforeResolution = projectForm3500(conflicted);
    const apixabanBefore = beforeResolution.sections.D.suspectProducts.find(({ productId }) => productId === "product-apixaban")!;
    expect(apixabanBefore.startDate).toBeUndefined();
    expect(beforeResolution.omissions).toContainEqual(expect.objectContaining({
      target: "product:product-apixaban:startDate",
      reason: "conflicted",
    }));

    const resolved = projectForm3500(completeResolvedCase());
    expect(resolved.sections.A).toEqual({ patientIdentifier: "TEST-57", ageYears: 57, sex: "female" });
    expect(resolved.sections.B).toMatchObject({
      eventDate: "2026-08-18",
      hospitalized: true,
      relevantTests: "7.8 g/dL",
    });
    expect(resolved.sections.B.eventDescription).toContain("melena and dizziness");
    expect(resolved.sections.D.suspectProducts).toEqual([
      expect.objectContaining({
        productId: "product-apixaban",
        name: "apixaban",
        dose: "5 mg",
        frequency: "twice daily",
        route: "oral",
        startDate: "2026-08-13",
        indication: "postoperative VTE prophylaxis after knee replacement",
      }),
      expect.objectContaining({
        productId: "product-naproxen",
        name: "naproxen",
        dose: "250 mg",
        frequency: "twice daily",
        route: "oral",
        startDate: "2026-08-10",
        indication: "postoperative pain",
      }),
    ]);
    expect(resolved.sections.F.concomitantProducts).toEqual([
      expect.objectContaining({
        productId: "product-lisinopril",
        name: "lisinopril",
        dose: "10 mg",
        frequency: "daily",
        route: "oral",
      }),
    ]);
    expect(resolved.sourceTrace["sections.D.suspectProducts.0.startDate"]).toEqual(expect.arrayContaining([
      "source-apixaban-date-alternative",
      "source-date-resolution",
    ]));
    expect(resolved.omissions).toContainEqual(expect.objectContaining({
      target: "product:product-lisinopril:startDate",
      reason: "empty",
    }));
  });
});
