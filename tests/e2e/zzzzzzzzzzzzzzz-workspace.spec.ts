import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { acceptOpeningCase, answerIndications, attachCorrectionAndContradiction } from "../domain/fixture";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot, performJourneyAction } from "../../src/server/journey/service";
import { journeyResponse } from "../../src/server/case/browser-state";
import { draftRecordKey, initialUiDrafts } from "../../src/browser/ui-drafts";
import { workspaceInput } from "../../src/browser/workspace-state";
import { correctionAccount, openingAccount } from "../fixtures/fixed-inputs";
import { workspaceTaskCase, workspaceTaskKinds } from "../fixtures/workspace-tasks";
import { goTo } from "./draft4-helpers";

const saved = (page: Page) => expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toHaveText("Saved in this browser");
async function record(page: Page, latestVersion = false) {
  return page.evaluate(async latest => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = latest ? indexedDB.open("wilson-browser-persistence") : indexedDB.open("wilson-browser-persistence", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise<any>((resolve, reject) => { const tx = db.transaction("active-case"), r = tx.objectStore("active-case").get("active"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
    finally { db.close(); }
  }, latestVersion);
}
async function putRecord(page: Page, raw: unknown) {
  await page.evaluate(async json => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("wilson-browser-persistence", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("active-case", "readwrite"); tx.objectStore("active-case").put(JSON.parse(json), "active"); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); }
    finally { db.close(); }
  }, JSON.stringify(raw));
}
async function clinicalFixture() {
  const base = { ...answerIndications(acceptOpeningCase()), id: `case-${randomUUID()}` };
  const repository = new InMemoryCaseRepository({ initialCase: base });
  await performJourneyAction(repository, base.id, { action: "set-fact", target: "patient:patient:ageYears", value: { kind: "known", value: 57, qualifier: "approximately" } }, { propose: async () => { throw new Error("No model calls"); } });
  const initial = await journeyResponse(repository, await getJourneySnapshot(repository, base.id));
  let current = attachCorrectionAndContradiction((await repository.load(base.id))!);
  const groupId = current.products[0].facts.startDate.proposedValues[0].groupId;
  current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "restart-partial-review", expectedRevision: current.revision, decisions: [{ groupId, action: "accept" }] }).case;
  const restored = new InMemoryCaseRepository({ initialCase: current });
  return { initial, pending: await journeyResponse(restored, await getJourneySnapshot(restored, current.id, [{ entity: "event", field: "symptoms", evidenceQuote: "Fictional retained detail", reason: "incompatible-value" }])) };
}

test("a real browser process restart retains pending/conflicted knowledge, complete words and actual unfinished controls; only one tab edits", async ({ baseURL }) => {
  const profile = await mkdtemp(join(tmpdir(), "wilson-restart-profile-"));
  let context = await chromium.launchPersistentContext(profile, { headless: true });
  try {
    let page = context.pages()[0]; await page.goto(baseURL!); await saved(page);
    const { initial: fixture, pending } = await clinicalFixture();
    const ui = { ...initialUiDrafts(fixture.state.case.id), screen: "details" as const, conversation: [
      { id: "opening", kind: "opening" as const, text: openingAccount, revision: 1 },
    ] };
    const input = workspaceInput(fixture.state, { version: 1, provenance: fixture.provenance, ui, retained: [] });
    await putRecord(page, { version: 1, generation: randomUUID(), savedAt: new Date().toISOString(), payload: input });
    await page.reload(); await saved(page);
    const age = page.locator('#case-card-patient [data-field="ageYears"]');
    await age.getByRole("button", { name: "Change", exact: true }).click();
    await age.getByLabel("New Age", { exact: true }).fill("58");
    await age.getByLabel("Uncertainty or context for Age", { exact: true }).fill("");
    await goTo(page, "Reporter details");
    await page.getByLabel("Reporter first name", { exact: true }).fill("  Fictional unfinished ");
    await page.getByLabel("Reporter email", { exact: true }).fill("unfinished@");
    await page.getByLabel("Date of this report", { exact: true }).fill("");
    await goTo(page, "Review details");
    await page.getByLabel("Clinical update", { exact: true }).fill("  Unsent correction with every word retained. ");
    await saved(page);
    // Fixture a pending update after actual control entry. Pending review hides
    // direct editors by design; it must retain their unfinished values.
    const prepared = await record(page);
    prepared.generation = randomUUID();
    prepared.payload.state = pending.state;
    prepared.payload.drafts.data.provenance = pending.provenance;
    prepared.payload.drafts.data.ui.conversation.push({ id: "update", kind: "update", text: correctionAccount, revision: pending.state.case.revision });
    await putRecord(page, prepared);
    const follower = await context.newPage();
    const competing: string[] = [];
    follower.on("request", r => { if (r.url().endsWith("/api/case")) competing.push(r.method()); });
    await follower.goto(baseURL!);
    await expect(follower.getByRole("heading", { name: "This case is open in another tab" })).toBeVisible();
    expect(competing).toEqual([]);
    await page.close();
    await follower.getByRole("button", { name: "Try this tab again" }).click();
    await saved(follower);
    await expect(follower.getByLabel("Clinical update", { exact: true })).toHaveValue("  Unsent correction with every word retained. ");
    await goTo(follower, "Reporter details"); await saved(follower);
    const before = await record(follower);
    expect(before.payload.state).toEqual(JSON.parse(JSON.stringify(pending.state)));
    expect(before.payload.drafts.data.ui.conversation.map((item: { text: string }) => item.text)).toEqual([openingAccount, correctionAccount]);
    const oldBrowser = context.browser();
    await context.close();
    expect(oldBrowser?.isConnected()).toBe(false);
    context = await chromium.launchPersistentContext(profile, { headless: true });
    page = context.pages()[0];
    const operations: string[] = [];
    page.on("request", r => { if (r.url().endsWith("/api/case") && r.method() === "POST") operations.push(r.postDataJSON().operation); });
    await page.goto(baseURL!); await saved(page);
    await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("  Fictional unfinished ");
    await goTo(page, "Review details");
    await expect(page.getByLabel("Clinical update", { exact: true })).toHaveValue("  Unsent correction with every word retained. ");
    const recovered = await record(page);
    const patientDraft = recovered.payload.drafts.data.ui.records[draftRecordKey("card", JSON.stringify(["patient", "patient"]))].data;
    expect(patientDraft).toMatchObject({ editing: "ageYears", drafts: { ageYears: { kind: "known", value: 58, qualifier: "" } }, qualifierControls: { ageYears: true } });
    await expect(page.locator('#case-card-patient [data-field="ageYears"]')).toContainText("Unsaved edit: 58");
    await goTo(page, "Describe");
    await expect(page.getByText(openingAccount, { exact: true })).toBeVisible();
    await goTo(page, "Reporter details");
    await expect(page.getByLabel("Reporter first name", { exact: true })).toHaveValue("  Fictional unfinished ");
    await expect(page.getByLabel("Reporter email", { exact: true })).toHaveValue("unfinished@");
    await expect(page.getByLabel("Date of this report", { exact: true })).toHaveValue("");
    await saved(page);
    const after = await record(page);
    expect(after.payload.state).toEqual(before.payload.state);
    expect(after.payload.drafts.data.ui.conversation).toEqual(before.payload.drafts.data.ui.conversation);
    expect(operations).toEqual(["resume"]);
  } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("raw opening/report selection persists without any action request", async ({ page }) => {
  await page.goto("/"); await saved(page);
  await page.getByLabel("Case description", { exact: true }).fill("  Fictional unfinished opening — no interpretation. ");
  await page.getByLabel("Product problem", { exact: true }).check();
  await saved(page);
  const before = await record(page), actions: string[] = [];
  page.on("request", r => { if (r.url().endsWith("/api/case") && r.method() === "POST") actions.push(r.postDataJSON().operation); });
  await page.reload(); await saved(page);
  await expect(page.getByLabel("Case description", { exact: true })).toHaveValue("  Fictional unfinished opening — no interpretation. ");
  await expect(page.getByLabel("Product problem", { exact: true })).toBeChecked();
  expect((await record(page)).payload).toEqual(before.payload);
  expect(actions).toEqual(["resume"]);
});

test("corrupt/future records remain retained; confirmed corrupt recovery refuses a changed valid record", async ({ page }) => {
  await page.goto("/"); await saved(page);
  const initial = await record(page);
  await putRecord(page, { version: 2, payload: { fictional: "Future content" } });
  await page.reload();
  await expect(page.locator("main").getByRole("alert")).toContainText("compatible version");
  await expect(page.getByRole("button", { name: "Discard damaged saved work" })).toHaveCount(0);
  expect(await record(page)).toEqual({ version: 2, payload: { fictional: "Future content" } });
  await putRecord(page, { version: 1, damaged: " Retain these original words " });
  await page.getByRole("button", { name: "Retry loading saved work" }).click();
  await expect(page.getByRole("button", { name: "Discard damaged saved work" })).toBeVisible();
  await putRecord(page, initial);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Discard damaged saved work" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("changed or could not be discarded");
  expect(await record(page)).toEqual(initial);
  await putRecord(page, { version: 1, damaged: " Confirmed fictional damage " });
  await page.getByRole("button", { name: "Retry loading saved work" }).click();
  await expect(page.getByRole("button", { name: "Discard damaged saved work" })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Discard damaged saved work" }).click();
  await saved(page);
  expect((await record(page)).payload.state.case.id).not.toBe(initial.payload.state.case.id);
});

for (const failure of ["quota", "abort"] as const) {
  test(`a successful correction survives ${failure} storage failure; retry saves once without repeating the action`, async ({ page }) => {
    await page.goto("/"); await saved(page);
    const { initial } = await clinicalFixture();
    const input = workspaceInput(initial.state, { version: 1, provenance: initial.provenance, ui: { ...initialUiDrafts(initial.state.case.id), screen: "details" }, retained: [] });
    await putRecord(page, { version: 1, generation: randomUUID(), savedAt: new Date().toISOString(), payload: input });
    await page.reload(); await saved(page);
    const previous = await record(page);
    const age = page.locator('#case-card-patient [data-field="ageYears"]');
    await age.getByRole("button", { name: "Change", exact: true }).click();
    await age.getByLabel("New Age", { exact: true }).fill("58");
    await saved(page);
    const beforeFailure = await record(page);
    await page.evaluate(failure => {
      const put = IDBObjectStore.prototype.put;
      (window as unknown as { restorePut(): void }).restorePut = () => { IDBObjectStore.prototype.put = put; };
      IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
        if (failure === "quota") throw new DOMException("Synthetic quota failure", "QuotaExceededError");
        const request = put.apply(this, args); this.transaction.abort(); return request;
      };
    }, failure);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let actions = 0;
    await page.route("**/api/case", async route => {
      if (route.request().postDataJSON()?.operation !== "act") return route.continue();
      actions++; await gate; await route.continue();
    });
    await age.getByRole("button", { name: "Apply correction", exact: true }).click();
    await expect(age.getByLabel("New Age", { exact: true })).toBeDisabled();
    const update = page.getByLabel("Clinical update", { exact: true });
    await expect(update).toBeEnabled(); await update.fill("  Independent newer words while correction is pending. ");
    release();
    const saving = page.getByRole("region", { name: "Browser saving" });
    await expect(saving.getByRole("status")).toContainText("Changes are not saved");
    await expect(age).toContainText("58");
    const accepted = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!));
    expect(accepted.case.patient.facts.ageYears.resolvedValue.value).toEqual({ kind: "known", value: 58, qualifier: "approximately" });
    expect((await record(page))).toEqual(beforeFailure);
    expect(accepted.case.revision).toBeGreaterThan(previous.payload.state.case.revision);
    await page.evaluate(() => (window as unknown as { restorePut(): void }).restorePut());
    await saving.getByRole("button", { name: "Retry save", exact: true }).click(); await saved(page);
    expect((await record(page)).payload.state).toEqual(accepted);
    expect((await record(page)).payload.drafts.data.ui.text.update).toBe("  Independent newer words while correction is pending. ");
    expect(actions).toBe(1);
  });
}

test("saved status waits for the latest native transaction, including typing while an earlier save is queued", async ({ page }) => {
  await page.goto("/"); await saved(page);
  const before = await record(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("wilson-browser-persistence", 1); r.onsuccess = () => resolve(r.result); });
    let released = false;
    const tx = db.transaction("active-case", "readwrite"), table = tx.objectStore("active-case");
    (window as unknown as { releaseStorage(): void }).releaseStorage = () => { released = true; };
    const keep = () => { const r = table.get("active"); r.onsuccess = () => { if (!released) keep(); }; }; keep();
    tx.oncomplete = () => db.close(); tx.onabort = () => db.close();
  });
  const opening = page.getByLabel("Case description", { exact: true });
  await opening.fill("Earlier queued fictional words");
  const status = page.getByRole("region", { name: "Browser saving" }).getByRole("status");
  await expect(status).toHaveText("Saving in this browser…");
  await opening.fill("  Latest fictional words must be the saved snapshot. ");
  await expect(status).toHaveText("Saving in this browser…");
  await page.evaluate(() => (window as unknown as { releaseStorage(): void }).releaseStorage());
  await saved(page);
  const after = await record(page);
  expect(after.generation).not.toBe(before.generation);
  expect(after.payload.drafts.data.ui.text.opening).toBe("  Latest fictional words must be the saved snapshot. ");
});

test("unavailable durable and session storage allow only an explicitly unsaved new case without a page error", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { get() { throw new DOMException("Synthetic unavailable storage", "SecurityError"); } });
    Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Synthetic unavailable session", "SecurityError"); } });
  });
  await page.goto("/");
  await expect(page.locator("main").getByRole("alert")).toContainText("retained");
  await page.getByRole("button", { name: "Continue with a new unsaved case" }).click();
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toContainText("Working without saving");
  await page.getByLabel("Case description", { exact: true }).fill("  Explicitly unsaved fictional work ");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await expect(page.getByLabel("Case description", { exact: true })).toHaveValue("  Explicitly unsaved fictional work ");
  expect(errors).toEqual([]);
});

test("unsupported inner state remains unchanged while an explicit unsaved case is used", async ({ page }) => {
  await page.goto("/"); await saved(page);
  const future = await record(page); future.payload.state.version = "wilson-browser-state-v999";
  future.payload.drafts.data.provenance.stateVersion = "wilson-browser-state-v999";
  await putRecord(page, future); await page.reload();
  await expect(page.locator("main").getByRole("alert")).toContainText("compatible version");
  await expect(page.getByRole("button", { name: "Discard damaged saved work" })).toHaveCount(0);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let gets = 0;
  await page.route("**/api/case", async route => {
    if (route.request().method() !== "GET") return route.continue();
    gets++; await gate; await route.continue();
  });
  await page.getByRole("button", { name: "Continue with a new unsaved case" }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect.poll(() => gets).toBe(1);
  await expect(page.getByRole("button", { name: "Retry loading saved work" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue with a new unsaved case" })).toBeDisabled();
  release();
  await page.getByLabel("Case description", { exact: true }).fill("  New unsaved words ");
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toContainText("Working without saving");
  expect(await record(page)).toEqual(future);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Return to saved work" }).click();
  await expect(page.getByLabel("Case description", { exact: true })).toHaveValue("  New unsaved words ");
  expect(await record(page)).toEqual(future);
  let finishReset!: () => void; const resetGate = new Promise<void>(resolve => { finishReset = resolve; });
  await page.route("**/api/case", async route => { if (route.request().method() === "GET") await resetGate; await route.continue(); }, { times: 1 });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await expect(page.getByRole("button", { name: "Return to saved work" })).toBeDisabled();
  finishReset();
  await expect(page.getByLabel("Case description", { exact: true })).toHaveValue("");
  expect(await record(page)).toEqual(future);
});

test("invalidated unfinished edits remain readable after resume and another reload without changing knowledge", async ({ page }) => {
  await page.goto("/"); await saved(page);
  const original = await record(page), raw = structuredClone(original);
  const scope = JSON.stringify(["product", "earlier-product"]);
  const pending = { kind: "card", scope, dependency: "earlier-product", data: { showMore: true, showOutcomes: false, drafts: { dose: { kind: "known", value: "  Earlier unfinished dose wording ", qualifier: "uncertain" } }, qualifierControls: { dose: true }, factVersions: {} } };
  raw.payload.drafts.data.ui.records[draftRecordKey("card", scope)] = pending;
  await putRecord(page, raw); await page.reload(); await saved(page);
  const retained = page.getByRole("complementary", { name: "Retained unfinished work" });
  await retained.getByText("Read earlier unfinished edits", { exact: true }).click();
  await expect(retained).toContainText("Earlier unfinished dose wording");
  await expect(retained.getByRole("button")).toHaveCount(0);
  const after = await record(page);
  expect(after.payload.state).toEqual(original.payload.state);
  expect(after.payload.drafts.data.retained).toHaveLength(1);
  expect(after.payload.drafts.data.retained[0].record).toEqual(pending);
  expect(after.payload.drafts.data.ui.records).not.toHaveProperty(draftRecordKey("card", scope));
  await page.reload(); await saved(page);
  expect((await record(page)).payload.drafts.data.retained).toEqual(after.payload.drafts.data.retained);
});


for (const kind of workspaceTaskKinds) {
  test(`${kind} unfinished answers survive a real browser process restart without submitting`, async ({ baseURL }) => {
    const profile = await mkdtemp(join(tmpdir(), `wilson-${kind}-profile-`));
    let context = await chromium.launchPersistentContext(profile, { headless: true });
    try {
      let page = context.pages()[0]; await page.goto(baseURL!); await saved(page);
      const fixture = await workspaceTaskCase(kind);
      expect(fixture.snapshot.stage).toBe("clarify");
      expect(fixture.snapshot.clarification?.kind).toBe(kind);
      const input = workspaceInput(fixture.state, { version: 1, provenance: fixture.provenance, ui: { ...initialUiDrafts(fixture.state.case.id), screen: "details" }, retained: [] });
      await putRecord(page, { version: 1, generation: randomUUID(), savedAt: new Date().toISOString(), payload: input });
      await page.reload(); await saved(page);
      const fill = async () => {
        if (kind === "indications") await page.getByLabel("Fictional medicine indication", { exact: true }).fill("  Unfinished reason for this medicine ");
        if (kind === "serious-outcomes") await page.locator("#clinical-question").getByRole("checkbox", { name: "Death", exact: true }).check();
        if (kind === "death-date") await page.getByLabel("Date of death", { exact: true }).fill("2026-10-12");
        if (kind === "clinical-context") {
          await page.getByRole("radio", { name: "Add one relevant result", exact: true }).check();
          await page.getByLabel("Test identity", { exact: true }).fill("  Unfinished fictional test ");
          await page.getByLabel("Result and stated units", { exact: true }).fill(" 12. ");
          await page.getByLabel("Low range", { exact: true }).fill("0");
          await page.getByRole("radio", { name: "Add relevant history", exact: true }).check();
          await page.getByLabel("Relevant medical history", { exact: true }).fill("  Unfinished fictional history ");
        }
        if (kind === "medication-history") {
          await page.getByLabel("Was this medication stopped?", { exact: true }).selectOption("true");
          await page.getByLabel("Did the event improve after stopping or reducing it?", { exact: true }).selectOption("false");
          await page.getByLabel("When was it stopped?", { exact: true }).selectOption("known");
          await page.getByLabel("Stop date", { exact: true }).fill("");
        }
        if (kind === "device-details") {
          await page.getByRole("group", { name: "Implant date", exact: true }).getByRole("radio", { name: "Known", exact: true }).check();
          await page.getByLabel("Device implant date", { exact: true }).fill("2026-10-01");
          await page.getByRole("group", { name: "Explant date", exact: true }).getByRole("radio", { name: "Not applicable", exact: true }).check();
          await page.getByRole("group", { name: "Reprocessor", exact: true }).getByRole("radio", { name: "Known", exact: true }).check();
          await page.getByLabel("Device reprocessor", { exact: true }).fill("  Unfinished fictional reprocessor ");
        }
      };
      await fill(); await saved(page);
      const before = await record(page);
      const key = draftRecordKey(kind, fixture.snapshot.clarification!.key);
      expect(before.payload.drafts.data.ui.records[key].kind).toBe(kind);
      const browser = context.browser(); await context.close(); expect(browser?.isConnected()).toBe(false);
      context = await chromium.launchPersistentContext(profile, { headless: true });
      page = context.pages()[0]; const operations: string[] = [];
      page.on("request", r => { if (r.url().endsWith("/api/case") && r.method() === "POST") operations.push(r.postDataJSON().operation); });
      await page.goto(baseURL!); await saved(page);
      if (kind === "indications") await expect(page.getByLabel("Fictional medicine indication", { exact: true })).toHaveValue("  Unfinished reason for this medicine ");
      if (kind === "serious-outcomes") await expect(page.locator("#clinical-question").getByRole("checkbox", { name: "Death", exact: true })).toBeChecked();
      if (kind === "death-date") await expect(page.getByLabel("Date of death", { exact: true })).toHaveValue("2026-10-12");
      if (kind === "clinical-context") {
        await expect(page.getByLabel("Test identity", { exact: true })).toHaveValue("  Unfinished fictional test ");
        await expect(page.getByLabel("Result and stated units", { exact: true })).toHaveValue(" 12. ");
        await expect(page.getByLabel("Low range", { exact: true })).toHaveValue("0");
        await expect(page.getByLabel("Relevant medical history", { exact: true })).toHaveValue("  Unfinished fictional history ");
      }
      if (kind === "medication-history") {
        await expect(page.getByLabel("Was this medication stopped?", { exact: true })).toHaveValue("true");
        await expect(page.getByLabel("Did the event improve after stopping or reducing it?", { exact: true })).toHaveValue("false");
        await expect(page.getByLabel("When was it stopped?", { exact: true })).toHaveValue("known");
        await expect(page.getByLabel("Stop date", { exact: true })).toHaveValue("");
      }
      if (kind === "device-details") {
        await expect(page.getByLabel("Device implant date", { exact: true })).toHaveValue("2026-10-01");
        await expect(page.getByRole("group", { name: "Explant date", exact: true }).getByRole("radio", { name: "Not applicable", exact: true })).toBeChecked();
        await expect(page.getByLabel("Device reprocessor", { exact: true })).toHaveValue("  Unfinished fictional reprocessor ");
      }
      const after = await record(page);
      expect(after.payload.state).toEqual(before.payload.state);
      expect(after.payload.drafts.data.ui.records[key]).toEqual(before.payload.drafts.data.ui.records[key]);
      expect(operations).toEqual(["resume"]);
    } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
  });
}


test("incompatible success metadata retains the accepted response in memory and never retries an older save or action", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/"); await saved(page);
  const { initial } = await clinicalFixture();
  const input = workspaceInput(initial.state, { version: 1, provenance: initial.provenance, ui: { ...initialUiDrafts(initial.state.case.id), screen: "details" }, retained: [] });
  await putRecord(page, { version: 1, generation: randomUUID(), savedAt: new Date().toISOString(), payload: input });
  await page.reload(); await saved(page);
  const age = page.locator('#case-card-patient [data-field="ageYears"]');
  await age.getByRole("button", { name: "Change", exact: true }).click();
  await age.getByLabel("New Age", { exact: true }).fill("58"); await saved(page);
  const before = await record(page); let actions = 0;
  await page.route("**/api/case", async route => {
    if (route.request().postDataJSON()?.operation !== "act") return route.continue();
    actions++; const response = await route.fetch(), body = await response.json(); delete body.provenance;
    await route.fulfill({ response, json: body });
  });
  await age.getByRole("button", { name: "Apply correction", exact: true }).click();
  const status = page.getByRole("region", { name: "Browser saving" });
  await expect(status.getByRole("status")).toContainText("Changes are not saved");
  await expect(age.getByRole("button", { name: "Change", exact: true })).toBeEnabled();
  await expect(age).toContainText("58");
  const accepted = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!));
  expect(accepted.case.patient.facts.ageYears.resolvedValue.value.value).toBe(58);
  await status.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(status.getByRole("status")).toContainText("Changes are not saved");
  expect(await record(page)).toEqual(before); expect(actions).toBe(1); expect(errors).toEqual([]);
});


test("a live prerequisite correction retains unfinished medication answers without applying or duplicating them", async ({ page }) => {
  await page.goto("/"); await saved(page);
  const fixture = await workspaceTaskCase("medication-history");
  const input = workspaceInput(fixture.state, { version: 1, provenance: fixture.provenance, ui: { ...initialUiDrafts(fixture.state.case.id), screen: "details" }, retained: [] });
  await putRecord(page, { version: 1, generation: randomUUID(), savedAt: new Date().toISOString(), payload: input });
  await page.reload(); await saved(page);
  await page.getByLabel("Was this medication stopped?", { exact: true }).selectOption("true");
  await page.getByLabel("When was it stopped?", { exact: true }).selectOption("known");
  await page.getByLabel("Stop date", { exact: true }).fill("2026-10-12");
  await saved(page);
  const before = await record(page), taskKey = draftRecordKey("medication-history", fixture.snapshot.clarification!.key);
  const pending = before.payload.drafts.data.ui.records[taskKey];
  const type = page.locator('#case-card-product-1 [data-field="productType"]');
  await type.getByRole("button", { name: "Change", exact: true }).click();
  await type.getByLabel("New Product type", { exact: true }).selectOption("other");
  await type.getByRole("button", { name: "Apply correction", exact: true }).click(); await saved(page);
  const retained = page.getByRole("complementary", { name: "Retained unfinished work" });
  await retained.getByText("Read earlier unfinished edits", { exact: true }).click();
  await expect(retained).toContainText("2026-10-12");
  const after = await record(page);
  expect(after.payload.state.case.products[0].facts.productType.resolvedValue.value).toEqual({ kind: "known", value: "other" });
  expect(after.payload.state.case.products[0].facts.stopped.state).toBe("empty");
  expect(after.payload.drafts.data.retained).toHaveLength(1);
  expect(after.payload.drafts.data.retained[0].record).toEqual(pending);
  expect(after.payload.drafts.data.ui.records).not.toHaveProperty(taskKey);
  await page.reload(); await saved(page);
  expect((await record(page)).payload.drafts.data.retained).toEqual(after.payload.drafts.data.retained);
});


test("a newer native database version is retained and never offers destructive recovery", async ({ page }) => {
  await page.goto("/"); await saved(page); const before = await record(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.open("wilson-browser-persistence", 2); request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error); });
  });
  await page.reload();
  await expect(page.locator("main").getByRole("alert")).toContainText("compatible version");
  await expect(page.getByRole("button", { name: "Discard damaged saved work" })).toHaveCount(0);
  expect(await record(page, true)).toEqual(before);
});
