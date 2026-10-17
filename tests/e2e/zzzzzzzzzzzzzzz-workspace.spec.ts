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
import { clinicalDraftKey, type ComponentDraft, draftRecordKey, initialUiDrafts } from "../../src/browser/ui-drafts";
import { workspaceInput } from "../../src/browser/workspace-state";
import { correctionAccount, openingAccount } from "../fixtures/fixed-inputs";
import { draftOwnerHarnessHtml, readDraftLifecycle } from "./ui-draft-harness";
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
    await expect(page.getByLabel("Reporter first name", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Report steps" }).getByRole("button", { name: /Reporter details$/ })).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("heading", { name: "Some details were left out", exact: true })).toBeVisible();
    await goTo(page, "Review details");
    await expect(page.locator("[data-conflict-review]")).toBeVisible();
    await expect(page.locator("[data-conflict-review]").getByRole("button")).toHaveCount(2);
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
    const saving = page.getByRole("region", { name: "Browser saving" });
    // Independent typing can fail to save before the held correction returns.
    // That earlier failure is not evidence that its response was accepted yet.
    await expect(saving.getByRole("status")).toContainText("Changes are not saved");
    expect((await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-current-case-debug-v1")!))).case.patient.facts.ageYears.resolvedValue.value.value).toBe(57);
    const acknowledgement = page.waitForResponse(response => response.url().endsWith("/api/case") && response.request().method() === "POST" && response.request().postDataJSON()?.action?.action === "set-fact");
    release(); expect((await acknowledgement).ok()).toBe(true);
    await expect(age.getByRole("button", { name: "Change", exact: true })).toBeEnabled();
    await expect(saving.getByRole("status")).toContainText("Changes are not saved");
    await expect(age).toContainText("58");
    const accepted = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-current-case-debug-v1")!));
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
  const pending = { kind: "card", scope, dependency: "earlier-product", data: { showMore: true, showOutcomes: false, drafts: { dose: { kind: "known", value: "declined", qualifier: "uncertain" }, strength: { kind: "known", value: "  Earlier unfinished dose wording " } }, qualifierControls: { dose: true }, factVersions: {} } };
  raw.payload.drafts.data.ui.records[draftRecordKey("card", scope)] = pending;
  await putRecord(page, raw); await page.reload(); await saved(page);
  const retained = page.getByRole("complementary", { name: "Retained unfinished work" });
  await retained.getByText("Read earlier unfinished edits", { exact: true }).click();
  await expect(retained).toContainText("Earlier unfinished dose wording");
  await expect(retained.getByText("declined — uncertain", { exact: true })).toBeVisible();
  let replacementPrompts = 0;
  page.once("dialog", async dialog => { replacementPrompts++; await dialog.dismiss(); });
  await page.getByRole("button", { name: "New case", exact: true }).click();
  expect(replacementPrompts).toBe(1);
  await expect(retained).toBeVisible();
  await expect(retained.getByRole("button", { name: /^(Apply|Accept|Add|Use)\b/ })).toHaveCount(0);
  const after = await record(page);
  expect(after.payload.state).toEqual(original.payload.state);
  expect(after.payload.drafts.data.retained).toHaveLength(1);
  expect(after.payload.drafts.data.retained[0].record).toEqual(pending);
  expect(after.payload.drafts.data.ui.records).not.toHaveProperty(draftRecordKey("card", scope));
  await page.reload(); await saved(page);
  expect((await record(page)).payload.drafts.data.retained).toEqual(after.payload.drafts.data.retained);
  await page.getByRole("complementary", { name: "Retained unfinished work" }).getByText("Read earlier unfinished edits", { exact: true }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Discard these earlier edits", exact: true }).click(); await saved(page);
  expect((await record(page)).payload.state).toEqual(original.payload.state);
  expect((await record(page)).payload.drafts.data.retained).toEqual([]);
  await expect(page.getByRole("complementary", { name: "Retained unfinished work" })).toHaveCount(0);
});


function legacyTaskDraft(kind: typeof workspaceTaskKinds[number], fixture: Awaited<ReturnType<typeof workspaceTaskCase>>):ComponentDraft {
 const data = {
  indications:{choices:{[fixture.state.case.products[0].id]:"known"},texts:{[fixture.state.case.products[0].id]:"  Unfinished reason for this medicine "}},
  "serious-outcomes":{selected:["death"]},
  "death-date":{date:"2026-10-12"},
  "clinical-context":{testChoice:"known",historyChoice:"known",testName:"  Unfinished fictional test ",testResult:" 12. ",lowRange:"0",highRange:"",testDate:"",history:"  Unfinished fictional history "},
  "medication-history":{answers:{stopped:{kind:"known",value:true},improvedAfterChange:{kind:"known",value:false},stopDate:{kind:"known",value:""}}},
  "device-details":{implantChoice:"known",explantChoice:"inapplicable",reprocessorChoice:"known",implantDate:"2026-10-01",explantDate:"",reprocessor:"  Unfinished fictional reprocessor "},
 }[kind];
 return {kind,scope:fixture.snapshot.clarification!.key,dependency:clinicalDraftKey(fixture.snapshot),data} as ComponentDraft;
}
for (const kind of workspaceTaskKinds) {
 test(`${kind} legacy unfinished answers survive a real browser process restart as readable retained work`, async ({baseURL})=>{
  const profile=await mkdtemp(join(tmpdir(),`wilson-${kind}-profile-`));let context=await chromium.launchPersistentContext(profile,{headless:true});
  try{
   let page=context.pages()[0];await page.goto(baseURL!);await saved(page);const fixture=await workspaceTaskCase(kind);expect(fixture.snapshot.clarification?.kind).toBe(kind);
   const pending=legacyTaskDraft(kind,fixture),key=draftRecordKey(kind,pending.scope),ui={...initialUiDrafts(fixture.state.case.id),screen:"details" as const};ui.text.update="  Genuine unsent clinical words ";ui.records[key]=pending;
   const input=workspaceInput(fixture.state,{version:1,provenance:fixture.provenance,ui,retained:[]});await putRecord(page,{version:1,generation:randomUUID(),savedAt:new Date().toISOString(),payload:input});
   const browser=context.browser();await context.close();expect(browser?.isConnected()).toBe(false);context=await chromium.launchPersistentContext(profile,{headless:true});page=context.pages()[0];const operations:string[]=[];page.on("request",r=>{if(r.url().endsWith("/api/case")&&r.method()==="POST")operations.push(r.postDataJSON().operation);});await page.goto(baseURL!);await saved(page);
   const retained=page.getByRole("complementary",{name:"Retained unfinished work"});await retained.getByText("Read earlier unfinished edits",{exact:true}).click();await expect(retained).toContainText("They have not been applied");await expect(retained.getByRole("button",{name:/^(Apply|Accept|Add|Use)\b/})).toHaveCount(0);await expect(page.getByLabel("Clinical update",{exact:true})).toHaveValue(ui.text.update);
   const after=await record(page);expect(after.payload.state.case).toEqual(fixture.state.case);expect(after.payload.drafts.data.retained).toHaveLength(1);expect(after.payload.drafts.data.retained[0].record).toEqual(pending);expect(after.payload.drafts.data.ui.records).not.toHaveProperty(key);expect(operations).toEqual(["resume"]);await page.reload();await saved(page);expect((await record(page)).payload.drafts.data.retained).toEqual(after.payload.drafts.data.retained);
  }finally{await context.close();await rm(profile,{recursive:true,force:true});}
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
  const accepted = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-current-case-debug-v1")!));
  expect(accepted.case.patient.facts.ageYears.resolvedValue.value.value).toBe(58);
  await status.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(status.getByRole("status")).toContainText("Changes are not saved");
  expect(await record(page)).toEqual(before); expect(actions).toBe(1); expect(errors).toEqual([]);
});


test("a live prerequisite correction retains unfinished medication answers without applying or duplicating them", async ({ page }) => {
  await page.goto("/"); await saved(page);
  const fixture = await workspaceTaskCase("medication-history");
  const pending=legacyTaskDraft("medication-history",fixture);if(pending.kind!=="medication-history")throw Error("fixture");pending.data.answers.stopDate={kind:"known",value:"2026-10-12"};
  const taskKey=draftRecordKey(pending.kind,pending.scope),ui={...initialUiDrafts(fixture.state.case.id),screen:"details" as const};ui.records[taskKey]=pending;
  const input=workspaceInput(fixture.state,{version:1,provenance:fixture.provenance,ui,retained:[]});
  await putRecord(page,{version:1,generation:randomUUID(),savedAt:new Date().toISOString(),payload:input});await page.reload();await saved(page);
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


test("an incompatible legacy tab record survives unsaved recovery and a blank New case", async ({ page }) => {
  const raw = JSON.stringify({ version: "wilson-browser-state-v999", stage: "describe", case: { id: "case-11111111-1111-4111-8111-111111111199" }, unrepresented: [] });
  await page.addInitScript(raw => sessionStorage.setItem("wilson-journey-state-v2", raw), raw);
  await page.goto("/");
  await expect(page.locator("main").getByRole("alert")).toContainText("compatible version");
  await page.getByRole("button", { name: "Continue with a new unsaved case" }).click();
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  const oldId = await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-current-case-debug-v1") ?? "null")?.case?.id);
  const reset = page.waitForResponse(response => response.url().endsWith("/api/case") && response.request().method() === "GET");
  await page.getByRole("button", { name: "New case", exact: true }).click();
  expect((await reset).ok()).toBe(true);
  await expect(page.locator("header").getByRole("status")).toHaveText("New case started");
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Browser saving" }).getByRole("status")).toContainText("Working without saving");
  expect(await page.evaluate(() => sessionStorage.getItem("wilson-journey-state-v2"))).toBe(raw);
  expect(oldId).toBeUndefined(); // No current debug mirror is written in unsaved mode.
});

test("an existing browser case does not overwrite this tab's separate legacy work", async ({ page }) => {
  await page.goto("/"); await saved(page); const before = await record(page);
  const earlier = await workspaceTaskCase("indications"), raw = JSON.stringify(earlier.state);
  await page.evaluate(raw => sessionStorage.setItem("wilson-journey-state-v2", raw), raw);
  await page.reload(); await saved(page);
  await expect(page.getByText("Earlier work from this tab has been left unchanged. Wilson is showing the current browser case.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("wilson-journey-state-v2"))).toBe(raw);
  expect((await record(page)).payload.state).toEqual(before.payload.state);
  expect((await page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-current-case-debug-v1")!))).case.id).toBe(before.payload.state.case.id);
});

test("actual development StrictMode cancels a pending native lease without blocking its replacement effect", async ({ page }) => {
  const html = await draftOwnerHarnessHtml(true);
  await page.addInitScript(() => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const probe = { entered: false, release };
    (window as unknown as { pendingLeaseProbe: typeof probe }).pendingLeaseProbe = probe;
    const manager = navigator.locks, request = manager.request.bind(manager);
    let first = true;
    manager.request = ((name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => request(name, options, async lock => {
      if (name === "wilson-active-case-workspace" && first) { first = false; probe.entered = true; await gate; }
      return callback(lock);
    })) as LockManager["request"];
  });
  await page.route("**/__strict-workspace-check", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("/__strict-workspace-check");
  await expect.poll(async () => (await readDraftLifecycle(page))).toEqual({ starts: 2, stops: 1 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { pendingLeaseProbe: { entered: boolean } }).pendingLeaseProbe.entered)).toBe(true);
  await page.evaluate(() => navigator.locks.query());
  await page.evaluate(() => (window as unknown as { pendingLeaseProbe: { release(): void } }).pendingLeaseProbe.release());
  await expect(page.getByLabel("Case description", { exact: true })).toBeVisible(); await saved(page);
  await expect(page.getByRole("heading", { name: "This case is open in another tab" })).toHaveCount(0);
});


test("damaged legacy input is removed only after explicit confirmed discard", async ({ page }) => {
  const raw = "{ damaged fictional legacy input";
  await page.addInitScript(raw => sessionStorage.setItem("wilson-journey-state-v2", raw), raw);
  await page.goto("/");
  const discard = page.getByRole("button", { name: "Discard damaged saved work" });
  await expect(discard).toBeVisible();
  page.once("dialog", dialog => dialog.dismiss()); await discard.click();
  expect(await page.evaluate(() => sessionStorage.getItem("wilson-journey-state-v2"))).toBe(raw);
  page.once("dialog", dialog => dialog.accept()); await discard.click(); await saved(page);
  expect(await page.evaluate(() => sessionStorage.getItem("wilson-journey-state-v2"))).toBeNull();
  await expect(page.getByLabel("Case description", { exact: true })).toHaveValue("");
});
