import { describe, expect, it } from "vitest";
import { decodeReporterProfileRecord, ReporterProfileStore, reporterProfileSchema } from "../../src/browser/reporter-profile";
const profile = { values: { firstName: " Fictional ", lastName: "Reed", address: "", city: "", state: "", postalCode: "", country: "CANADA", phone: "", email: "casey@example.test", occupation: "Nurse" }, healthProfessional: false };
describe("separate reusable reporter boundary", () => {
  it("preserves editable raw identity/contact defaults and explicit false", () => {
    expect(reporterProfileSchema.parse(profile)).toEqual(profile);
    expect(decodeReporterProfileRecord({ version: 1, generation: "11111111-1111-4111-8111-111111111111", profile })).toMatchObject({ profile });
  });
  it("cannot store case date, destinations, disclosure, case state or extra data", () => {
    for (const extra of [{ reportDate: "2026-10-14" }, { reportedTo: ["manufacturer"] }, { doNotDiscloseIdentity: true }, { state: {} }]) {
      expect(reporterProfileSchema.safeParse({ ...profile, ...extra }).success).toBe(false);
      expect(reporterProfileSchema.safeParse({ ...profile, values: { ...profile.values, ...extra } }).success).toBe(false);
    }
  });
  it("retains corrupt and future data unchanged rather than normalizing it", () => {
    for (const raw of [null, {}, { version: 2, profile }, { version: 1, generation: null, profile }, { version: 1, generation: "bad", profile }, { version: 1, generation: null, profile: null, extra: true }]) {
      const before = structuredClone(raw); expect(() => decodeReporterProfileRecord(raw)).toThrow(); expect(raw).toEqual(before);
    }
    expect(() => decodeReporterProfileRecord({ version: 2 })).toThrow(expect.objectContaining({ code: "incompatible" }));
  });
  it("supports empty and forgotten tombstone records", () => {
    expect(decodeReporterProfileRecord({ version: 1, generation: null, profile: null }).profile).toBeNull();
    expect(decodeReporterProfileRecord({ version: 1, generation: "11111111-1111-4111-8111-111111111111", profile: null }).generation).not.toBeNull();
  });
  it("rejects unsupported form choices and invalid writes before opening storage", async () => {
    expect(reporterProfileSchema.safeParse({ ...profile, healthProfessional: "false" }).success).toBe(false);
    expect(reporterProfileSchema.safeParse({ ...profile, values: { ...profile.values, country: "unsupported" } }).success).toBe(false);
    const store = new ReporterProfileStore();
    await expect(store.save({ ...profile, reportDate: "forbidden" } as never, null)).rejects.toMatchObject({ code: "invalid-input" });
    await expect(store.save(null, "bad")).rejects.toMatchObject({ code: "invalid-input" });
    await expect(store.load()).rejects.toMatchObject({ code: "unavailable" });
  });
});
