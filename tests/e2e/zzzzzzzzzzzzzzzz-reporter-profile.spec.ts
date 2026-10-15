import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { workspaceTaskCase } from "../fixtures/workspace-tasks";
import { productCapacityCase } from "../fixtures/product-capacity";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { journeyResponse } from "../../src/server/case/browser-state";
import { initialUiDrafts } from "../../src/browser/ui-drafts";
import { workspaceInput } from "../../src/browser/workspace-state";
import { goTo, storedState } from "./draft4-helpers";
import { draftOwnerHarnessHtml } from "./ui-draft-harness";
const profile = { values: { firstName: "Casey", lastName: "Reed", address: "101 Fictional Way", city: "Fictional City", state: "CA", postalCode: "00000", country: "CANADA", phone: "202-555-0142", email: "casey@example.test", occupation: "Nurse" }, healthProfessional: false };
const saved = (page: Page) => expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
const remembered = (page: Page) => page.getByRole("region", { name: "Remembered fictional reporter details" });
async function native(page: Page, name: string, store: string, key: string, value?: unknown) {
  return page.evaluate(async ({ name, store, key, value }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => r.result.createObjectStore(store); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise<any>((resolve, reject) => { const tx = db.transaction(store, value === undefined ? "readonly" : "readwrite"); const s = tx.objectStore(store), r = value === undefined ? s.get(key) : s.put(value, key); let result: unknown; r.onsuccess = () => { result = r.result; }; tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
  }, { name, store, key, value });
}
const profileRecord = (page: Page, value?: unknown) => native(page, "wilson-reporter-profile", "reporter", "remembered", value);
async function prepareCase(page: Page, accepted = false) {
  let fixture;
  if (accepted) { const repository = new InMemoryCaseRepository({ initialCase: productCapacityCase() }); fixture = await journeyResponse(repository, await getJourneySnapshot(repository, productCapacityCase().id)); }
  else fixture = await workspaceTaskCase("medication-history");
  const input = workspaceInput(fixture.state, { version: 1, provenance: fixture.provenance, ui: { ...initialUiDrafts(fixture.state.case.id), screen: "reporter" }, retained: [] });
  await native(page, "wilson-browser-persistence", "active-case", "active", { version: 1, generation: randomUUID(), savedAt: new Date().toISOString(), payload: input });
  await page.reload(); await saved(page); return fixture;
}
async function fill(page: Page) {
  for (const [field, label] of [["firstName", "first name"], ["lastName", "last name"], ["address", "address"], ["city", "city"], ["state", "state"], ["postalCode", "postal code"], ["phone", "phone"], ["email", "email"]] as const) await page.getByLabel(`Reporter ${label}`, { exact: true }).fill(profile.values[field]);
  await page.getByLabel("Reporter country", { exact: true }).selectOption(profile.values.country);
  await page.getByLabel("Reporter occupation", { exact: true }).selectOption(profile.values.occupation);
  await page.getByLabel("Health professional", { exact: true }).selectOption("false");
}
async function saveReporter(page: Page) {
  const acknowledgement = page.waitForResponse(response => response.url().endsWith("/api/case") && response.request().method() === "POST" && response.request().postDataJSON()?.action?.action === "answer-reporter");
  await page.getByRole("button", { name: "Save reporter details", exact: true }).click();
  expect((await acknowledgement).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled();
  await goTo(page, "Reporter details");
  await saved(page);
}
async function newCase(page: Page) {
  const acknowledgement = page.waitForResponse(response => response.url().endsWith("/api/case") && response.request().method() === "GET");
  page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "New case", exact: true }).click(); expect((await acknowledgement).ok()).toBe(true); await expect(page.getByRole("button", { name: "New case", exact: true })).toBeEnabled(); await saved(page);
}
async function makeFreshReporterVisible(page: Page) {
  // Supply a deterministic semantic fixture as the opening response, preserving
  // the genuinely fresh identity. No application model call is made.
  const fixture = structuredClone(await workspaceTaskCase("medication-history"));
  const current = await storedState(page); fixture.state.case.id = current.case.id;
  await page.route("**/api/case", async route => {
    const body = route.request().postDataJSON(); if (body?.operation !== "act" || body.action?.action !== "submit-opening") return route.continue();
    await route.fulfill({ json: fixture });
  }, { times: 1 });
  await page.getByLabel("Case description", { exact: true }).fill("Fictional opening for reporter defaults.");
  await page.getByRole("button", { name: "Review Wilson’s understanding", exact: true }).click();
  await goTo(page, "Reporter details"); return fixture;
}

test("fictional profile remains separate, editable and reusable across fresh cases; forgetting preserves current draft and accepted facts", async ({ baseURL }, info) => {
  const directory = await mkdtemp(join(tmpdir(), "wilson-profile-restart-"));
  let context = await chromium.launchPersistentContext(directory, { headless: true, viewport: { width: 1440, height: 900 } });
  try {
  let page = context.pages()[0];
  await page.goto(baseURL!); await saved(page); await prepareCase(page, true); await fill(page);
  await page.getByLabel("Date of this report", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Manufacturer or compounder", { exact: true }).check();
  await page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true }).check();
  const before = await storedState(page);
  await remembered(page).getByRole("button", { name: "Remember these fictional details", exact: true }).click();
  await expect(remembered(page)).toContainText("Fictional reporter details remembered in this browser.");
  await page.screenshot({ path: info.outputPath("remembered-reporter-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("remembered-reporter-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const first = await profileRecord(page); expect(first.profile).toEqual(profile); expect(Object.keys(first.profile).sort()).toEqual(["healthProfessional", "values"]);
  expect(await storedState(page)).toEqual(before);
  await saveReporter(page);
  const accepted = await storedState(page); expect(accepted.case.reporter.facts.firstName.resolvedValue?.value).toEqual({ kind: "known", value: "Casey" });
  await page.getByLabel("Reporter first name", { exact: true }).fill("Future fictional default");
  await remembered(page).getByRole("button", { name: "Update remembered details", exact: true }).click();
  await expect.poll(async () => (await profileRecord(page)).profile.values.firstName).toBe("Future fictional default");
  expect(await storedState(page)).toEqual(accepted);
  await saved(page);
  const browser = context.browser(); await context.close(); expect(browser?.isConnected()).toBe(false);
  context = await chromium.launchPersistentContext(directory, { headless: true }); page = context.pages()[0];
  await page.goto(baseURL!); await saved(page);
  expect((await profileRecord(page)).profile.values.firstName).toBe("Future fictional default");
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Future fictional default");
  expect(await storedState(page)).toEqual(accepted);
  await newCase(page); await makeFreshReporterVisible(page);
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Future fictional default");
  await expect(page.getByLabel("Health professional", { exact: true })).toHaveValue("false");
  await expect(page.getByLabel("Reporter country", { exact: true })).toHaveValue("CANADA");
  await expect(page.getByLabel("Date of this report", { exact: true })).not.toHaveValue("2026-10-01");
  await expect(page.getByLabel("Manufacturer or compounder", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Do not disclose my identity to the manufacturer", { exact: true })).not.toBeChecked();
  const current = await storedState(page); expect(current.case.reporter.facts.firstName.resolvedValue?.value).toBeUndefined();
  await page.getByLabel("Reporter first name", { exact: true }).fill("Current draft only"); await saved(page); await page.reload(); await saved(page);
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Current draft only");
  page.once("dialog", d => d.dismiss()); await remembered(page).getByRole("button", { name: "Forget remembered details", exact: true }).click();
  expect((await profileRecord(page)).profile).not.toBeNull();
  page.once("dialog", d => d.accept()); await remembered(page).getByRole("button", { name: "Forget remembered details", exact: true }).click();
  await expect(remembered(page)).toContainText("Remembered details forgotten.");
  expect((await profileRecord(page)).profile).toBeNull();
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Current draft only"); expect(await storedState(page)).toEqual(current);
  } finally { await context.close(); await rm(directory, { recursive: true, force: true }); }
});

test("existing accepted case and dirty pending reporter work are never automatically replaced by changed remembered details", async ({ page }) => {
  await page.goto("/"); await saved(page); await prepareCase(page, true); await fill(page);
  await saveReporter(page);
  const accepted = await storedState(page);
  await profileRecord(page, { version: 1, generation: randomUUID(), profile: { ...profile, values: { ...profile.values, firstName: "Other default" } } });
  await page.reload(); await saved(page);
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Casey"); expect(await storedState(page)).toEqual(accepted);
  await page.getByLabel("Reporter first name", { exact: true }).fill("Unfinished current edit"); await saved(page); await page.reload(); await saved(page);
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Unfinished current edit");
  page.once("dialog", d => d.dismiss()); await remembered(page).getByRole("button", { name: "Use remembered details", exact: true }).click();
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Unfinished current edit");
  page.once("dialog", d => d.accept()); await remembered(page).getByRole("button", { name: "Use remembered details", exact: true }).click();
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Other default"); expect(await storedState(page)).toEqual(accepted);
});

test("future and corrupt profile records stay untouched while normal reporter entry and case saving work", async ({ page }) => {
  await page.goto("/"); await saved(page); await prepareCase(page, true);
  for (const raw of [{ version: 2, generation: "future", profile }, { version: 1, damaged: true }]) {
    await profileRecord(page, raw); await page.reload(); await saved(page);
    await expect(remembered(page).getByRole("button", { name: "Reload remembered details", exact: true })).toBeVisible();
    await expect(remembered(page).getByRole("button", { name: "Remember these fictional details", exact: true })).toBeDisabled();
    await fill(page); await saveReporter(page);
    expect(await profileRecord(page)).toEqual(raw);
    expect((await storedState(page)).case.reporter.facts.firstName.resolvedValue?.value).toEqual({ kind: "known", value: "Casey" });
  }
});

for (const failure of ["quota", "abort"] as const) test(`profile ${failure} failure preserves requested defaults and accepted case; explicit retry saves without repeating case actions`, async ({ page }) => {
  await page.goto("/"); await saved(page); await prepareCase(page, true); await fill(page);
  const accepted = await storedState(page);
  await page.evaluate(failure => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name !== "wilson-reporter-profile") return original.apply(this, args as [unknown, IDBValidKey?]);
      if (failure === "quota") throw new DOMException("Synthetic quota", "QuotaExceededError");
      const request = original.apply(this, args as [unknown, IDBValidKey?]); this.transaction.abort(); return request;
    };
    (window as any).restoreProfilePut = () => { IDBObjectStore.prototype.put = original; };
  }, failure);
  let actions = 0; page.on("request", r => { if (r.url().endsWith("/api/case") && r.method() === "POST" && r.postDataJSON().operation === "act") actions++; });
  await remembered(page).getByRole("button", { name: "Remember these fictional details", exact: true }).click();
  await expect(remembered(page).getByRole("button", { name: "Retry remembering details", exact: true })).toBeVisible();
  await expect(remembered(page)).toContainText("Remembered details could not be saved. Earlier remembered details are unchanged.");
  await expect(remembered(page)).not.toContainText("Synthetic quota");
  expect(await profileRecord(page)).toBeUndefined(); expect(await storedState(page)).toEqual(accepted);
  await page.getByLabel("Reporter first name", { exact: true }).fill("Later current draft");
  await page.evaluate(() => (window as any).restoreProfilePut());
  await remembered(page).getByRole("button", { name: "Retry remembering details", exact: true }).click();
  await expect(remembered(page)).toContainText("Fictional reporter details remembered in this browser.");
  expect((await profileRecord(page)).profile).toEqual(profile); expect(actions).toBe(0);
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Later current draft"); expect(await storedState(page)).toEqual(accepted);
});

test("native reporter transactions reject competing stale writers, preserve tombstones and refuse corrupt/future records", async ({ page }) => {
  const html = await draftOwnerHarnessHtml();
  await page.route("**/__profile-adapter-check", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("/__profile-adapter-check"); await saved(page);
  const result = await page.evaluate(async profile => {
    const probe = (window as any).profileProbe;
    const start = await probe.load();
    const competing = await Promise.allSettled([probe.save(profile, start.generation), probe.save({ ...profile, healthProfessional: true }, start.generation)]);
    const current = await probe.load(), forgotten = await probe.save(null, current.generation);
    let stale: string | undefined; try { await probe.save(profile, current.generation); } catch (e) { stale = (e as any).code; }
    return { competing: competing.map(v => v.status), current, forgotten, stale, final: await probe.load() };
  }, profile);
  expect(result.competing.sort()).toEqual(["fulfilled", "rejected"]); expect(result.current.profile).not.toBeNull(); expect(result.forgotten.generation).not.toBe(result.current.generation); expect(result.final.profile).toBeNull(); expect(result.stale).toBe("stale-writer");
  for (const raw of [{ version: 2, opaque: "retained future" }, { version: 1, corrupt: true }]) {
    await native(page, "wilson-profile-adapter-probe", "reporter", "remembered", raw);
    expect(await page.evaluate(async profile => {
      try { await (window as any).profileProbe.save(profile, null); return "unexpected success"; } catch (e) { return (e as any).code; }
    }, profile)).toBe(raw.version === 2 ? "incompatible" : "corrupt");
    expect(await native(page, "wilson-profile-adapter-probe", "reporter", "remembered")).toEqual(raw);
  }
});

test("remembered defaults arriving after current reporter typing never replace the dirty draft", async ({ page }) => {
  await page.goto("/"); await saved(page);
  await profileRecord(page, { version: 1, generation: randomUUID(), profile });
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      const request = original.apply(this, args as [string, number?]);
      if (args[0] === "wilson-reporter-profile") {
        let held = true;
        request.addEventListener("success", event => {
          if (!held) return;
          event.stopImmediatePropagation();
          (window as any).releaseRememberedLoad = () => { held = false; request.dispatchEvent(new Event("success")); };
        });
      }
      return request;
    };
  });
  // Keep the native active-case tombstone but remove its blank payload, so the
  // next load starts a genuinely new case rather than restores an existing one.
  const active = await native(page, "wilson-browser-persistence", "active-case", "active");
  await native(page, "wilson-browser-persistence", "active-case", "active", { ...active, generation: randomUUID(), payload: null });
  await page.reload(); await saved(page); await makeFreshReporterVisible(page);
  await expect(remembered(page)).toContainText("Loading remembered details…");
  await page.getByLabel("Reporter first name", { exact: true }).fill("Typed before defaults arrived");
  await page.evaluate(() => (window as any).releaseRememberedLoad());
  await expect(remembered(page)).toContainText("Fictional reporter details remembered in this browser.");
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Typed before defaults arrived");
  expect((await storedState(page)).case.reporter.facts.firstName.resolvedValue).toBeUndefined();
});

test("stale profile writes require explicit reload and preserve current case edits", async ({ page }) => {
  await page.goto("/"); await saved(page); await prepareCase(page, true); await fill(page);
  await remembered(page).getByRole("button", { name: "Remember these fictional details", exact: true }).click();
  await expect(remembered(page)).toContainText("Fictional reporter details remembered in this browser.");
  const changed = { version: 1, generation: randomUUID(), profile: { ...profile, healthProfessional: true } };
  await profileRecord(page, changed);
  await page.getByLabel("Reporter first name", { exact: true }).fill("Current fictional pending edit");
  const accepted = await storedState(page);
  await remembered(page).getByRole("button", { name: "Update remembered details", exact: true }).click();
  await expect(remembered(page)).toContainText("Remembered details changed in another tab.");
  expect(await profileRecord(page)).toEqual(changed); expect(await storedState(page)).toEqual(accepted);
  page.once("dialog", d => d.dismiss()); await remembered(page).getByRole("button", { name: "Reload remembered details", exact: true }).click();
  await expect(remembered(page)).toContainText("Remembered details changed in another tab.");
  page.once("dialog", d => d.accept()); await remembered(page).getByRole("button", { name: "Reload remembered details", exact: true }).click();
  await expect(remembered(page)).toContainText("Remembered details reloaded.");
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Current fictional pending edit");
  expect(await storedState(page)).toEqual(accepted); expect(await profileRecord(page)).toEqual(changed);
});

test("waiting tab loads the latest remembered defaults when it gains editing ownership", async ({ page, context }) => {
  await page.goto("/"); await saved(page); await prepareCase(page, true); await fill(page);
  await remembered(page).getByRole("button", { name: "Remember these fictional details", exact: true }).click();
  await expect(remembered(page)).toContainText("Fictional reporter details remembered in this browser.");
  const waiting = await context.newPage(); await waiting.goto("/");
  await expect(waiting.getByRole("heading", { name: "This case is open in another tab", exact: true })).toBeVisible();
  await page.getByLabel("Reporter first name", { exact: true }).fill("Newest fictional default");
  await remembered(page).getByRole("button", { name: "Update remembered details", exact: true }).click();
  await expect.poll(async () => (await profileRecord(page)).profile.values.firstName).toBe("Newest fictional default"); await saved(page);
  await page.close();
  // Closing the page can acknowledge before Chromium releases its native lock.
  // Observe that prerequisite before the same user retry; never steal the lease.
  await expect.poll(() => waiting.evaluate(async () => (await navigator.locks.query()).held?.some(lock => lock.name === "wilson-active-case-workspace") ?? false)).toBe(false);
  await waiting.getByRole("button", { name: "Try this tab again", exact: true }).click(); await saved(waiting);
  await newCase(waiting); await makeFreshReporterVisible(waiting);
  await expect(waiting.getByLabel("Reporter first name", { exact: true })).toHaveValue("Newest fictional default");
});

test("a failed remembered change can be explicitly abandoned without changing stored defaults or current case edits", async ({ page }) => {
  await page.goto("/"); await saved(page); await prepareCase(page, true); await fill(page);
  await remembered(page).getByRole("button", { name: "Remember these fictional details", exact: true }).click();
  await expect(remembered(page)).toContainText("Fictional reporter details remembered in this browser.");
  const original = await profileRecord(page), accepted = await storedState(page);
  await page.getByLabel("Reporter first name", { exact: true }).fill("Only current unfinished edit");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === "wilson-reporter-profile") { const request = put.apply(this, args as [unknown, IDBValidKey?]); this.transaction.abort(); return request; }
      return put.apply(this, args as [unknown, IDBValidKey?]);
    };
  });
  await remembered(page).getByRole("button", { name: "Update remembered details", exact: true }).click();
  await expect(remembered(page).getByRole("button", { name: "Retry remembering details", exact: true })).toBeVisible();
  page.once("dialog", d => d.dismiss()); await remembered(page).getByRole("button", { name: "Reload remembered details", exact: true }).click();
  await expect(remembered(page).getByRole("button", { name: "Retry remembering details", exact: true })).toBeVisible();
  page.once("dialog", d => d.accept()); await remembered(page).getByRole("button", { name: "Reload remembered details", exact: true }).click();
  await expect(remembered(page).getByRole("button", { name: "Retry remembering details", exact: true })).toHaveCount(0);
  await expect(remembered(page).getByRole("button", { name: "Update remembered details", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("Only current unfinished edit");
  expect(await profileRecord(page)).toEqual(original); expect(await storedState(page)).toEqual(accepted);
});

test("a native stored undefined is corruption, never an empty profile slot", async ({ page }) => {
  const html = await draftOwnerHarnessHtml();
  await page.route("**/__profile-undefined-check", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("/__profile-undefined-check"); await saved(page);
  const result = await page.evaluate(async profile => {
    const probe = (window as any).profileProbe; await probe.load();
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("wilson-profile-adapter-probe", 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = () => new Promise<unknown[]>((resolve, reject) => { const tx = db.transaction("reporter"), request = tx.objectStore("reporter").getAll("remembered"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      await new Promise<void>((resolve, reject) => { const tx = db.transaction("reporter", "readwrite"); tx.objectStore("reporter").put(undefined, "remembered"); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
      const before = await read(), errors: string[] = [];
      for (const operation of [() => probe.load(), () => probe.save(profile, null), () => probe.save(null, null)]) { try { await operation(); errors.push("unexpected success"); } catch (e) { errors.push((e as any).code); } }
      return { before, errors, after: await read() };
    } finally { db.close(); }
  }, profile);
  expect(result.before).toEqual([undefined]); expect(result.after).toEqual(result.before); expect(result.errors).toEqual(["corrupt", "corrupt", "corrupt"]);
});

test("case-only reload cannot silently advance a failed profile intent's comparison generation", async ({ page }) => {
  await page.goto("/"); await saved(page); await prepareCase(page, true); await fill(page);
  await remembered(page).getByRole("button", { name: "Remember these fictional details", exact: true }).click();
  await expect(remembered(page)).toContainText("Fictional reporter details remembered in this browser."); await saved(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (["wilson-reporter-profile", "wilson-browser-persistence"].includes(this.transaction.db.name)) throw new DOMException("Synthetic unavailable write", "QuotaExceededError");
      return put.apply(this, args as [unknown, IDBValidKey?]);
    };
    (window as any).restorePendingPut = () => { IDBObjectStore.prototype.put = put; };
  });
  await page.getByLabel("Reporter first name", { exact: true }).fill("Pending profile intent");
  await remembered(page).getByRole("button", { name: "Update remembered details", exact: true }).click();
  await expect(remembered(page).getByRole("button", { name: "Retry remembering details", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("button", { name: "Reload saved case", exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).restorePendingPut());
  const external = { version: 1, generation: randomUUID(), profile: { ...profile, values: { ...profile.values, firstName: "Concurrent fictional default" } } };
  await profileRecord(page, external);
  page.once("dialog", d => d.accept());
  await page.getByRole("region", { name: "Browser saving" }).getByRole("button", { name: "Reload saved case", exact: true }).click(); await saved(page);
  await remembered(page).getByRole("button", { name: "Retry remembering details", exact: true }).click();
  await expect(remembered(page)).toContainText("Remembered details changed in another tab.");
  expect(await profileRecord(page)).toEqual(external);
});
