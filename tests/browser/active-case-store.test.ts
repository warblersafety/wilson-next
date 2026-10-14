import { describe, expect, it } from "vitest";
import type { ActiveCaseInput } from "../../src/browser/active-case-store";
import { ActiveCaseStore, CasePersistenceError, decodeActiveCaseRecord } from "../../src/browser/active-case-store";

function record() {
  return { version: 1, generation: "11111111-1111-4111-8111-111111111111", savedAt: "2026-10-14T00:00:00.000Z", payload: {
    // Opaque to storage; the real server restore boundary must validate it later.
    state: { version: "opaque-server-state", case: { id: "fictional-case" }, pending: [true, null] },
    drafts: { version: 1, data: { opening: "Unsent", field: { kind: "unknown" }, completion: [false, ""] } },
  } };
}

describe("active case persistence envelope", () => {
  it("preserves opaque clinical state and JSON draft distinctions without normalizing them", () => {
    const value = record();
    expect(decodeActiveCaseRecord(value)).toEqual(value);
    expect(value.payload.drafts.data.completion).toEqual([false, ""]);
  });
  it("recognizes the initial empty record", () => {
    expect(decodeActiveCaseRecord({ version: 1, generation: null, savedAt: null, payload: null })).toMatchObject({ generation: null, payload: null });
  });
  it("accepts a cleared tombstone retaining its generation", () => {
    expect(decodeActiveCaseRecord({ ...record(), payload: null })).toMatchObject({ generation: "11111111-1111-4111-8111-111111111111", payload: null });
  });
  it.each([null, undefined, [], {}, { ...record(), generation: -1 }, { ...record(), generation: 1.5 }, { ...record(), savedAt: "bad" }, { ...record(), extra: true }])("rejects malformed envelope %# without rewriting it", (value) => {
    const before = structuredClone(value);
    expect(() => decodeActiveCaseRecord(value)).toThrow(CasePersistenceError);
    expect(value).toEqual(before);
  });
  it("distinguishes incompatible envelope and draft versions", () => {
    for (const value of [{ ...record(), version: 2 }, { ...record(), payload: { ...record().payload, drafts: { version: 2, data: {} } } }]) {
      try { decodeActiveCaseRecord(value); throw new Error("expected rejection"); }
      catch (error) { expect(error).toMatchObject({ code: "incompatible" }); }
    }
  });
  it.each([undefined, NaN, Infinity, new Date(), () => "unsafe"])("rejects non-JSON draft value %#", (unsafe) => {
    const value = record();
    (value.payload.drafts.data as Record<string, unknown>).unsafe = unsafe;
    expect(() => decodeActiveCaseRecord(value)).toThrow(CasePersistenceError);
  });
  it("rejects circular data and sparse arrays instead of coercing them", () => {
    const value = record();
    (value.payload.drafts.data as Record<string, unknown>).self = value;
    expect(() => decodeActiveCaseRecord(value)).toThrow(CasePersistenceError);
    delete (value.payload.drafts.data as Record<string, unknown>).self;
    (value.payload.drafts.data as Record<string, unknown>).sparse = new Array(2);
    expect(() => decodeActiveCaseRecord(value)).toThrow(CasePersistenceError);
  });
  it.each([undefined, NaN, -1, 0.5])("rejects missing or invalid generation %# on every write operation", async (generation) => {
    const store = new ActiveCaseStore(), value = record().payload as unknown as ActiveCaseInput;
    for (const operation of [() => store.save(value, generation as unknown as string), () => store.replace(value, generation as unknown as string), () => store.clear(generation as unknown as string)]) {
      await expect(operation()).rejects.toMatchObject({ code: "invalid-input" });
    }
  });
  it("fails explicitly without native browser storage", async () => {
    await expect(new ActiveCaseStore().load()).rejects.toMatchObject({ code: "unavailable" });
  });
});
