import { z } from "zod";

export const reporterProfileSchema = z.object({
  values: z.object({ firstName: z.string(), lastName: z.string(), address: z.string(), city: z.string(), state: z.string(), postalCode: z.string(), country: z.string(), phone: z.string(), email: z.string(), occupation: z.enum(["", "Physician", "Nurse", "Nurse Practitioner", "Pharmacist", "Physician Assistant", "Other Health Professional", "Non-Health Professional"]) }).strict(),
  healthProfessional: z.boolean(),
}).strict();
export type ReporterProfile = z.infer<typeof reporterProfileSchema>;
const generationSchema = z.uuid();
const recordSchema = z.object({ version: z.literal(2), generation: generationSchema.nullable(), profile: reporterProfileSchema.nullable() }).strict().refine(value => value.profile === null || value.generation !== null);
export type ReporterProfileRecord = z.infer<typeof recordSchema>;
export class ReporterProfileError extends Error {
  constructor(readonly code: "incompatible" | "corrupt" | "unavailable" | "blocked" | "storage-failed" | "stale-writer" | "invalid-input", message: string) { super(message); this.name = "ReporterProfileError"; }
}
export function decodeReporterProfileRecord(raw: unknown): ReporterProfileRecord {
  if (raw && typeof raw === "object" && "version" in raw && raw.version !== 1 && raw.version !== 2) throw new ReporterProfileError("incompatible", "Remembered details need a compatible version of Wilson. They have not been replaced.");
  const legacySchema = z.object({version:z.literal(1),generation:generationSchema.nullable(),profile:reporterProfileSchema.nullable()}).strict().refine(value=>value.profile===null||value.generation!==null);
  const legacy = legacySchema.safeParse(raw);
  if (legacy.success) {
    if (legacy.data.profile && !["", "UNITED STATES", "CANADA"].includes(legacy.data.profile.values.country)) throw new ReporterProfileError("corrupt", "Remembered details could not be read. They have not been replaced.");
    return {...legacy.data,version:2};
  }
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) throw new ReporterProfileError("corrupt", "Remembered details could not be read. They have not been replaced.");
  return parsed.data;
}
const failure = () => new ReporterProfileError("storage-failed", "Remembered details could not be saved. Earlier remembered details are unchanged.");
/** Separate from the active case. A tombstone and fresh generation make stale
 * writes fail even after Forget; no clinical case data enters this database. */
export class ReporterProfileStore {
  constructor(private readonly factory?: IDBFactory, private readonly name = "wilson-reporter-profile") {}
  load() { return this.transaction(); }
  save(profile: ReporterProfile | null, expectedGeneration: string | null) {
    const parsed = profile === null ? null : reporterProfileSchema.safeParse(profile);
    if ((parsed && !parsed.success) || (expectedGeneration !== null && !generationSchema.safeParse(expectedGeneration).success)) return Promise.reject(new ReporterProfileError("invalid-input", "These reporter defaults could not be remembered."));
    return this.transaction({ profile: parsed === null ? null : parsed.data!, expectedGeneration });
  }
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let factory: IDBFactory | undefined;
      try { factory = this.factory ?? globalThis.indexedDB; } catch { /* unavailable */ }
      if (!factory) { reject(new ReporterProfileError("unavailable", "Remembered details are unavailable in this browser. You can still enter this report's details.")); return; }
      let request: IDBOpenDBRequest, settled = false;
      try { request = factory.open(this.name, 1); } catch { reject(failure()); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("reporter")) request.result.createObjectStore("reporter"); };
      request.onblocked = () => { settled = true; reject(new ReporterProfileError("blocked", "Another tab is blocking remembered details. You can still enter this report's details.")); };
      request.onerror = () => { settled = true; reject(request.error?.name === "VersionError" ? new ReporterProfileError("incompatible", "Remembered details need a compatible version of Wilson. They have not been replaced.") : failure()); };
      request.onsuccess = () => { const db = request.result; if (settled) { db.close(); return; } db.onversionchange = () => db.close(); resolve(db); };
    });
  }
  private async transaction(write?: { profile: ReporterProfile | null; expectedGeneration: string | null }): Promise<ReporterProfileRecord> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let outcome: ReporterProfileRecord | undefined, error: unknown;
      let tx: IDBTransaction;
      try { tx = db.transaction("reporter", write ? "readwrite" : "readonly"); } catch { db.close(); reject(failure()); return; }
      const abort = (reason: unknown) => { error = reason instanceof ReporterProfileError ? reason : failure(); tx.abort(); };
      tx.onabort = () => { db.close(); reject(error ?? failure()); };
      tx.oncomplete = () => { db.close(); outcome ? resolve(outcome) : reject(failure()); };
      try {
        const store = tx.objectStore("reporter"), read = store.getAll("remembered");
        read.onsuccess = () => {
          try {
            const current = read.result.length === 0 ? { version: 2 as const, generation: null, profile: null } : decodeReporterProfileRecord(read.result[0]);
            if (!write) { outcome = current; return; }
            if (current.generation !== write.expectedGeneration) { abort(new ReporterProfileError("stale-writer", "Remembered details changed in another tab. Reload them before making another change.")); return; }
            outcome = { version: 2, generation: crypto.randomUUID(), profile: write.profile };
            store.put(outcome, "remembered");
          } catch (reason) { abort(reason); }
        };
      } catch (reason) { abort(reason); }
    });
  }
}
