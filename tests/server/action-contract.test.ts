import { describe, expect, it } from "vitest";
import {
  journeyActionSchema,
  type JourneyAction,
} from "../../src/server/journey/action-contract";

describe("journey action contract", () => {
  it("is the runtime and TypeScript contract for every existing action", () => {
    const actions: JourneyAction[] = [
      { action: "submit-opening", text: "Synthetic account", reportType: "adverse-event" },
      { action: "review-opening-group", groupId: "group", corrections: [{ proposalId: "proposal", value: { kind: "known", value: ["one"] } }] },
      { action: "reject-group", groupId: "group" },
      { action: "accept-understanding" },
      { action: "set-fact", target: "event:event:symptoms", value: { kind: "known", value: ["one"] } },
      { action: "withdraw-entity", entity: "test", entityId: "test" },
      { action: "answer-indications", answers: [{ productId: "product", value: { kind: "unknown" } }] },
      { action: "answer-serious-outcomes", selected: ["hospitalized"], disposition: "known" },
      { action: "answer-death-date", value: { kind: "explicitly-absent" } },
      { action: "answer-clinical-context", test: { kind: "known", testResult: "Result", date: "2026-09-11" }, history: { kind: "declined" } },
      { action: "answer-device-details", implantDate: { kind: "unknown" }, explantDate: { kind: "inapplicable" } },
      {
        action: "answer-reporter",
        reporter: {
          kind: "provided",
          lastName: "Clinician",
          firstName: "Casey",
          healthProfessional: true,
          occupation: "Physician",
          reportedTo: ["manufacturer"],
          doNotDiscloseIdentity: false,
        },
      },
      { action: "submit-update", text: "Synthetic correction" },
      { action: "review-update-group", groupId: "group", decision: "accept" },
      { action: "resolve-conflict", target: "event:event:onsetDate", chosenValueId: "value" },
    ];

    expect(actions.map((action) => journeyActionSchema.parse(action))).toEqual(actions);
  });

  it("retains the existing strict request validation", () => {
    const invalid = [
      { action: "submit-opening", text: "Synthetic account", reportType: "unsupported" },
      { action: "accept-understanding", extra: true },
      { action: "review-opening-group", groupId: "", corrections: [{ proposalId: "proposal", value: { kind: "known" } }] },
      { action: "answer-indications", answers: [] },
      { action: "answer-serious-outcomes", selected: ["outcome"], disposition: "known" },
      { action: "answer-clinical-context", test: { kind: "known", testResult: "Result", date: "11-Sep-2026" } },
    ];

    for (const action of invalid) {
      expect(journeyActionSchema.safeParse(action).success).toBe(false);
    }
  });
});
