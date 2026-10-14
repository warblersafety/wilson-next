import { describe, expect, it } from "vitest";
import { CaseSaveQueue, type SaveStatus } from "../../src/browser/case-save-queue";
import type { ActiveCaseInput, ActiveCaseRecord } from "../../src/browser/active-case-store";
import { productCapacityCase } from "../fixtures/product-capacity";
import { browserStateVersion } from "../../src/server/case/browser-state";
function input(text: string, id = "case-first"): ActiveCaseInput {
  return { state: { version: browserStateVersion, stage: "output", case: { ...productCapacityCase(), id }, unrepresented: [] }, drafts: { version: 1, data: { text } } };
}
function harness() {
  const calls: Array<{ input: ActiveCaseInput; generation: string | null; replace: boolean; resolve(value: ActiveCaseRecord): void; reject(error: unknown): void }> = [];
  const statuses: SaveStatus[] = [];
  const write = (replace: boolean) => (input: ActiveCaseInput, generation: string | null) => new Promise<ActiveCaseRecord>((resolve, reject) => { calls.push({ input, generation, replace, resolve, reject }); });
  const queue = new CaseSaveQueue({ save: write(false), replace: write(true) }, "old-generation", "old-time", state => statuses.push(state));
  const commit = async (index: number) => { const call = calls[index]; call.resolve({ version: 1, generation: `generation-${index}`, savedAt: `time-${index}`, payload: call.input }); await Promise.resolve(); };
  return { queue, calls, statuses, commit };
}
describe("serialized complete-workspace saving", () => {
  it("coalesces pending typing, snapshots input and advances generations only after atomic acknowledgement", async () => {
    const h = harness(), first = input("first"), second = input("second"), latest = input("latest");
    h.queue.enqueue(first); first.drafts.data.text = "caller mutation";
    h.queue.enqueue(second); h.queue.enqueue(latest);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].input.drafts.data.text).toBe("first");
    expect(h.queue.unsaved).toBe(true);
    expect(h.queue.isSaved(latest)).toBe(false);
    await h.commit(0);
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]).toMatchObject({ generation: "generation-0", input: latest });
    expect(h.statuses.at(-1)?.kind).toBe("saving");
    await h.commit(1);
    expect(h.queue.unsaved).toBe(false);
    expect(h.queue.isSaved(latest)).toBe(true);
    expect(h.queue.isSaved(second)).toBe(false);
    expect(h.statuses.at(-1)).toEqual({ kind: "saved", savedAt: "time-1" });
  });
  it("retains a successful response and newer edits after a failed save; retry writes only the newest snapshot", async () => {
    const h = harness(); h.queue.enqueue(input("accepted response"));
    h.calls[0].reject(new Error("quota")); await Promise.resolve();
    h.queue.enqueue(input("newer unsaved words"));
    expect(h.calls).toHaveLength(1);
    expect(h.statuses.at(-1)?.kind).toBe("error");
    expect(h.queue.unsaved).toBe(true);
    h.queue.retry();
    expect(h.calls[1]).toMatchObject({ generation: "old-generation", input: input("newer unsaved words") });
    await h.commit(1);
    expect(h.queue.isSaved(input("newer unsaved words"))).toBe(true);
  });
  it("retains confirmed replacement intent while newer drafts coalesce or a save fails", async () => {
    const h = harness(); h.queue.enqueue(input("old"));
    h.queue.enqueue(input("new", "case-new"), true);
    h.queue.enqueue(input("new with edits", "case-new"));
    await h.commit(0);
    expect(h.calls[1]).toMatchObject({ replace: true, generation: "generation-0", input: input("new with edits", "case-new") });
    h.calls[1].reject(new Error("transaction aborted")); await Promise.resolve();
    h.queue.enqueue(input("still newer", "case-new")); h.queue.retry();
    expect(h.calls[2]).toMatchObject({ replace: true, generation: "generation-0", input: input("still newer", "case-new") });
    await h.commit(2);
    expect(h.statuses.at(-1)?.kind).toBe("saved");
  });
  it("does not start further writes or notify an unmounted owner after disposal", async () => {
    const h = harness(); h.queue.enqueue(input("first")); h.queue.enqueue(input("pending"));
    let released = false; const disposal = h.queue.dispose().then(() => { released = true; }); const count = h.statuses.length;
    expect(released).toBe(false);
    await h.commit(0); await disposal; expect(released).toBe(true); h.queue.retry(); h.queue.enqueue(input("disposed"));
    expect(h.calls).toHaveLength(1); expect(h.statuses).toHaveLength(count);
  });
});
