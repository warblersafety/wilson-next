"use client";
import { useEffect, useRef, useState } from "react";
import { ReporterProfileError, ReporterProfileStore, reporterProfileSchema, type ReporterProfile, type ReporterProfileRecord } from "../src/browser/reporter-profile";

export function useReporterProfile() {
  const [record, setRecord] = useState<ReporterProfileRecord>();
  const current = useRef(record); current.current = record;
  const [busy, setBusy] = useState(false), working = useRef(false);
  const [message, setMessage] = useState("Loading remembered details…");
  const [failed, setFailed] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const desired = useRef<{ profile: ReporterProfile | null } | undefined>(undefined);
  const seeded = useRef(new Set<string>());
  const [store] = useState(() => new ReporterProfileStore());
  useEffect(() => {
    let cancelled = false;
    void store.load().then(value => {
      if (cancelled) return;
      current.current = value; setRecord(value); setMessage(value.profile ? "Fictional reporter details remembered in this browser." : "No reporter details are remembered in this browser.");
    }, error => { if (!cancelled) { setMessage(error instanceof Error ? error.message : "Remembered details are unavailable. You can still enter this report's details."); setReloadRequired(true); } });
    return () => { cancelled = true; };
  }, [store]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (desired.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, []);
  async function write() {
    if (working.current || !desired.current || !current.current || reloadRequired) return;
    working.current = true; setBusy(true); setFailed(false); setMessage("Saving remembered details…");
    try {
      const value = await store.save(desired.current.profile, current.current.generation);
      current.current = value; setRecord(value); desired.current = undefined;
      setMessage(value.profile ? "Fictional reporter details remembered in this browser. This report is unchanged until you save its reporter details." : "Remembered details forgotten. This report's details are unchanged.");
    } catch (error) {
      setFailed(true); setReloadRequired(error instanceof ReporterProfileError && ["stale-writer", "corrupt", "incompatible"].includes(error.code));
      setMessage(error instanceof Error ? error.message : "Remembered details could not be saved. This report's draft is retained.");
    } finally { working.current = false; setBusy(false); }
  }
  function remember(raw: unknown) {
    if (working.current || !current.current || reloadRequired || desired.current) return;
    const parsed = reporterProfileSchema.safeParse(raw);
    if (!parsed.success) { setMessage("These defaults could not be remembered. You can still edit and save this report's details."); return; }
    desired.current = { profile: parsed.data }; void write();
  }
  function forget() {
    if (working.current || !current.current?.profile || reloadRequired || desired.current
      || !window.confirm("Forget the fictional reporter details remembered in this browser? This report's accepted and draft details will stay unchanged.")) return;
    desired.current = { profile: null }; void write();
  }
  async function reload() {
    if (working.current || (desired.current && !window.confirm("Reload remembered details? The failed change to remembered defaults will be discarded. This report's draft stays unchanged."))) return;
    working.current = true; setBusy(true);
    try { const value = await store.load(); current.current = value; setRecord(value); desired.current = undefined; setFailed(false); setReloadRequired(false); setMessage(value.profile ? "Remembered details reloaded. This report is unchanged." : "No reporter details are remembered in this browser."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Remembered details are unavailable."); }
    finally { working.current = false; setBusy(false); }
  }
  return { profile: record?.profile, ready: Boolean(record), busy, failed, reloadRequired, message,
    remember, forget, retry: write, reload, hasPending: Boolean(desired.current),
    claimFreshCase: (caseId: string) => {
      if (!current.current || working.current || desired.current || reloadRequired || seeded.current.has(caseId)) return undefined;
      seeded.current.add(caseId); return current.current.profile ?? undefined;
    },
  };
}
export type ReporterProfileController = ReturnType<typeof useReporterProfile>;
