import { describe, expect, it } from "vitest";
import { decodeJourneyTextDrafts, initialJourneyTextDrafts, reduceJourneyTextDrafts } from "../../src/browser/journey-text-drafts";

describe("top-level text draft boundary", () => {
  it.each([null, "adverse-event", "product-problem", "adverse-event-and-product-problem"] as const)("round-trips %s without trimming or default substitution", reportType => {
    const value = { version: 1, opening: " \nUnsubmitted account ", reportType, update: " \n" };
    expect(decodeJourneyTextDrafts(JSON.parse(JSON.stringify(value)))).toEqual(value);
  });
  it.each([null, [], {}, { ...initialJourneyTextDrafts(), version: 2 }, { ...initialJourneyTextDrafts(), extra: true }, { ...initialJourneyTextDrafts(), opening: 1 }, { ...initialJourneyTextDrafts(), update: null }, { ...initialJourneyTextDrafts(), reportType: undefined }, { ...initialJourneyTextDrafts(), reportType: "invalid" }])("rejects malformed or unsupported input %# without mutating it", value => {
    const before = structuredClone(value);
    expect(() => decodeJourneyTextDrafts(value)).toThrow();
    expect(value).toEqual(before);
  });
  it("rejects missing fields and returns an independent decoded snapshot", () => {
    const value = initialJourneyTextDrafts();
    const { update: _update, ...missing } = value;
    expect(() => decodeJourneyTextDrafts(missing)).toThrow();
    const decoded = decodeJourneyTextDrafts(value);
    value.opening = "Later edit";
    expect(decoded.opening).toBe("");
  });
  it("preserves newer text when an older update succeeds, then clears only a matching acknowledgement", () => {
    let state = reduceJourneyTextDrafts(initialJourneyTextDrafts(), { type: "opening", value: "Original account" });
    state = reduceJourneyTextDrafts(state, { type: "report-type", value: null });
    state = reduceJourneyTextDrafts(state, { type: "update", value: "Submitted" });
    state = reduceJourneyTextDrafts(state, { type: "update", value: "Later typing" });
    expect(reduceJourneyTextDrafts(state, { type: "update-submitted", text: "Submitted" })).toBe(state);
    expect(reduceJourneyTextDrafts(state, { type: "update-submitted", text: "Later typing" })).toEqual({ ...state, update: "" });
    expect(state.update).toBe("Later typing");
    expect(reduceJourneyTextDrafts(state, { type: "new-case" })).toEqual(initialJourneyTextDrafts());
    expect(state.opening).toBe("Original account");
    expect(state.reportType).toBeNull();
  });
});
