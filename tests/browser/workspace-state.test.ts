import { describe, expect, it } from "vitest";
import { createSemanticCase } from "../../src/domain/case/create";
import { productCapacityCase } from "../fixtures/product-capacity";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { journeyResponse, browserStateVersion } from "../../src/server/case/browser-state";
import { acknowledgeWorkspaceDrafts, assertResponseContinuation, decodeWorkspaceData, hasWorkspaceWork, reconcileWorkspace, workspaceInput, type WorkspaceData } from "../../src/browser/workspace-state";
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
    const retained = result.retained[0].record;
    expect(retained.kind === "card" && retained.data.drafts).toEqual({ ageYears: { kind: "known", value: 58, qualifier: "" } });
    expect(retained.kind === "card" && retained.data.qualifierControls).toEqual({ ageYears: true });
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

it("rejects regressing/inconsistent response revisions before replacing current work", async () => {
  const current = await fixture();
  expect(() => assertResponseContinuation(current, current)).not.toThrow();
  const older = structuredClone(current); older.state.case.revision--; older.snapshot.revision--;
  expect(() => assertResponseContinuation(current, older)).toThrow(expect.objectContaining({ code: "corrupt" }));
  const mismatched = structuredClone(current); mismatched.snapshot.revision++;
  expect(() => assertResponseContinuation(current, mismatched)).toThrow(expect.objectContaining({ code: "corrupt" }));
  const other = structuredClone(current); other.state.case.id = "case-11111111-1111-4111-8111-111111111139";
  expect(() => assertResponseContinuation(current, other)).toThrow(expect.objectContaining({ code: "corrupt" }));
  expect(() => assertResponseContinuation(current, other, true)).not.toThrow();
});

it("treats retained unfinished text as work even when the current clinical case is blank", async () => {
  const { state } = await fixture();
  const blank = { ...state, stage: "describe" as const, case: createSemanticCase(state.case.id) };
  expect(hasWorkspaceWork(blank, initialUiDrafts(state.case.id))).toBe(false);
  expect(hasWorkspaceWork(blank, initialUiDrafts(state.case.id), 1)).toBe(true);
});
it('legacy date recovery drafts survive current pending review, acknowledge only submitted corrections and retain stale edits visibly',async()=>{
 const {legacyPendingCalendar}=await import('../fixtures/legacy-calendar');const c=legacyPendingCalendar(),snapshot=await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id),state:import('../../src/server/case/browser-state').BrowserJourneyState={version:browserStateVersion,stage:'review-update',case:c,unrepresented:[]};
 const {initialUiDrafts,draftRecordKey}=await import('../../src/browser/ui-drafts');const ui=initialUiDrafts(c.id),key=draftRecordKey('legacy-date-recovery','updates');ui.records[key]={kind:'legacy-date-recovery',scope:'updates',dependency:'legacy-date-update-recovery',data:{drafts:{'legacy-date-proposal':{kind:'known',value:'2026-02'},'other-draft':{kind:'unknown'}},qualifierControls:{}}};const data:WorkspaceData={version:1,ui,retained:[],provenance:{stateVersion:browserStateVersion,release:null}};
 const restored=reconcileWorkspace(data,state,snapshot);expect(restored.ui.records[key]).toEqual(ui.records[key]);const acknowledged=acknowledgeWorkspaceDrafts(ui,{action:'review-update-group',groupId:'legacy-date-update',decision:'accept',dateCorrections:[{proposalId:'legacy-date-proposal',value:{kind:'known',value:'2028-02-29'}}]},snapshot);expect(acknowledged.records[key].kind==='legacy-date-recovery'&&acknowledged.records[key].data.drafts).toEqual({'other-draft':{kind:'unknown'}});
 const changed=structuredClone(snapshot);changed.review.attention=[];const retained=reconcileWorkspace(data,state,changed);expect(retained.ui.records[key]).toBeUndefined();expect(retained.retained).toContainEqual(expect.objectContaining({record:ui.records[key]}));expect(ui.records[key].kind==='legacy-date-recovery'&&ui.records[key].data.drafts['legacy-date-proposal']).toEqual({kind:'known',value:'2026-02'});
});


it("preserves a matching legacy medication draft once as readable work without changing clinical authority or genuine unsent words",async()=>{
 const {state,snapshot,data}=await fixture();
 const record={kind:"medication-history" as const,scope:snapshot.clarification?.key??"medication-history",dependency:JSON.stringify(["legacy-question"]),data:{answers:{stopped:{kind:"known" as const,value:true},stopDate:{kind:"known" as const,value:"  exact unfinished date "}}}};
 const key=draftRecordKey(record.kind,record.scope);data.ui.records[key]=record;
 const before=structuredClone(state),first=reconcileWorkspace(data,state,snapshot);
 expect(first.ui.records[key]).toBeUndefined();expect(first.retained).toHaveLength(1);expect(first.retained[0].record).toEqual(record);expect(first.retained[0].reason).toContain("Clinical update");expect(first.ui.text.update).toBe(" Unsent words ");expect(state).toEqual(before);
 const decoded=decodeWorkspaceData(workspaceInput(state,first).drafts.data,state.case.id,state.version),again=reconcileWorkspace(decoded,state,snapshot);expect(again.retained).toEqual(first.retained);expect(again.ui.records[key]).toBeUndefined();expect(state).toEqual(before);
});
