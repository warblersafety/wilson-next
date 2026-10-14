"use client";
import { createContext, useCallback, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { draftRecordKey, initialUiDrafts, reduceUiDrafts, type DraftAction, type DraftData, type DraftKind, type UiDraftSnapshot } from "../src/browser/ui-drafts";

const DraftContext = createContext<{ snapshot: UiDraftSnapshot; dispatch: Dispatch<DraftAction> } | null>(null);
export function JourneyDraftProvider({ children }: { children: ReactNode }) {
  const [snapshot, dispatch] = useReducer(reduceUiDrafts, undefined, initialUiDrafts);
  return <DraftContext.Provider value={{ snapshot, dispatch }}>{children}</DraftContext.Provider>;
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
