"use client";
import { createContext, useCallback, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ZodError } from "zod";
import { DraftDecodeError } from "../src/browser/draft-error";
import { decodeUiDrafts, draftRecordKey, initialUiDrafts, reduceUiDrafts, type DraftAction, type DraftData, type DraftKind, type UiDraftSnapshot } from "../src/browser/ui-drafts";

type PublicDraftAction = Exclude<DraftAction, { type: "replace" }>;
interface DraftOwner {
  snapshot: UiDraftSnapshot;
  fault?: string;
}
const DraftContext = createContext<(DraftOwner & {
  dispatch: Dispatch<PublicDraftAction>;
  restore: (raw: unknown, caseId?: string) => { ok: true } | { ok: false; error: DraftDecodeError };
}) | null>(null);
function reduceOwner(owner: DraftOwner, action: DraftAction): DraftOwner {
  try { return { snapshot: reduceUiDrafts(owner.snapshot, action) }; }
  catch (error) {
    if (!(error instanceof DraftDecodeError || error instanceof ZodError)) throw error;
    return { ...owner, fault: "An unfinished edit could not be applied. Your current work is retained." };
  }
}
/** Initial snapshots must already have passed decodeUiDrafts at the input boundary. */
export function JourneyDraftProvider({ children, initialSnapshot }: { children: ReactNode; initialSnapshot?: UiDraftSnapshot }) {
  const [owner, dispatch] = useReducer(reduceOwner, undefined, () => ({ snapshot: initialSnapshot ?? initialUiDrafts() }));
  const restore = useCallback((raw: unknown, caseId?: string): { ok: true } | { ok: false; error: DraftDecodeError } => {
    try {
      // Decode before React dispatch/render; callers retain raw data on failure.
      const snapshot = decodeUiDrafts(raw, caseId);
      dispatch({ type: "replace", snapshot });
      return { ok: true };
    } catch (error) {
      if (!(error instanceof DraftDecodeError)) throw error;
      return { ok: false, error };
    }
  }, []);
  return <DraftContext.Provider value={{ ...owner, dispatch, restore }}>{children}</DraftContext.Provider>;
}
export function useJourneyDrafts() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("Journey drafts require their case owner");
  return context;
}
/** One controlled case-owned record per component scope, with existing React
 * remount/dependency semantics. No clinical changes or network work live here. */
export function useCaseDraft<K extends DraftKind>(kind: K, scope: string, dependency: string, initial: () => DraftData<K>): [DraftData<K>, Dispatch<SetStateAction<DraftData<K>>>] {
  const { snapshot, dispatch } = useJourneyDrafts();
  const [fallback] = useState(initial);
  const record = snapshot.records[draftRecordKey(kind, scope)];
  const current = record?.dependency === dependency ? record.data as DraftData<K> : fallback;
  useEffect(() => { dispatch({ type: "component", kind, scope, dependency, initial: fallback }); }, [dispatch, kind, scope, dependency, fallback]);
  const set = useCallback<Dispatch<SetStateAction<DraftData<K>>>>(update => {
    dispatch({ type: "component", kind, scope, dependency, initial: fallback, update: before => typeof update === "function" ? (update as (current: DraftData<K>) => DraftData<K>)(before as DraftData<K>) : update });
  }, [dispatch, kind, scope, dependency, fallback]);
  return [current, set];
}
export function draftFieldSetter<T, K extends keyof T>(set: Dispatch<SetStateAction<T>>, key: K): Dispatch<SetStateAction<T[K]>> {
  return update => set(current => ({ ...current, [key]: typeof update === "function" ? (update as (value: T[K]) => T[K])(current[key]) : update }));
}
