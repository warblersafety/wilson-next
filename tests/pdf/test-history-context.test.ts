import { expect, it } from "vitest";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "@cantoo/pdf-lib";
import { NextRequest } from "next/server";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { projectForm3500 } from "../../src/domain/case/projection";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { contextSource, setContextFact } from "../fixtures/reviewed-context";
import { testHistoryContextCase, labHistoryFields, labHistoryContext, historyWording, historyContext } from "../fixtures/test-history-context";
const comments = "topmostSubform[0].Page3[0].AdditionalComments[0]", history = "topmostSubform[0].Page3[0].Sec6Data[0].OtherHistory[0]";
const table = "topmostSubform[0].Page3[0].TestDataTable[0]";
async function inspect(current: ReturnType<typeof testHistoryContextCase>, evidence = false) {
  const before = structuredClone(current), projection = projectForm3500(current);
  const result = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  const path = join(await mkdtemp(join(tmpdir(), "wilson115-test-history-")), "test-history.pdf"); await writeFile(path, result.output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  if (evidence && process.env.WILSON_TEST_HISTORY_EVIDENCE) {
    await writeFile(join(process.env.WILSON_TEST_HISTORY_EVIDENCE, "test-history.pdf"), result.output);
    await writeFile(join(process.env.WILSON_TEST_HISTORY_EVIDENCE, "readback.json"), stdout);
    await writeFile(join(process.env.WILSON_TEST_HISTORY_EVIDENCE, "projection.json"), JSON.stringify(projection, null, 2) + "\n");
  }
  expect(current).toEqual(before); return { projection, fields: JSON.parse(stdout).namedFields as Record<string, string> };
}
it("carries all five exact B6 contexts by actual row/field and scalar B7 context without altering grid values, units, dates or other controls", async () => {
  const current = testHistoryContextCase(), { fields, projection } = await inspect(current, true);
  expect(fields[comments]).toContain(`B6 table row 1 - Result and stated units context: ${labHistoryContext.testResult}`);
  expect(fields[comments]).toContain(`B6 table row 2 - Result and stated units context: second report: ${labHistoryContext.testResult}`);
  for (const text of Object.values(labHistoryContext)) expect(fields[comments]).toContain(text);
  expect(fields[comments].split("\n")).toHaveLength(10);
  expect(fields[history]).toBe(`${historyWording}\nHistory context: ${historyContext}`);
  expect(fields[`${table}.Row1[0].TestData1[0]`]).toBe("Fictional assay: 14.2 µg/L");
  expect(fields[`${table}.Row2[0].TestData2[0]`]).toBe("Fictional assay: 15.8 µg/L");
  expect(fields[`${table}.Row1[0].TDate1[0]`]).toBe("18-AUG-2026");
  expect(fields[`${table}.Row2[0].TDate2[0]`]).toBe("19-AUG-2026");
  for (const test of current.relevantTests) for (const field of labHistoryFields) {
    expect(projection.omissions.some(omission => omission.target === `test:${test.id}:${field}`)).toBe(false);
    expect(projection.sourceTrace["sections.B.relevantTestContext"]).toEqual(expect.arrayContaining(test.facts[field].resolvedValue!.sourceIds));
  }
  expect(projection.sourceTrace["sections.B.relevantHistory"]).toEqual(current.event.facts.relevantHistory.resolvedValue!.sourceIds);
  let plain = current;
  for (const test of current.relevantTests) for (const field of labHistoryFields) {
    const value = test.facts[field].resolvedValue!.value; if (value.kind === "known") plain = setContextFact(plain, `test:${test.id}:${field}`, { kind: "known", value: value.value });
  }
  plain = setContextFact(plain, "event:event:relevantHistory", { kind: "known", value: historyWording });
  const before = (await inspect(plain)).fields;
  for (const key of Object.keys(before).filter(key => key !== comments && key !== history)) expect(fields[key]).toEqual(before[key]);
});
it("withdrawal renumbers context to actual current PDF rows without cross-attribution or resurrecting withdrawn history", async () => {
  const original = testHistoryContextCase();
  const current = applyCaseCommand(original, { type: "withdraw-case-entity", commandId: "withdraw-first-lab", expectedRevision: original.revision, target: { entity: "test", entityId: "test-hemoglobin" }, source: contextSource("withdraw-first-lab") }).case;
  const { fields, projection } = await inspect(current);
  expect(fields[comments]).toContain(`B6 table row 1 - Result and stated units context: second report: ${labHistoryContext.testResult}`);
  expect(fields[comments]).not.toContain("B6 table row 2");
  expect(fields[`${table}.Row1[0].TestData1[0]`]).toBe("Fictional assay: 15.8 µg/L");
  expect(projection.sections.B.relevantTests[0].testId).toBe("test-lab-second");
  expect(current.relevantTests[0].facts.testResult).toEqual(original.relevantTests[0].facts.testResult);
});
it("context corrections/removal and serialized reload change actual output while retaining history and native sibling facts", async () => {
  const first = testHistoryContextCase();
  const changed = setContextFact(first, "test:test-hemoglobin:date", { kind: "known", value: "2026-08-18", qualifier: "day retained; collection time uncertain" });
  const removed = setContextFact(changed, "event:event:relevantHistory", { kind: "known", value: historyWording });
  const restored = parseBrowserJourneyState(JSON.parse(JSON.stringify({ version: browserStateVersion, stage: "output", case: removed, unrepresented: [] })));
  const snapshots = await Promise.all([first, changed, restored.case].map(current => getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id)));
  expect(new Set(snapshots.map(snapshot => snapshot.reportContentKey)).size).toBe(3);
  const { fields } = await inspect(restored.case);
  expect(fields[comments]).toContain("B6 table row 1 - Test date context: day retained; collection time uncertain");
  expect(fields[history]).toBe(historyWording);
  expect(fields[`${table}.Row1[0].TDate1[0]`]).toBe("18-AUG-2026");
  expect(restored.case.event.facts.relevantHistory.supersededValues.some(value => value.value.kind === "known" && value.value.qualifier === historyContext)).toBe(true);
  expect(restored.case.products).toEqual(first.products);
});
it.each(["unknown", "declined", "explicitly-absent", "inapplicable"] as const)("does not export previous context for a current %s result or history", async kind => {
  let current = setContextFact(testHistoryContextCase(), "test:test-hemoglobin:testResult", { kind });
  current = setContextFact(current, "event:event:relevantHistory", { kind });
  const { fields, projection } = await inspect(current);
  expect(fields[comments]).not.toContain(`B6 table row 1 - Result and stated units context:`);
  expect(fields[history] ?? "").not.toContain(historyContext);
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: "test:test-hemoglobin:testResult", reason: kind }));
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: "event:event:relevantHistory", reason: kind }));
});
it.each(["testName", "testResult", "lowRange", "highRange", "date", "relevantHistory"].flatMap(field => ["β uncertain", "W".repeat(2100), Array(40).fill("line").join("\n")].map(qualifier => ({ field, qualifier }))))("retains unrepresentable $field context with correct field attribution and409s", async ({ field, qualifier }) => {
  let current = testHistoryContextCase();
  const target = field === "relevantHistory" ? "event:event:relevantHistory" : `test:test-hemoglobin:${field}`;
  const fact = field === "relevantHistory" ? current.event.facts.relevantHistory : current.relevantTests[0].facts[field as typeof labHistoryFields[number]];
  const value = fact.resolvedValue!.value; if (value.kind !== "known") throw new Error("Expected known fixture");
  current = setContextFact(current, target, { ...value, qualifier });
  const before = structuredClone(current), snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
  if (!qualifier.includes("β")) {
    expect(snapshot.outputIssues.some(issue => ["unsupported-test-history", "unsupported-event-narrative"].includes(issue.code))).toBe(false);
    const output = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection);
    expect(output.readback.pageCount).toBeGreaterThan(8);
    expect(current).toEqual(before);
    return;
  }
  expect(snapshot.downloadReady).toBe(false); expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({ code: "unsupported-test-history", targets: expect.arrayContaining([target]) }));
  expect(field === "relevantHistory" ? snapshot.projection.sections.B.relevantHistory : snapshot.projection.sections.B.relevantTestContext).toContain(qualifier);
  await expect(fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection)).rejects.toThrow("B6/B7 text");
  for (const mode of ["preview", "download"]) {
    const response = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state: { version: browserStateVersion, stage: snapshot.stage, case: current, unrepresented: [] } }) }));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "pdf-not-ready" });
  }
  expect(current).toEqual(before);
});
it("B7 base protection stays active without a qualifier", async () => {
  const current = setContextFact(testHistoryContextCase(), "event:event:relevantHistory", { kind: "known", value: "prior β marker noted" });
  const snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
  expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({ code: "unsupported-test-history", targets: ["event:event:relevantHistory"], entityIds: ["event"] }));
});
it("independently checks native B6/B7 boxes, font and capacity", async () => {
  const form = (await PDFDocument.load(await readFile("assets/fda/form-fda-3500-09-2025.pdf"), { password: "" })).getForm();
  const visualRows = Array.from({ length: 8 }, (_, index) => index + 1).map(number => ({ number, y: form.getTextField(`${table}.Row${number}[0].TestData${number}[0]`).acroField.getWidgets()[0].getRectangle().y })).sort((a, b) => b.y - a.y);
  expect(visualRows.map(row => row.number)).toEqual([1,2,3,4,8,5,6,7]);
  for (const [name, height] of [[comments,197.008],[history,201.838]] as const) {
    const field = form.getTextField(name), rect = field.acroField.getWidgets()[0].getRectangle();
    expect(rect.width).toBeCloseTo(528.001,3); expect(rect.height).toBeCloseTo(height,3); expect(field.getMaxLength()).toBe(2000); expect(field.acroField.getDefaultAppearance()).toContain("8.00 Tf");
  }
});

it("keeps unaccepted/conflicting test and history contexts out until explicit resolution chooses their exact values", async () => {
  const initial = testHistoryContextCase(), source = contextSource("lab-history-alternatives");
  const targets = [{ entity: "test" as const, entityId: "test-hemoglobin", field: "testResult" as const }, { entity: "event" as const, entityId: "event" as const, field: "relevantHistory" as const }];
  let current = applyCaseCommand(initial, { type: "attach-grounded-proposals", commandId: "lab-history-alternatives", expectedRevision: initial.revision, products: [], sources: [source], proposals: targets.flatMap((target, index) => ["A", "B"].map(branch => ({ proposalId: `lab-history-${index}-${branch}`, groupId: `lab-history-${index}`, intent: "alternative" as const, target, value: { kind: "known" as const, value: index === 0 ? `${branch === "A" ? "13.1" : "13.9"} µg/L` : `history account ${branch}`, qualifier: `pending ${index}-${branch} context` }, sourceIds: [source.id] }))) }).case;
  expect(projectForm3500(current).sections.B.relevantTestContext).not.toContain("pending 0-");
  expect(projectForm3500(current).sections.B.relevantHistory).not.toContain("pending 1-");
  current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "accept-lab-history-alternatives", expectedRevision: current.revision, decisions: [0,1].map(index => ({ groupId: `lab-history-${index}`, action: "accept" as const })) }).case;
  const conflicted = await inspect(current);
  expect(conflicted.fields[comments]).not.toContain("B6 table row 1 - Result and stated units context:");
  expect(conflicted.fields[history] ?? "").not.toContain("pending 1-");
  for (const [index,target] of targets.entries()) {
    const fact = index === 0 ? current.relevantTests[0].facts.testResult : current.event.facts.relevantHistory;
    const chosen = fact.conflictingValues.find(value => value.id.endsWith("-A"))!;
    current = applyCaseCommand(current, { type: "resolve-conflict", commandId: `resolve-lab-history-${index}`, expectedRevision: current.revision, target, chosenValueId: chosen.id, source: contextSource(`resolve-lab-history-${index}`) }).case;
  }
  const resolved = (await inspect(current)).fields;
  expect(resolved[comments]).toContain("B6 table row 1 - Result and stated units context: pending 0-A context");
  expect(resolved[comments]).not.toContain("pending 0-B context");
  expect(resolved[`${table}.Row1[0].TestData1[0]`]).toBe("Fictional assay: 13.1 µg/L");
  expect(resolved[history]).toBe("history account A\nHistory context: pending 1-A context");
  expect(current.relevantTests[0].facts.testResult.supersededValues.some(value => value.value.kind === "known" && value.value.qualifier === "pending 0-B context")).toBe(true);
});
