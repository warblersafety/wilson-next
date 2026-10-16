import { describe, expect, it } from "vitest";
import { editValueForSubmission, decodeUiDrafts, encodeUiDrafts, initialUiDrafts, reduceUiDrafts, draftRecordKey, clinicalDraftKey, reporterDraftKey, type DraftKind, type DraftData, type UiDraftSnapshot } from "../../src/browser/ui-drafts";
import { decodeJourneyTextDrafts, reduceJourneyTextDrafts } from "../../src/browser/journey-text-drafts";
import { decodeActiveCaseRecord } from "../../src/browser/active-case-store";
import { DraftDecodeError } from "../../src/browser/draft-error";
import { productCapacityCase } from "../fixtures/product-capacity";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";

const samples: { [K in DraftKind]: DraftData<K> } = {
  "legacy-date-recovery": {drafts:{"legacy-proposal":{kind:"known",value:"2026-02",qualifier:"supplied uncertainty"}},qualifierControls:{"legacy-proposal":true}},
  indications: { choices: { "product-fictional": "known" }, texts: { "product-fictional": "  Unfinished indication " } },
  "serious-outcomes": { selected: [] },
  "death-date": { date: "" },
  "clinical-context": { testChoice: "known", testName: "  ", testResult: "", lowRange: "0", highRange: "", testDate: "", history: "Unfinished history" },
  "device-details": { implantChoice: "unknown", explantChoice: "inapplicable", reprocessorChoice: "declined", implantDate: "", explantDate: "", reprocessor: " Unsent device details " },
  "medication-history": { answers: { stopped: { kind: "known", value: false }, doseReduced: { kind: "unknown" }, stopDate: { kind: "known", value: {precision:"month",year:"2028",month:"13",wording:"Stopped February 2028"} }, recurred: { kind: "declined" } } },
  reporter: { values: { firstName: "Fictional", lastName: "", address: "", city: "", state: "", postalCode: "", country: "", phone: "", email: "unfinished@", occupation: "" }, reportDate: "", healthProfessional: false, reportedTo: [], doNotDiscloseIdentity: false, baseline: "original baseline before editing" },
  card: { showMore: true, showOutcomes: true, editing: "symptoms", drafts: { symptoms: { kind: "known", value: [], qualifier: "" }, ageYears: { kind: "known", value: 0 }, weight: { kind: "known", value: { value: 0, unit: "kg" } }, history: { kind: "explicitly-absent" } }, qualifierControls: { symptoms: true }, factVersions: { symptoms: "before edit" } },
};
function complete(): UiDraftSnapshot {
  let state = initialUiDrafts("fictional-case");
  state = { ...state, screen: "reporter", text: { version: 1, opening: "  Unsent opening ", reportType: null, update: " Unsent update " } };
  for (const kind of Object.keys(samples) as DraftKind[]) state = reduceUiDrafts(state, { type: "component", kind, scope: "fictional-scope", dependency: "accepted dependency", initial: samples[kind] });
  return state;
}
describe("complete typed UI draft snapshot", () => {
  it("round-trips every input family, unfinished/false/empty values and reporter dirty baseline through the storage JSON boundary", () => {
    const original = complete(), encoded = encodeUiDrafts(original);
    expect(decodeUiDrafts(encoded, "fictional-case")).toEqual(original);
    expect(encoded).toEqual(JSON.parse(JSON.stringify(original)));
    const stored = decodeActiveCaseRecord({ version: 1, generation: "11111111-1111-4111-8111-111111111111", savedAt: "2026-10-14T00:00:00Z", payload: { state: { version: "opaque", case: { id: "fictional-case" } }, drafts: { version: 1, data: encoded } } });
    expect(decodeUiDrafts(stored.payload!.drafts.data).records[draftRecordKey("reporter", "fictional-scope")].data).toEqual(samples.reporter);
  });
  it("keeps unselected optional choices distinct from selected false values", () => {
    const original = complete(), decoded = decodeUiDrafts(encodeUiDrafts(original));
    expect(decoded.records[draftRecordKey("clinical-context", "fictional-scope")].data).not.toHaveProperty("historyChoice");
    expect(decoded.records[draftRecordKey("medication-history", "fictional-scope")].data).toMatchObject({ answers: { stopped: { kind: "known", value: false } } });
  });
  it.each([null, [], {}, { ...initialUiDrafts(), extra: true }, { ...initialUiDrafts(), screen: "unsupported" }])("rejects malformed records %# without mutation", value => {
    const before = structuredClone(value);
    expect(() => decodeUiDrafts(value)).toThrow(DraftDecodeError);
    expect(value).toEqual(before);
  });
  it("distinguishes unsupported snapshot/text/task versions from corruption and cross-case records", () => {
    const value = complete();
    for (const unsupported of [{ ...value, version: 2 }, { ...value, text: { ...value.text, version: 2 } }, { ...value, records: { future: { kind: "future-task" } } }]) {
      try { decodeUiDrafts(unsupported); throw new Error("expected rejection"); } catch (error) { expect(error).toMatchObject({ code: "incompatible" }); }
    }
    try { decodeUiDrafts(value, "another-case"); throw new Error("expected rejection"); } catch (error) { expect(error).toMatchObject({ code: "corrupt" }); }
    try { decodeJourneyTextDrafts({ ...value.text, update: 1 }); throw new Error("expected rejection"); } catch (error) { expect(error).toMatchObject({ code: "corrupt" }); }
  });
  it("rejects unsupported fields, choices and non-JSON values, and rejects mismatched scope keys", () => {
    for (const data of [{ ...samples.card, extra: true }, { ...samples.card, drafts: { age: { kind: "known", value: NaN } } }, { ...samples.card, drafts: { bad: { kind: "known", value: () => "bad" } } }]) {
      const value = complete(); value.records[draftRecordKey("card", "fictional-scope")].data = data as typeof samples.card;
      expect(() => decodeUiDrafts(value)).toThrow(DraftDecodeError);
    }
    const bad = complete(); bad.records.wrong = bad.records[draftRecordKey("card", "fictional-scope")];
    expect(() => decodeUiDrafts(bad)).toThrow(DraftDecodeError);
  });
  it("decodes independent copies and applies functional changes to the latest scope without mutating the original", () => {
    const original = complete(), copy = decodeUiDrafts(original);
    copy.text.opening = "later";
    expect(original.text.opening).toBe("  Unsent opening ");
    const changed = reduceUiDrafts(original, { type: "component", kind: "death-date", scope: "fictional-scope", dependency: "accepted dependency", initial: { date: "" }, update: before => ({ ...(before as { date: string }), date: "2026-10-13" }) });
    expect(changed.records[draftRecordKey("death-date", "fictional-scope")].data).toEqual({ date: "2026-10-13" });
    expect(original.records[draftRecordKey("death-date", "fictional-scope")].data).toEqual({ date: "" });
  });
  it("replaces obsolete dependencies rather than resurrecting old answers, and resets all input families for a new case", () => {
    let state = complete();
    state = reduceUiDrafts(state, { type: "component", kind: "medication-history", scope: "fictional-scope", dependency: "changed prerequisite", initial: { answers: {} } });
    state = reduceUiDrafts(state, { type: "component", kind: "medication-history", scope: "fictional-scope", dependency: "accepted dependency", initial: { answers: {} } });
    expect(state.records[draftRecordKey("medication-history", "fictional-scope")].data).toEqual({ answers: {} });
    expect(reduceUiDrafts(state, { type: "reset", caseId: "next-case" })).toEqual(initialUiDrafts("next-case"));
  });
  it("binds responses to the case and preserves only the current reporter/completion scope without changing clinical state", async () => {
    const current = productCapacityCase(), before = structuredClone(current);
    const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
    let state = initialUiDrafts();
    state.text.opening = "Unsent account";
    state = reduceUiDrafts(state, { type: "component", kind: "reporter", scope: "case", dependency: reporterDraftKey(snapshot), initial: samples.reporter });
    state = reduceUiDrafts(state, { type: "component", kind: "death-date", scope: "obsolete", dependency: clinicalDraftKey(snapshot), initial: samples["death-date"] });
    state = reduceUiDrafts(state, { type: "response", caseId: current.id, snapshot });
    expect(state.text.opening).toBe("Unsent account");
    expect(state.caseId).toBe(current.id);
    expect(state.records[draftRecordKey("reporter", "case")]).toBeDefined();
    expect(state.records[draftRecordKey("death-date", "obsolete")]).toBeUndefined();
    expect(current).toEqual(before);
    expect(reduceUiDrafts(state, { type: "response", caseId: "different-case", snapshot }).text).toEqual(initialUiDrafts().text);
  });
  it("retains raw qualifier text until explicit correction submission, without emitting invalid blank qualifiers", () => {
    const pending = { kind: "known" as const, value: 58, qualifier: "  " };
    expect(editValueForSubmission(pending)).toEqual({ kind: "known", value: 58 });
    expect(pending.qualifier).toBe("  ");
    const meaningful = { ...pending, qualifier: " still checking " };
    expect(editValueForSubmission(meaningful)).toBe(meaningful);
  });
  it("retains complete submitted words separately from cleared/newer text and binds their history to the case", () => {
    let state = initialUiDrafts("fictional-case");
    state.text.opening = "Full account with unquoted sentences";
    state = reduceUiDrafts(state, { type: "submitted", caseId: "fictional-case", id: "opening-id", kind: "opening", text: state.text.opening, revision: 2 });
    expect(state.text.opening).toBe("");
    expect(state.conversation[0].text).toBe("Full account with unquoted sentences");
    state = reduceUiDrafts(state, { type: "text", action: { type: "update", value: "Newer update draft" } });
    state = reduceUiDrafts(state, { type: "submitted", caseId: "fictional-case", id: "update-id", kind: "update", text: "Earlier submitted update", revision: 3 });
    expect(state.text.update).toBe("Newer update draft");
    expect(decodeUiDrafts(encodeUiDrafts(state)).conversation).toEqual(state.conversation);
    expect(() => reduceUiDrafts(state, { type: "submitted", caseId: "another-case", id: "wrong", kind: "update", text: "wrong case", revision: 4 })).toThrow(DraftDecodeError);
    const duplicate = { type: "submitted" as const, caseId: "fictional-case", id: "update-id", kind: "update" as const, text: "Earlier submitted update", revision: 3 };
    expect(reduceUiDrafts(state, duplicate)).toBe(state);
  });
  it("acknowledges only matching submitted opening text, leaving any newer draft intact", () => {
    const text = { ...initialUiDrafts().text, opening: "Newer typing" };
    expect(reduceJourneyTextDrafts(text, { type: "opening-submitted", text: "Old request" })).toBe(text);
    expect(reduceJourneyTextDrafts(text, { type: "opening-submitted", text: "Newer typing" }).opening).toBe("");
  });
});
