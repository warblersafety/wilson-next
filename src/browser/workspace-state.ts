import { z } from "zod";
import type { BrowserJourneyState, JourneyResponse } from "../server/case/browser-state";
import type { JourneyAction, JourneySnapshot } from "../server/journey/service";
import type { CaseValue } from "../domain/case/types";
import { factControl, type FactControlEntity } from "./fact-controls";
import { DraftDecodeError } from "./draft-error";
import { clinicalDraftKey, decodeUiDrafts, encodeUiDrafts, factVersions, invalidatedCardFields, reporterDraftKey, type ComponentDraft, type UiDraftSnapshot } from "./ui-drafts";
import type { ActiveCaseInput, JsonObject } from "./active-case-store";

export interface RetainedDraft { reason: string; record: ComponentDraft }
export interface WorkspaceData {
  version: 1;
  provenance: JourneyResponse["provenance"];
  ui: UiDraftSnapshot;
  retained: RetainedDraft[];
}
const envelope = z.object({
  version: z.literal(1),
  provenance: z.object({ stateVersion: z.string().min(1), release: z.string().regex(/^[a-f0-9]{40}$/).length(40).nullable() }).strict(),
  ui: z.unknown(), retained: z.array(z.object({ reason: z.string(), record: z.unknown() }).strict()),
}).strict();
export function decodeWorkspaceData(raw: unknown, caseId: string, savedStateVersion: string): WorkspaceData {
  if (raw && typeof raw === "object" && "version" in raw && typeof raw.version === "number" && raw.version !== 1) throw new DraftDecodeError("incompatible", "This saved workspace needs a compatible version.");
  const result = envelope.safeParse(raw);
  if (!result.success || result.data.provenance.stateVersion !== savedStateVersion) throw new DraftDecodeError("corrupt", "Saved workspace details are invalid; the record has been retained.");
  const ui = decodeUiDrafts(result.data.ui, caseId);
  const retained = result.data.retained.map(item => {
    // Reuse the complete record codec without weakening its identity checks.
    const record = item.record as ComponentDraft;
    if (!record || typeof record !== "object" || !("kind" in record) || !("scope" in record)) throw new DraftDecodeError("corrupt", "A retained edit is invalid.");
    const decoded = decodeUiDrafts({ ...ui, records: { [JSON.stringify([record.kind, record.scope])]: record } }, caseId);
    return { reason: item.reason, record: Object.values(decoded.records)[0] };
  });
  return { ...result.data, ui, retained };
}
export function workspaceInput(state: BrowserJourneyState, data: WorkspaceData): ActiveCaseInput {
  const encoded = { version: 1, provenance: data.provenance, ui: encodeUiDrafts(data.ui), retained: data.retained };
  // Validate our own output at the same boundary and remove undefined choices.
  const json = JSON.parse(JSON.stringify(encoded)) as JsonObject;
  decodeWorkspaceData(json, state.case.id, state.version);
  return { state, drafts: { version: 1, data: json } };
}

/** Never make saved edits authority. Inapplicable targets/prerequisites leave
 * the editable owner and remain separately readable in the durable envelope. */
export function reconcileWorkspace(data: WorkspaceData, state: BrowserJourneyState, snapshot: JourneySnapshot): WorkspaceData {
  if (data.ui.caseId !== state.case.id || data.ui.conversation.some((item, index, all) => item.revision > state.case.revision || (index > 0 && item.revision < all[index - 1].revision))) {
    throw new DraftDecodeError("corrupt", "Saved words do not match this case history; the record has been retained.");
  }
  const retained = [...data.retained];
  const records: UiDraftSnapshot["records"] = {};
  for (const [key, record] of Object.entries(data.ui.records)) {
    if (record.kind !== "card") {
      const applicable = record.kind === "reporter"
        ? record.scope === "case" && record.dependency === reporterDraftKey(snapshot)
        : snapshot.clarification?.kind === record.kind && record.scope === snapshot.clarification.key && record.dependency === clinicalDraftKey(snapshot);
      if (applicable) records[key] = record;
      else if (hasDraftWork(record)) retained.push({ reason: "These unfinished answers need review because their question or accepted details changed.", record });
      continue;
    }
    let identity: unknown;
    try { identity = JSON.parse(record.scope); } catch { /* Invalid identity is retained, not applied. */ }
    const [entity, id] = Array.isArray(identity) && identity.length === 2 ? identity : [];
    const view = entity === "patient" && id === "patient" ? { facts: snapshot.understanding.patient, state: "resolved" }
      : entity === "event" && id === "event" ? { facts: snapshot.understanding.event, state: "resolved" }
      : entity === "reporter" && id === "reporter" ? { facts: snapshot.understanding.reporter, state: "resolved" }
      : entity === "product" ? snapshot.understanding.products.find(item => item.id === id)
      : entity === "test" ? snapshot.understanding.relevantTests.find(item => item.id === id) : undefined;
    if (!view || record.dependency !== id || ["rejected", "withdrawn"].includes(view.state)) {
      if (hasDraftWork(record)) retained.push({ reason: "These unfinished field edits refer to details no longer editable in this case.", record });
      continue;
    }
    const invalid = invalidatedCardFields(view.facts, record.data.factVersions, String(entity));
    for (const field of [...Object.keys(record.data.drafts), ...Object.keys(record.data.qualifierControls), ...(record.data.editing ? [record.data.editing] : [])]) {
      if (!Object.hasOwn(view.facts, field) || !editableTarget(String(entity), field, record.data.drafts[field])) invalid.add(field);
    }
    const affected = Object.keys(record.data.drafts).some(field => invalid.has(field)) || Boolean(record.data.editing && invalid.has(record.data.editing));
    if (affected) {
      const invalidated: ComponentDraft = { ...record, data: { ...record.data,
        drafts: Object.fromEntries(Object.entries(record.data.drafts).filter(([field]) => invalid.has(field))),
        qualifierControls: Object.fromEntries(Object.entries(record.data.qualifierControls).filter(([field]) => invalid.has(field))),
        editing: record.data.editing && invalid.has(record.data.editing) ? record.data.editing : undefined,
      } };
      if (hasDraftWork(invalidated)) retained.push({ reason: "These earlier field edits were set aside because accepted details or prerequisites changed.", record: invalidated });
    }
    records[key] = { ...record, data: { ...record.data,
      drafts: Object.fromEntries(Object.entries(record.data.drafts).filter(([field]) => !invalid.has(field))),
      qualifierControls: Object.fromEntries(Object.entries(record.data.qualifierControls).filter(([field]) => !invalid.has(field))),
      editing: record.data.editing && invalid.has(record.data.editing) ? undefined : record.data.editing,
      factVersions: factVersions(view.facts),
    } };
  }
  return { ...data, ui: { ...data.ui, records }, retained };
}

export function hasWorkspaceWork(state: BrowserJourneyState | undefined, ui: UiDraftSnapshot, retainedCount = 0): boolean {
  return Boolean(retainedCount > 0 || (state?.case.revision ?? 0) > 0 || ui.text.opening || ui.text.update || ui.text.reportType !== "adverse-event"
    || Object.values(ui.records).some(record => record.kind === "card" ? Object.keys(record.data.drafts).length > 0
      : record.kind === "reporter" && JSON.stringify([record.data.values, record.data.reportDate, record.data.healthProfessional, record.data.reportedTo, record.data.doNotDiscloseIdentity]) !== record.data.baseline));
}

/** Validate editor representation, not clinical acceptability: incomplete text,
 * empty choices and zero-valued number/weight edits must remain editable. */
function editableTarget(entity: string, field: string, value: CaseValue<unknown> | undefined): boolean {
  const control = factControl(entity as FactControlEntity, field);
  if (!control) return false;
  if (!value || value.kind !== "known") return true;
  const raw = value.value;
  switch (control.shape) {
    case "age": return (typeof raw === "number" && Number.isFinite(raw)) || Boolean(raw && typeof raw === "object" && "value" in raw && typeof raw.value === "number" && Number.isFinite(raw.value) && "unit" in raw && ["months", "days"].includes(String(raw.unit)));
    case "boolean": return typeof raw === "boolean";
    case "weight": return Boolean(raw && typeof raw === "object" && "value" in raw && typeof raw.value === "number" && Number.isFinite(raw.value) && "unit" in raw && ["kg", "lb"].includes(String(raw.unit)));
    case "list": return Array.isArray(raw) && raw.every(item => typeof item === "string");
    case "choices": return Array.isArray(raw) && raw.every(item => control.options?.some(option => option.value === item));
    case "choice": return typeof raw === "string" && (raw === "" || Boolean(control.options?.some(option => option.value === raw)));
    default: return typeof raw === "string";
  }
}

export function hasDraftWork(record: ComponentDraft): boolean {
  const data = record.data;
  switch (record.kind) {
    case "card": return Object.keys(record.data.drafts).length > 0;
    case "reporter": return JSON.stringify([record.data.values, record.data.reportDate, record.data.healthProfessional, record.data.reportedTo, record.data.doNotDiscloseIdentity]) !== record.data.baseline;
    case "indications": return Object.keys(record.data.choices).length > 0 || Object.values(record.data.texts).some(Boolean);
    case "serious-outcomes": return record.data.selected.length > 0;
    case "medication-history": return Object.values(record.data.answers).some(value => value !== undefined);
    default: return Object.values(data).some(value => value !== undefined && value !== "");
  }
}
/** Explicit submission acknowledges only its own disabled editor/task. Other
 * unfinished work remains available for prerequisite reconciliation/retention. */
export function acknowledgeWorkspaceDrafts(ui: UiDraftSnapshot, action: JourneyAction, snapshot: JourneySnapshot): UiDraftSnapshot {
  const result = decodeUiDrafts(ui);
  const taskKinds: Record<string, ComponentDraft["kind"]> = {
    "answer-indications": "indications", "answer-serious-outcomes": "serious-outcomes", "answer-death-date": "death-date",
    "answer-clinical-context": "clinical-context", "answer-device-details": "device-details", "answer-medication-history": "medication-history", "answer-reporter": "reporter",
  };
  for (const [key, record] of Object.entries(result.records)) {
    if (record.kind === taskKinds[action.action] && (record.kind === "reporter" ? record.scope === "case" : record.scope === snapshot.clarification?.key && record.dependency === clinicalDraftKey(snapshot))) {
      delete result.records[key]; continue;
    }
    if (record.kind !== "card") continue;
    let scope: unknown;
    try { scope = JSON.parse(record.scope); } catch { continue; }
    const [entity, id] = Array.isArray(scope) && scope.length === 2 ? scope : [];
    const acknowledged = new Set<string>();
    if (action.action === "set-fact") {
      const [targetEntity, targetId, field] = action.target.split(":");
      if (entity === targetEntity && id === targetId) acknowledged.add(field);
    }
    if (action.action === "review-opening-group") {
      const facts = entity === "patient" && id === "patient" ? snapshot.understanding.patient
        : entity === "event" && id === "event" ? snapshot.understanding.event
        : entity === "product" ? snapshot.understanding.products.find(item => item.id === id)?.facts
        : entity === "test" ? snapshot.understanding.relevantTests.find(item => item.id === id)?.facts : undefined;
      for (const field of Object.keys(record.data.drafts)) if (facts?.[field]?.proposals.some(proposal => proposal.groupId === action.groupId)) acknowledged.add(field);
    }
    record.data = { ...record.data,
      drafts: Object.fromEntries(Object.entries(record.data.drafts).filter(([field]) => !acknowledged.has(field))),
      qualifierControls: Object.fromEntries(Object.entries(record.data.qualifierControls).filter(([field]) => !acknowledged.has(field))),
      editing: record.data.editing && acknowledged.has(record.data.editing) ? undefined : record.data.editing,
    };
  }
  return result;
}

/** Check continuation identity/revisions before replacing the current response;
 * storage failure is separate from an inconsistent or regressing response. */
export function assertResponseContinuation(current: JourneyResponse | undefined, next: JourneyResponse, replace = false): void {
  const revision = next?.state?.case?.revision;
  if (!Number.isSafeInteger(revision) || revision < 0 || next?.snapshot?.revision !== revision
    || next?.snapshot?.stage !== next?.state?.stage || typeof next?.state?.case?.id !== "string" || !next.state.case.id) {
    throw new DraftDecodeError("corrupt", "The response could not be matched to this case. Your current work is retained.");
  }
  if (current && !replace && (next.state.case.id !== current.state.case.id || revision < current.state.case.revision)) {
    throw new DraftDecodeError("corrupt", "The response does not continue this case. Your current work is retained.");
  }
}
