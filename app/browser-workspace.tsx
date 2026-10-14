"use client";
import { useEffect, useRef, useState } from "react";
import type { JourneyAction } from "../src/server/journey/service";
import type { BrowserJourneyState, JourneyResponse } from "../src/server/case/browser-state";
import { ActiveCaseStore, type ActiveCaseRecord } from "../src/browser/active-case-store";
import { CaseSaveQueue, type SaveStatus } from "../src/browser/case-save-queue";
import { acquireWorkspaceLease, type WorkspaceRelease } from "../src/browser/workspace-lease";
import { acknowledgeWorkspaceDrafts, assertResponseContinuation, decodeWorkspaceData, hasWorkspaceWork, reconcileWorkspace, workspaceInput, type RetainedDraft } from "../src/browser/workspace-state";
import { DraftDecodeError } from "../src/browser/draft-error";
import { initialUiDrafts, type UiDraftSnapshot } from "../src/browser/ui-drafts";
import { useJourneyDrafts } from "./journey-drafts";
import { clearJourneySession, clearLegacyJourneyState, readStoredJourneyState, requestJourneyJson, storeJourneyState } from "./browser-diagnostics";

type Recovery = { message: string; incompatible: boolean; record?: ActiveCaseRecord; token?: string; legacy?: boolean };
type Phase = "loading" | "blocked" | "recovery" | "ready";
const codeOf = (error: unknown) => error && typeof error === "object" && "code" in error ? String(error.code) : "";
const isIncompatible = (error: unknown) => codeOf(error).includes("incompatible");
const isCorrupt = (error: unknown) => ["corrupt", "malformed-browser-state"].includes(codeOf(error)) || error instanceof SyntaxError;
const preservedMessage = (error: unknown) => isIncompatible(error)
  ? "Your saved work needs a compatible version of Wilson. It has been retained and will not be replaced."
  : "Your saved work could not be opened. It has been retained. Retry, or explicitly continue with a new unsaved case.";
function mirror(state: BrowserJourneyState) { try { storeJourneyState(state); } catch { /* Optional legacy/debug mirror is not persistence authority. */ } }

export function useBrowserWorkspace() {
  const owner = useJourneyDrafts();
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const [response, setResponse] = useState<JourneyResponse>();
  const [freshCaseId, setFreshCaseId] = useState<string>();
  const responseRef = useRef(response); responseRef.current = response;
  const [phase, setPhase] = useState<Phase>("loading");
  const [recovery, setRecovery] = useState<Recovery>();
  const [status, setStatus] = useState<SaveStatus>({ kind: "saving", savedAt: null });
  const [retained, setRetained] = useState<RetainedDraft[]>([]);
  const [notice, setNotice] = useState<string>();
  const [unsavedOnly, setUnsavedOnly] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recovering = useRef(false);
  const queue = useRef<CaseSaveQueue | undefined>(undefined);
  const store = useRef<ActiveCaseStore | undefined>(undefined);
  const release = useRef<WorkspaceRelease | undefined>(undefined);
  const active = useRef(false);
  const replacement = useRef(false);
  const retainedRef = useRef(retained); retainedRef.current = retained;

  useEffect(() => {
    let cancelled = false;
    const acquisition = new AbortController();
    let ownRelease: WorkspaceRelease | undefined;
    let ownQueue: CaseSaveQueue | undefined;
    const storage = new ActiveCaseStore(); store.current = storage;
    active.current = false; queue.current = undefined;
    setFreshCaseId(undefined);
    setPhase("loading"); setRecovery(undefined); setResponse(undefined); setUnsavedOnly(false);
    let observed: ActiveCaseRecord | undefined;
    let legacy = false;
    async function start() {
      try {
        ownRelease = await acquireWorkspaceLease(navigator.locks, acquisition.signal, () => ownQueue?.dispose()) ?? undefined;
        if (cancelled) { ownRelease?.(); return; }
        if (!ownRelease) { setPhase("blocked"); return; }
        release.current = ownRelease;
        observed = await storage.load();
        if (cancelled) return;
        let legacyValue: unknown;
        let legacyError: SyntaxError | undefined;
        try { legacyValue = readStoredJourneyState(); }
        catch (error) { if (error instanceof SyntaxError) legacyError = error; /* Session storage is optional. */ }
        let next: JourneyResponse;
        let ui: UiDraftSnapshot;
        let kept: RetainedDraft[] = [];
        if (observed.payload) {
          next = await requestJourneyJson<JourneyResponse>({ method: "POST", body: { operation: "resume", state: observed.payload.state } }, "The saved case could not be restored");
          const savedVersion = (observed.payload.state as { version: string }).version;
          const decoded = decodeWorkspaceData(observed.payload.drafts.data, next.state.case.id, savedVersion);
          const reconciled = reconcileWorkspace(decoded, next.state, next.snapshot);
          ui = reconciled.ui; kept = reconciled.retained;
        } else {
          let old: unknown;
          legacy = observed.generation === null;
          if (legacy) { if (legacyError) throw legacyError; old = legacyValue; }
          if (old !== undefined) {
            next = await requestJourneyJson<JourneyResponse>({ method: "POST", body: { operation: "resume", state: old } }, "The earlier tab case could not be restored");
            const initial = ownerRef.current.snapshot.caseId === next.state.case.id ? ownerRef.current.snapshot : { ...initialUiDrafts(next.state.case.id), screen: next.snapshot.stage === "describe" ? "describe" as const : "details" as const };
            ui = reconcileWorkspace({ version: 1, provenance: next.provenance, ui: initial, retained: [] }, next.state, next.snapshot).ui;
          } else {
            legacy = false;
            next = await requestJourneyJson<JourneyResponse>({}, "The case could not be started");
            ui = initialUiDrafts(next.state.case.id);
            setFreshCaseId(next.state.case.id);
          }
        }
        if (cancelled) return;
        const restored = ownerRef.current.restore(ui, next.state.case.id);
        if (!restored.ok) throw restored.error;
        ownQueue = new CaseSaveQueue(storage, observed.generation, observed.savedAt, value => { if (!cancelled) setStatus(value); });
        queue.current = ownQueue;
        replacement.current = false;
        const earlierTabData = legacyError || (legacyValue !== undefined && JSON.stringify(legacyValue) !== JSON.stringify(next.state));
        setRetained(kept); setNotice([next.snapshot.transitionNotice, earlierTabData ? "Earlier work from this tab has been left unchanged. Wilson is showing the current browser case." : undefined].filter(Boolean).join(" ") || undefined);
        mirror(next.state);
        active.current = true;
        setStatus({ kind: "saving", savedAt: observed.savedAt });
        setResponse(next); setPhase("ready");
      } catch (error) {
        if (cancelled) return;
        let token: string | undefined;
        if (!observed && codeOf(error) === "corrupt") {
          try { token = await storage.prepareCorruptDiscard(); } catch { /* A changed/unsupported record stays retained. */ }
        }
        if (cancelled) return;
        setRecovery({ message: preservedMessage(error), incompatible: isIncompatible(error),
          ...(isCorrupt(error) && !isIncompatible(error) ? { record: observed, token, legacy: legacy && !observed?.payload } : {}) });
        setPhase("recovery");
      }
    }
    void start();
    return () => {
      cancelled = true; active.current = false;
      acquisition.abort();
      ownRelease?.(ownQueue?.dispose());
      if (release.current === ownRelease) release.current = undefined;
    };
  }, [epoch]);

  useEffect(() => {
    if (phase !== "ready" || unsavedOnly || !response || owner.snapshot.caseId !== response.state.case.id) return;
    enqueueLatest();
  }, [phase, response, owner.snapshot, retained, unsavedOnly]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      const current = responseRef.current, ui = ownerRef.current.snapshot;
      if (!current || !hasWorkspaceWork(current.state, ui, retainedRef.current.length)) return;
      const pending = unsavedOnly || !isCurrentSaved();
      if (pending) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [unsavedOnly]);

  function accept(next: JourneyResponse, replace = false, action?: JourneyAction) {
    const current = responseRef.current;
    assertResponseContinuation(current, next, replace);
    // A successful result remains in memory before optional/durable storage.
    responseRef.current = next; setResponse(next); setNotice(next.snapshot.transitionNotice);
    if (!replace && current && ownerRef.current.snapshot.caseId === next.state.case.id) {
      const ui = action ? acknowledgeWorkspaceDrafts(ownerRef.current.snapshot, action, current.snapshot) : ownerRef.current.snapshot;
      const reconciled = reconcileWorkspace({ version: 1, provenance: next.provenance, ui, retained: retainedRef.current }, next.state, next.snapshot);
      const restored = ownerRef.current.restore(reconciled.ui, next.state.case.id);
      if (!restored.ok) throw restored.error;
      retainedRef.current = reconciled.retained; setRetained(reconciled.retained);
    } else ownerRef.current.dispatch({ type: "response", caseId: next.state.case.id, snapshot: next.snapshot });
    if (replace) { setFreshCaseId(next.state.case.id); replacement.current = true; retainedRef.current = []; setRetained([]); }
    if (!unsavedOnly) mirror(next.state);
  }
  function latestInput() {
    const current = responseRef.current;
    if (!current) return undefined;
    return workspaceInput(current.state, { version: 1, provenance: current.provenance, ui: ownerRef.current.snapshot, retained: retainedRef.current });
  }
  function enqueueLatest() {
    try { const input = latestInput(); if (!input || !queue.current) return false; queue.current.enqueue(input, replacement.current); return true; }
    catch (error) {
      if (!(error instanceof DraftDecodeError)) throw error;
      setStatus(previous => ({ kind: "error", savedAt: previous.savedAt, error }));
      return false;
    }
  }
  function isCurrentSaved() {
    const current = responseRef.current, ui = ownerRef.current.snapshot;
    if (!current || unsavedOnly || ui.caseId !== current.state.case.id) return false;
    try { const input = latestInput(); return Boolean(input && queue.current?.isSaved(input)); }
    catch (error) { if (!(error instanceof DraftDecodeError)) throw error; return false; }
  }
  function retryLoad() {
    if (recovering.current) return;
    if ((hasWorkspaceWork(responseRef.current?.state, ownerRef.current.snapshot, retainedRef.current.length) && !isCurrentSaved()) && !window.confirm("Reload the saved case? Current unsaved work in this tab will be lost.")) return;
    active.current = false;
    setEpoch(value => value + 1);
  }
  async function continueUnsaved() {
    if (phase !== "recovery" || recovering.current) return;
    recovering.current = true; setRecoveryBusy(true);
    try {
      const next = await requestJourneyJson<JourneyResponse>({}, "The new unsaved case could not be started");
      const restored = ownerRef.current.restore(initialUiDrafts(next.state.case.id), next.state.case.id);
      if (!restored.ok) throw restored.error;
      setFreshCaseId(next.state.case.id);
      setUnsavedOnly(true); active.current = true;
      setResponse(next); setRetained([]); setPhase("ready");
    } catch { setRecovery(value => value && { ...value, message: "The new unsaved case could not be started. Your retained saved work is unchanged. Retry when the connection is available." }); }
    finally { recovering.current = false; setRecoveryBusy(false); }
  }
  async function discardDamaged() {
    if (recovering.current || !recovery || recovery.incompatible || !store.current || !window.confirm("Discard the damaged saved case and all its unfinished work? This cannot be undone. A new blank case will be started.")) return;
    recovering.current = true; setRecoveryBusy(true);
    try {
      if (recovery.token) await store.current.discardCorrupt(recovery.token);
      else if (recovery.record) await store.current.clearIfUnchanged(recovery.record);
      else if (!recovery.legacy) return;
      if (recovery.legacy) clearLegacyJourneyState();
      // Do not reimport an old optional mirror after deliberate durable discard.
      if (!recovery.legacy) { try { clearJourneySession(); } catch { /* optional */ } }
      ownerRef.current.dispatch({ type: "reset", caseId: "pending-new-case" });
      setEpoch(value => value + 1);
    } catch {
      setRecovery(value => value && { ...value, token: undefined, record: undefined, legacy: false, message: "The saved record changed or could not be discarded. It remains retained. Retry loading before any further recovery." });
    } finally { recovering.current = false; setRecoveryBusy(false); }
  }
  async function refreshStage() {
    const current = responseRef.current;
    if (!current || !active.current) return;
    const next = await requestJourneyJson<JourneyResponse>({ method: "POST", body: { operation: "resume", state: current.state } }, "The current case could not be refreshed");
    const reconciled = reconcileWorkspace({ version: 1, provenance: current.provenance, ui: ownerRef.current.snapshot, retained: retainedRef.current }, next.state, next.snapshot);
    const restored = ownerRef.current.restore(reconciled.ui, next.state.case.id);
    if (!restored.ok) throw restored.error;
    setRetained(reconciled.retained); responseRef.current = next; setResponse(next);
    if (!unsavedOnly) mirror(next.state);
    setNotice(next.snapshot.transitionNotice ?? "The case was refreshed. Review it before retrying your action.");
  }
  function discardRetained(index: number) {
    const item = retainedRef.current[index], caseId = responseRef.current?.state.case.id;
    if (!item || phase !== "ready" || !active.current || recovering.current
      || !window.confirm("Discard these earlier unfinished edits? They will no longer be available. Accepted report facts are unchanged.")) return;
    if (responseRef.current?.state.case.id !== caseId) return;
    const remaining = retainedRef.current.filter(candidate => candidate !== item);
    retainedRef.current = remaining; setRetained(remaining);
  }
  const visibleStatus: SaveStatus = status.kind === "saved" && !isCurrentSaved() ? { ...status, kind: "saving" } : status;
  return { response, freshCaseId, phase, recovery, recoveryBusy, status: visibleStatus, retained, notice, unsavedOnly,
    canStart: () => phase === "ready" && active.current && !recovering.current,
    accept, discardRetained, retryLoad, continueUnsaved, discardDamaged, refreshStage,
    retrySave: () => { if (enqueueLatest()) queue.current?.retry(); }, clearNotice: () => setNotice(undefined),
    canDiscard: Boolean(recovery && !recovery.incompatible && (recovery.token || recovery.record || recovery.legacy)),
  };
}
