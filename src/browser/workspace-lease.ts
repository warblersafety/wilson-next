/** Native origin-scoped exclusivity lasts for the workspace lifetime. There is
 * no force/steal takeover and no advisory localStorage lock. */
export type WorkspaceRelease = (settled?: Promise<void>) => void;

let finishingOwnRelease: Promise<void> = Promise.resolve();

export async function acquireWorkspaceLease(manager?: LockManager): Promise<WorkspaceRelease | null> {
  if (!manager) throw new Error("This browser cannot coordinate editing tabs.");
  await finishingOwnRelease;
  let resolveHeld!: () => void;
  let completion: Promise<void>;
  const held = new Promise<void>(resolve => { resolveHeld = resolve; });
  const release: WorkspaceRelease = (settled = Promise.resolve()) => {
    finishingOwnRelease = settled.catch(() => {}).then(() => { resolveHeld(); return completion; }).then(() => undefined);
  };
  return new Promise((resolve, reject) => {
    completion = manager.request("wilson-active-case-workspace", { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) { resolve(null); return; }
      resolve(release);
      await held;
    }).then(() => undefined, reject);
  });
}
