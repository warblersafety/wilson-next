import type { BrowserJourneyState } from "../server/case/browser-state";

export type JsonValue = null | string | number | boolean | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }

/** Integration must validate each component's typed draft before hydrating it.
 * This container preserves JSON data; it does not accept clinical changes. */
export interface PendingDrafts { version: 1; data: JsonObject }
export interface ActiveCaseInput { state: BrowserJourneyState; drafts: PendingDrafts }
export interface StoredCasePayload { state: unknown; drafts: PendingDrafts }
export interface ActiveCaseRecord {
  version: 1;
  generation: string | null;
  savedAt: string | null;
  payload: StoredCasePayload | null;
}
export type PersistenceCode = "unavailable" | "blocked" | "incompatible" | "corrupt" | "invalid-input" | "stale-writer" | "replacement-required" | "storage-failed";
export class CasePersistenceError extends Error {
  constructor(readonly code: PersistenceCode, message: string) {
    super(message); this.name = "CasePersistenceError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function json(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || (!Array.isArray(value) && !object(value)) || ancestors.has(value!)) return false;
  ancestors.add(value!);
  const valid = (Array.isArray(value) ? Array.from(value) : Object.values(value!)).every(item => json(item, ancestors));
  ancestors.delete(value!);
  return valid;
}
const generationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const generation = (value: unknown) => typeof value === "string" && generationPattern.test(value);

function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function caseId(state: unknown): string | undefined {
  return object(state) && typeof state.version === "string" && state.version.length > 0
    && object(state.case) && typeof state.case.id === "string" && state.case.id.length > 0 ? state.case.id : undefined;
}
function payload(value: unknown): value is StoredCasePayload {
  return object(value) && keys(value, ["state", "drafts"]) && Boolean(caseId(value.state))
    && object(value.drafts) && keys(value.drafts, ["version", "data"])
    && value.drafts.version === 1 && object(value.drafts.data) && json(value);
}

/** Validates only the persistence envelope. The existing server resume boundary
 * must validate/migrate the opaque clinical state before any integration uses it. */
export function decodeActiveCaseRecord(value: unknown): ActiveCaseRecord {
  if (object(value) && typeof value.version === "number" && value.version !== 1) throw new CasePersistenceError("incompatible", "The saved case uses an unsupported storage version.");
  if (object(value) && object(value.payload) && object(value.payload.drafts) && typeof value.payload.drafts.version === "number" && value.payload.drafts.version !== 1) {
    throw new CasePersistenceError("incompatible", "The saved drafts use an unsupported version.");
  }
  if (!object(value) || !keys(value, ["version", "generation", "savedAt", "payload"]) || value.version !== 1
    || !(generation(value.generation) || (value.generation === null && value.payload === null && value.savedAt === null))
    || !((typeof value.savedAt === "string" && Number.isFinite(Date.parse(value.savedAt)))
      || (value.generation === null && value.savedAt === null && value.payload === null))
    || !(value.payload === null || payload(value.payload))) {
    throw new CasePersistenceError("corrupt", "The saved case envelope is invalid; it has not been replaced.");
  }
  return value as unknown as ActiveCaseRecord;
}

const storeName = "active-case";
const recordKey = "active";
const emptyRecord = (): ActiveCaseRecord => ({ version: 1, generation: null, savedAt: null, payload: null });
const storageFailure = () => new CasePersistenceError("storage-failed", "Browser storage failed; the previously saved case has not been replaced.");

/** One browser-local case, no UI wiring, account, server storage or case manager.
 * Each write uses a native readwrite transaction and compares storage generation,
 * not just semantic revision. Each write gets a fresh UUID, including clear,
 * so old writers cannot match a counter reused after browser storage is reset. */
export class ActiveCaseStore {
  constructor(private readonly factory?: IDBFactory, private readonly databaseName = "wilson-browser-persistence") {}

  load(): Promise<ActiveCaseRecord> { return this.transaction("read"); }
  save(value: ActiveCaseInput, expectedGeneration: string | null): Promise<ActiveCaseRecord> {
    return this.write(value, expectedGeneration, false);
  }
  replace(value: ActiveCaseInput, expectedGeneration: string | null): Promise<ActiveCaseRecord> {
    return this.write(value, expectedGeneration, true);
  }
  clear(expectedGeneration: string | null): Promise<ActiveCaseRecord> { return this.transaction("clear", expectedGeneration, null); }

  private write(value: ActiveCaseInput, expectedGeneration: string | null, replace: boolean): Promise<ActiveCaseRecord> {
    try {
      if (!payload(value)) throw new CasePersistenceError("invalid-input", "The case and draft container must be supported JSON data.");
      // Snapshot before asynchronous open/transaction work; caller mutation must not change this write.
      return this.transaction(replace ? "replace" : "save", expectedGeneration, structuredClone(value));
    } catch (error) {
      return Promise.reject(error instanceof CasePersistenceError ? error : storageFailure());
    }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let factory: IDBFactory | undefined;
      try { factory = this.factory ?? globalThis.indexedDB; }
      catch { reject(new CasePersistenceError("unavailable", "IndexedDB is unavailable in this browser.")); return; }
      if (!factory) { reject(new CasePersistenceError("unavailable", "IndexedDB is unavailable in this browser.")); return; }
      let settled = false;
      let request: IDBOpenDBRequest;
      try { request = factory.open(this.databaseName, 1); } catch { reject(storageFailure()); return; }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
      };
      request.onblocked = () => {
        settled = true; reject(new CasePersistenceError("blocked", "Another tab is blocking the browser storage upgrade."));
      };
      request.onerror = () => {
        settled = true;
        reject(request.error?.name === "VersionError"
          ? new CasePersistenceError("incompatible", "Browser storage uses a newer database version.") : storageFailure());
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) { db.close(); return; }
        settled = true;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }

  private async transaction(mode: "read" | "save" | "replace" | "clear", expectedGeneration?: string | null, nextPayload?: StoredCasePayload | null): Promise<ActiveCaseRecord> {
    const writing = mode !== "read";
    if (writing && !(expectedGeneration === null || generation(expectedGeneration))) {
      throw new CasePersistenceError("invalid-input", "A valid saved-case generation is required.");
    }
    const db = await this.open();
    try {
      return await new Promise<ActiveCaseRecord>((resolve, reject) => {
        const tx = db.transaction(storeName, writing ? "readwrite" : "readonly");
        let result: ActiveCaseRecord;
        let failure: CasePersistenceError | undefined;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure ?? storageFailure());
        const store = tx.objectStore(storeName);
        // getAll distinguishes an absent key from a corrupt stored `undefined` value.
        const request = store.getAll(recordKey);
        request.onsuccess = () => {
          try {
            const current = request.result.length === 0 ? emptyRecord() : decodeActiveCaseRecord(request.result[0]);
            if (!writing) { result = current; return; }
            if (current.generation !== expectedGeneration) throw new CasePersistenceError("stale-writer", "Another tab or newer save changed this case. Reload before writing.");
            if (mode === "save" && current.payload && caseId(current.payload.state) !== caseId(nextPayload?.state)) {
              throw new CasePersistenceError("replacement-required", "Replacing the active case requires explicit confirmation.");
            }
            const nextGeneration = crypto.randomUUID();
            result = { version: 1, generation: nextGeneration, savedAt: new Date().toISOString(), payload: nextPayload ?? null };
            store.put(result, recordKey);
          } catch (error) {
            failure = error instanceof CasePersistenceError ? error : storageFailure(); tx.abort();
          }
        };
      });
    } catch (error) {
      throw error instanceof CasePersistenceError ? error : storageFailure();
    } finally { db.close(); }
  }
}
