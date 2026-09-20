import { describe, expect, it } from "vitest";
import { createSemanticCase } from "../../src/domain/case/create";
import { completeResolvedCase } from "../domain/fixture";
import { fixedJourneyModel } from "../fixtures/fixed-journey";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";
import { modelTargetValueContracts } from "../../src/domain/case/value-contract";
import { journeyActionSchema } from "../../src/server/journey/action-contract";

describe("reviewed report metadata and product strength", () => {
  it("records an explicit report date even with declined identity, retains it, and allows correction", async () => {
    const initialCase = structuredClone(completeResolvedCase());
    initialCase.reporter.facts = createSemanticCase("empty").reporter.facts;
    initialCase.askedNeeds = initialCase.askedNeeds.filter(({ key }) => key !== "reporter-details");
    const repository = new InMemoryCaseRepository({ initialCase });
    const id = initialCase.id;
    const answered = await performJourneyAction(repository, id, {
      action: "answer-reporter", reporter: { kind: "declined" }, reportDate: "2026-09-20",
    }, fixedJourneyModel);
    expect(answered.stage).toBe("output");
    expect(answered.projection.sections.B.reportDate).toBe("2026-09-20");
    expect(answered.understanding.event.reportDate.evidence[0]).toContain("Date of this report: 2026-09-20");
    expect((await getJourneySnapshot(repository, id)).projection.sections.B.reportDate).toBe("2026-09-20");
    const updated = await performJourneyAction(repository, id, {
      action: "set-fact", target: "event:event:reportDate", value: { kind: "known", value: "2026-09-21" },
    }, fixedJourneyModel);
    expect(updated.projection.sections.B.reportDate).toBe("2026-09-21");
    expect(updated.understanding.event.reportDate.history).toContainEqual(expect.objectContaining({ value: { kind: "known", value: "2026-09-20" } }));
    expect(updated.projection.sections.B.eventDate).toBe(initialCase.event.facts.onsetDate.resolvedValue?.value.kind === "known" ? initialCase.event.facts.onsetDate.resolvedValue.value.value : undefined);
    await expect(performJourneyAction(repository, id, {
      action: "set-fact", target: "event:event:reportDate", value: { kind: "known", value: "2026-02-30" },
    }, fixedJourneyModel)).rejects.toThrow();
    expect(modelTargetValueContracts.event).not.toHaveProperty("reportDate");
    expect(journeyActionSchema.safeParse({ action: "answer-reporter", reporter: { kind: "declined" }, reportDate: "2026-02-30" }).success).toBe(false);
  });

  it("keeps strength absent when only dose exists and preserves a separate corrected strength", async () => {
    const initialCase = completeResolvedCase();
    const repository = new InMemoryCaseRepository({ initialCase });
    const before = await getJourneySnapshot(repository, initialCase.id);
    expect(before.projection.sections.D.suspectProducts[0]).toMatchObject({ dose: "5 mg" });
    expect(before.projection.sections.D.suspectProducts[0].strength).toBeUndefined();
    const updated = await performJourneyAction(repository, initialCase.id, {
      action: "set-fact", target: `product:${initialCase.products[0].id}:strength`, value: { kind: "known", value: "2.5 mg" },
    }, fixedJourneyModel);
    expect(updated.projection.sections.D.suspectProducts[0]).toMatchObject({ dose: "5 mg", strength: "2.5 mg" });
  });
});
