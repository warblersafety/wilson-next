import { readFile } from "node:fs/promises";
import ts from "typescript";
import { expect, test, type Page } from "@playwright/test";
import { parseBrowserJourneyState, browserStateVersion } from "../../src/server/case/browser-state";
import { acceptOpeningCase, answerIndications, attachCorrectionAndContradiction } from "../domain/fixture";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { allFacts } from "../../src/domain/case/facts";

type PageStore = { [key: string]: unknown };
// Test the actual native adapter in Chromium without adding a production route,
// bundler dependency or UI integration. Its only import is a TypeScript type.
async function install(page: Page, name: string) {
  const source = await readFile("src/browser/active-case-store.ts", "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  await page.route("**/__native-store-check", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native persistence acceptance</title>" }));
  await page.goto("/__native-store-check");
  await page.evaluate(async ({ code, name }) => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    const module = await import(url); URL.revokeObjectURL(url);
    Object.assign(window, { foundation: module, foundationStore: new module.ActiveCaseStore(indexedDB, name), foundationName: name });
  }, { code, name });
}
function input() {
  let current = attachCorrectionAndContradiction(answerIndications(acceptOpeningCase()));
  const groupId = current.products.find(({ id }) => id === "product-apixaban")!.facts.startDate.proposedValues[0].groupId;
  current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "foundation-partial-review", expectedRevision: current.revision, decisions: [{ groupId, action: "accept" }] }).case;
  expect(allFacts(current).some(({ fact }) => fact.conflictingValues.length > 0)).toBe(true);
  expect(allFacts(current).some(({ fact }) => fact.proposedValues.length > 0)).toBe(true);
  const state = JSON.parse(JSON.stringify({ version: browserStateVersion, stage: "review-update", case: { ...current, id: "case-11111111-1111-4111-8111-111111111129" }, unrepresented: [] }));
  parseBrowserJourneyState(state);
  return { state, drafts: { version: 1, data: {
    opening: "Unsubmitted account", clinicalUpdate: "Unsent correction", screen: "details",
    field: { target: "product:fictional:name", value: { kind: "known", value: "Pending text", qualifier: "uncertain" } },
    completion: { selected: ["hospitalized"], date: "", declined: false },
    reporter: { firstName: "Fictional", email: "reporter@example.test", dirty: true },
  } } };
}

test("native persistence preserves complete case/drafts across reopen and rejects racing or stale writers", async ({ page, context }) => {
  const name = `wilson-foundation-${Date.now()}-atomic`, value = input();
  await install(page, name);
  const initial = await page.evaluate(() => (window as unknown as { foundationStore: { load(): Promise<unknown> } }).foundationStore.load());
  expect(initial).toMatchObject({ generation: null, payload: null });
  const saved = await page.evaluate(async value => {
    const w = window as unknown as { foundationStore: { save(v: unknown, n: string | null): Promise<unknown> } };
    const pending = w.foundationStore.save(value, null);
    value.drafts.data.clinicalUpdate = "Changed after save was requested";
    return pending;
  }, value);
  expect(saved).toMatchObject({ payload: value });
  await page.close();
  const first = await context.newPage(), second = await context.newPage();
  await install(first, name); await install(second, name);
  expect(await first.evaluate(() => (window as unknown as { foundationStore: { load(): Promise<unknown> } }).foundationStore.load())).toMatchObject({ payload: value });
  const expectedGeneration = (saved as { generation: string }).generation;
  const attempt = (p: Page, marker: string) => p.evaluate(async ({ value, marker, expectedGeneration }) => {
    const store = (window as unknown as { foundationStore: { save(v: unknown, n: string | null): Promise<unknown> } }).foundationStore;
    const next = structuredClone(value); next.drafts.data.clinicalUpdate = marker;
    try { return { ok: true, value: await store.save(next, expectedGeneration) }; }
    catch (error) { return { ok: false, code: (error as { code: string }).code }; }
  }, { value, marker, expectedGeneration });
  const results = await Promise.all([attempt(first, "First writer"), attempt(second, "Second writer")]);
  expect(results.filter(result => result.ok)).toHaveLength(1);
  expect(results.find(result => !result.ok)).toMatchObject({ code: "stale-writer" });
  const result = await first.evaluate(() => (window as unknown as { foundationStore: { load(): Promise<unknown> } }).foundationStore.load());
  expect(result).toEqual(results.find(r => r.ok)!.value);
});

test("native replacement, clear tombstones and write failures preserve the previous committed record", async ({ page }) => {
  const name = `wilson-foundation-${Date.now()}-recovery`, value = input();
  await install(page, name);
  const result = await page.evaluate(async value => {
    const w = window as unknown as { foundationStore: { load(): Promise<PageStore>; save(v: unknown, n: string | null): Promise<PageStore>; replace(v: unknown, n: string | null): Promise<PageStore>; clear(n: string | null): Promise<PageStore> } };
    const store = w.foundationStore;
    const before = await store.save(value, null);
    const expected = before.generation as string;
    const next = structuredClone(value); next.state.case.id = "case-22222222-2222-4222-8222-222222222129";
    const codes: string[] = [];
    try { await store.save(next, expected); } catch (error) { codes.push((error as { code: string }).code); }
    const afterReplacementRefused = await store.load();
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException("Injected quota failure", "QuotaExceededError"); };
    try { await store.save(value, expected); } catch (error) { codes.push((error as { code: string }).code); }
    finally { IDBObjectStore.prototype.put = original; }
    const afterFailure = await store.load();
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) { const request = original.apply(this, args); this.transaction.abort(); return request; };
    try { await store.save(value, expected); } catch (error) { codes.push((error as { code: string }).code); }
    finally { IDBObjectStore.prototype.put = original; }
    const afterAbort = await store.load();
    const replaced = await store.replace(next, expected), cleared = await store.clear(replaced.generation as string);
    try { await store.save(value, expected); } catch (error) { codes.push((error as { code: string }).code); }
    const final = await store.save(value, cleared.generation as string);
    // External site-data loss must not let an old generation match new work.
    const name = (window as unknown as { foundationName: string }).foundationName;
    await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); });
    const fresh = await store.save(next, null);
    try { await store.replace(value, expected); } catch (error) { codes.push((error as { code: string }).code); }
    const afterResetAttempt = await store.load();
    return { before, afterReplacementRefused, afterFailure, afterAbort, replaced, cleared, final, fresh, afterResetAttempt, codes };
  }, value);
  expect(result.codes).toEqual(["replacement-required", "storage-failed", "storage-failed", "stale-writer", "stale-writer"]);
  expect(result.afterReplacementRefused).toEqual(result.before);
  expect(result.afterFailure).toEqual(result.before);
  expect(result.afterAbort).toEqual(result.before);
  expect(result.cleared).toMatchObject({ payload: null });
  expect(result.final).toMatchObject({ payload: value });
  expect(new Set([result.before, result.replaced, result.cleared, result.final, result.fresh].map(record => record.generation)).size).toBe(5);
  expect(result.afterResetAttempt).toEqual(result.fresh);
});

test("native corrupt and incompatible records are retained, never silently replaced", async ({ page }) => {
  const name = `wilson-foundation-${Date.now()}-invalid`, value = input();
  await install(page, name);
  const results = await page.evaluate(async ({ name, value }) => {
    const store = (window as unknown as { foundationStore: { load(): Promise<unknown>; replace(v: unknown, n: string | null): Promise<unknown> } }).foundationStore;
    const raw = async (mode: "read" | "write", data?: unknown) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      try { return await new Promise<unknown>((resolve, reject) => { const tx = db.transaction("active-case", mode === "write" ? "readwrite" : "readonly"); const table = tx.objectStore("active-case"); const r = mode === "write" ? table.put(data, "active") : table.getAll("active"); let result: unknown; r.onsuccess = () => { result = r.result; }; tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error); }); }
      finally { db.close(); }
    };
    await store.load(); // initialize the native database schema
    const results = [];
    for (const data of [undefined, { version: 1, bad: true }, { version: 2, payload: value }]) {
      await raw("write", data);
      const before = await raw("read");
      const codes = [];
      for (const operation of [() => store.load(), () => store.replace(value, null)]) {
        try { await operation(); codes.push("unexpected success"); } catch (error) { codes.push((error as { code: string }).code); }
      }
      results.push({ before, after: await raw("read"), codes });
    }
    await new Promise<void>((resolve, reject) => { const r = indexedDB.open(name, 2); r.onsuccess = () => { r.result.close(); resolve(); }; r.onerror = () => reject(r.error); });
    const before = await raw("read");
    const codes = [];
    for (const operation of [() => store.load(), () => store.replace(value, null)]) {
      try { await operation(); codes.push("unexpected success"); } catch (error) { codes.push((error as { code: string }).code); }
    }
    results.push({ before, after: await raw("read"), codes });
    return results;
  }, { name, value });
  expect(results.map(r => r.codes)).toEqual([["corrupt", "corrupt"], ["corrupt", "corrupt"], ["incompatible", "incompatible"], ["incompatible", "incompatible"]]);
  for (const r of results) expect(r.after).toEqual(r.before);
});
