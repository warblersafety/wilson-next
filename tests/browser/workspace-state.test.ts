import { describe, expect, it } from "vitest";
import { productCapacityCase } from "../fixtures/product-capacity";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { journeyResponse } from "../../src/server/case/browser-state";
import { acknowledgeWorkspaceDrafts, decodeWorkspaceData, reconcileWorkspace, workspaceInput, type WorkspaceData } from "../../src/browser/workspace-state";
import { draftRecordKey, initialUiDrafts, factVersions, reporterDraftKey } from "../../src/browser/ui-drafts";
async function fixture() {
  const clinical = productCapacityCase(), repository = new InMemoryCaseRepository({ initialCase: clinical });
  const response = await journeyResponse(repository, await getJourneySnapshot(repository, clinical.id));
  const data: WorkspaceData = { version: 1, provenance: response.provenance, ui: { ...initialUiDrafts(clinical.id), text: { version: 1, opening: "", update: " Unsent words ", reportType: "adverse-event" }, conversation: [{ id: "full-opening", kind: "opening", text: " Full original wording ", revision: 1 }] }, retained: [] };
  return { ...response, data };
}
describe("saved workspace boundary and target reconciliation", () => {
  it("round-trips complete words and provenance separately from clinical authority", async () => {
    const { state, data } = await fixture(), encoded = workspaceInput(state, data);
    expect(decodeWorkspaceData(encoded.drafts.data, state.case.id, state.version)).toEqual(data);
    expect(encoded.state).toEqual(state);
    expect(state).not.toHaveProperty("ui");
  });
  it("preserves raw records and distinguishes future versions/tasks from corrupt identities", async () => {
    const { state, data } = await fixture();
    for (const raw of [{ ...data, version: 2 }, { ...data, ui: { ...data.ui, version: 2 } }, { ...data, ui: { ...data.ui, records: { future: { kind: "future-task" } } } }]) {
      const before = structuredClone(raw);
      expect(() => decodeWorkspaceData(raw, state.case.id, state.version)).toThrow(expect.objectContaining({ code: "incompatible" }));
      expect(raw).toEqual(before);
    }
    expect(() => decodeWorkspaceData(data, "another-case", state.version)).toThrow(expect.objectContaining({ code: "corrupt" }));
    expect(() => decodeWorkspaceData({ ...data, provenance: { ...data.provenance, stateVersion: "other" } }, state.case.id, state.version)).toThrow(expect.objectContaining({ code: "corrupt" }));
  });
  it("retains removed entities, changed questions and reporter prerequisites without applying them", async () => {
    const { state, snapshot, data } = await fixture();
    const card = { kind: "card" as const, scope: JSON.stringify(["product", "removed-product"]), dependency: "removed-product", data: { showMore: true, showOutcomes: false, editing: "dose", drafts: { dose: { kind: "known" as const, value: " Unfinished dose " } }, qualifierControls: {}, factVersions: {} } };
    const task = { kind: "death-date" as const, scope: "old-question", dependency: "old-question", data: { date: "2026-10-13" } };
    data.ui.records[draftRecordKey(card.kind, card.scope)] = card;
    data.ui.records[draftRecordKey(task.kind, task.scope)] = task;
    const before = structuredClone(data), result = reconcileWorkspace(data, state, snapshot);
    expect(result.ui.records).toEqual({});
    expect(result.retained.map(item => item.record)).toEqual([card, task]);
    expect(data).toEqual(before);
    expect(workspaceInput(state, result).drafts.data.retained).toEqual(JSON.parse(JSON.stringify(result.retained)));
  });
  it("keeps unrelated field edits and raw empty qualifiers, retaining only invalidated work for review", async () => {
    const { state, snapshot, data } = await fixture();
    const scope = JSON.stringify(["patient", "patient"]), key = draftRecordKey("card", scope);
    data.ui.records[key] = { kind: "card", scope, dependency: "patient", data: { showMore: true, showOutcomes: false, editing: "ageYears", drafts: { ageYears: { kind: "known", value: 58, qualifier: "" }, identifier: { kind: "known", value: " Unchanged edit " } }, qualifierControls: { ageYears: true }, factVersions: factVersions(snapshot.understanding.patient) } };
    expect(reconcileWorkspace(data, state, snapshot).ui.records[key]).toEqual(data.ui.records[key]);
    const changed = structuredClone(snapshot); changed.understanding.patient.ageYears.resolved = { kind: "known", value: 59 };
    const result = reconcileWorkspace(data, state, changed), record = result.ui.records[key];
    expect(record.kind === "card" && record.data.drafts).toEqual({ identifier: { kind: "known", value: " Unchanged edit " } });
    expect(record.kind === "card" && record.data.editing).toBeUndefined();
    expect(result.retained[0].record).toEqual(data.ui.records[key]);
    expect(result.ui.text.update).toBe(" Unsent words ");
  });
  it("retains type-incompatible or unsupported field edits instead of coercing them", async () => {
    const { state, snapshot, data } = await fixture(), scope = JSON.stringify(["patient", "patient"]), key = draftRecordKey("card", scope);
    data.ui.records[key] = { kind: "card", scope, dependency: "patient", data: { showMore: true, showOutcomes: false, drafts: { ageYears: { kind: "known", value: "wrong representation" }, removedField: { kind: "known", value: " Kept original words " } }, qualifierControls: {}, factVersions: factVersions(snapshot.understanding.patient) } };
    const result = reconcileWorkspace(data, state, snapshot);
    expect(result.retained[0].record).toEqual(data.ui.records[key]);
    expect(result.ui.records[key].kind === "card" && result.ui.records[key].data.drafts).toEqual({});
  });
  it("rejects conversation from a future revision rather than inventing chronology", async () => {
    const { state, snapshot, data } = await fixture(); data.ui.conversation[0].revision = state.case.revision + 1;
    expect(() => reconcileWorkspace(data, state, snapshot)).toThrow(expect.objectContaining({ code: "corrupt" }));
  });
});

it("acknowledges only the submitted field while retaining unrelated pending work for live reconciliation", async () => {
  const { state, snapshot, data } = await fixture(), scope = JSON.stringify(["patient", "patient"]), key = draftRecordKey("card", scope);
  data.ui.records[key] = { kind: "card", scope, dependency: "patient", data: { showMore: true, showOutcomes: false, editing: "ageYears", drafts: { ageYears: { kind: "known", value: 58, qualifier: "" }, identifier: { kind: "known", value: "  Unrelated pending text " } }, qualifierControls: { ageYears: true }, factVersions: factVersions(snapshot.understanding.patient) } };
  const original = structuredClone(data.ui);
  const acknowledged = acknowledgeWorkspaceDrafts(data.ui, { action: "set-fact", target: "patient:patient:ageYears", value: { kind: "known", value: 58 } }, snapshot);
  const record = acknowledged.records[key];
  expect(record.kind === "card" && record.data.drafts).toEqual({ identifier: { kind: "known", value: "  Unrelated pending text " } });
  expect(record.kind === "card" && record.data.editing).toBeUndefined();
  expect(data.ui).toEqual(original);
  const changed = structuredClone(snapshot); changed.understanding.patient.ageYears.resolved = { kind: "known", value: 58 };
  const result = reconcileWorkspace({ ...data, ui: acknowledged }, state, changed);
  expect(result.retained).toHaveLength(0);
  expect(result.ui.records[key].kind === "card" && result.ui.records[key].data.drafts).toEqual({ identifier: { kind: "known", value: "  Unrelated pending text " } });
});
