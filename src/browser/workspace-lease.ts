/** Native origin-scoped exclusivity lasts for the workspace lifetime. There is
 * no force/steal takeover and no advisory localStorage lock. */
export type WorkspaceRelease = (settled?: Promise<void>) => void;
let finishingOwnRelease: Promise<void> = Promise.resolve();

/** Cancellation is registered before the first await, including a pending
 * native grant. A replacement effect waits for its cancelled predecessor's
 * request to finish, not merely for an already-issued release. */
export async function acquireWorkspaceLease(manager?: LockManager, signal?: AbortSignal,
  beforeRelease?: () => Promise<void> | undefined): Promise<WorkspaceRelease | null> {
  if (!manager) throw new Error("This browser cannot coordinate editing tabs.");
  const predecessor = finishingOwnRelease;
  let resolveFinished!: () => void;
  const finished = new Promise<void>(resolve => { resolveFinished = resolve; });
  let resolveHeld!: () => void;
  const held = new Promise<void>(resolve => { resolveHeld = resolve; });
  let cancelled = signal?.aborted ?? false, releasing = false;
  const release: WorkspaceRelease = (settled = Promise.resolve()) => {
    if (releasing) return;
    releasing = true;
    finishingOwnRelease = settled.catch(() => {}).then(() => { resolveHeld(); return finished; }).then(() => undefined);
  };
  const abort = () => { cancelled = true; release(beforeRelease?.()); };
  signal?.addEventListener("abort", abort, { once: true });
  if (cancelled) abort();
  const finish = () => { signal?.removeEventListener("abort", abort); resolveFinished(); };
  await predecessor;
  if (cancelled) { finish(); return null; }
  return new Promise((resolve, reject) => {
    try {
      void manager.request("wilson-active-case-workspace", { mode: "exclusive", ifAvailable: true }, async lock => {
        if (!lock || cancelled) { resolve(null); return; }
        resolve(release);
        await held;
      }).then(finish, error => { finish(); reject(error); });
    } catch (error) { finish(); reject(error); }
  });
}
