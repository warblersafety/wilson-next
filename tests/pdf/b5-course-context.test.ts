import { expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST as pdfPost } from "../../app/api/case/pdf/route";
import { projectForm3500 } from "../../src/domain/case/projection";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { courseContext, courseContextCase } from "../fixtures/b5-course-context";
import { setContextFact } from "../fixtures/reviewed-context";
const narrative = "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]";
const courseFields = ["treatments", "outcome", "dischargeDate"] as const;
async function inspect(current: ReturnType<typeof courseContextCase>) {
  const before = structuredClone(current), projection = projectForm3500(current);
  const { output } = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  const path = join(await mkdtemp(join(tmpdir(), "wilson115-course-")), "course.pdf"); await writeFile(path, output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
  expect(current).toEqual(before);
  if (process.env.WILSON_COURSE_EVIDENCE && courseFields.every(field => current.event.facts[field].resolvedValue?.value.kind === "known" && current.event.facts[field].resolvedValue?.value.qualifier === courseContext[field])) {
    await writeFile(join(process.env.WILSON_COURSE_EVIDENCE, "course.pdf"), output);
    await writeFile(join(process.env.WILSON_COURSE_EVIDENCE, "readback.json"), stdout);
    await writeFile(join(process.env.WILSON_COURSE_EVIDENCE, "projection.json"), JSON.stringify(projection, null, 2) + "\n");
  }
  return { fields: JSON.parse(stdout).namedFields as Record<string, string>, projection };
}
it("carries exact course qualifiers in their own B5 statements with supplied order, date and sources", async () => {
  const current = courseContextCase(), { fields, projection } = await inspect(current);
  expect(fields[narrative]).toContain(`Treatment: oral fluids reported first; second treatment reported later (${courseContext.treatments}).`);
  expect(fields[narrative]).toContain(`Outcome: improved but not back to baseline (${courseContext.outcome}).`);
  expect(fields[narrative]).toContain(`Discharged 21-Aug-2026 (${courseContext.dischargeDate}).`);
  const text = fields[narrative];
  expect(text.indexOf("oral fluids reported first")).toBeLessThan(text.indexOf("second treatment reported later"));
  expect(text.indexOf("Treatment:")).toBeLessThan(text.indexOf("Outcome:"));
  expect(text.indexOf("Outcome:")).toBeLessThan(text.indexOf("Discharged"));
  for (const field of courseFields) {
    expect(projection.omissions.some(omission => omission.target === `event:event:${field}`)).toBe(false);
    expect(projection.sourceTrace["sections.B.eventDescription"]).toEqual(expect.arrayContaining(current.event.facts[field].resolvedValue!.sourceIds));
  }
  let plain = current;
  for (const field of courseFields) {
    const value = plain.event.facts[field].resolvedValue!.value;
    if (value.kind !== "known") throw new Error("Expected known course fact");
    plain = setContextFact(plain, `event:event:${field}`, { kind: "known", value: value.value });
  }
  const before = (await inspect(plain)).fields;
  for (const key of Object.keys(before).filter(key => key !== narrative)) expect(fields[key]).toEqual(before[key]);
});
it("correction, removal, re-add and restored case use only current context and change actual output keys", async () => {
  const first = courseContextCase();
  const corrected = setContextFact(first, "event:event:outcome", { kind: "known", value: "improved but not back to baseline", qualifier: "later telephone account; exact timing unconfirmed" });
  const removed = setContextFact(corrected, "event:event:outcome", { kind: "known", value: "improved but not back to baseline" });
  const readded = setContextFact(removed, "event:event:outcome", { kind: "known", value: "improved but not back to baseline", qualifier: "clinician explicitly restores uncertainty" });
  const snapshots = await Promise.all([first, corrected, removed, readded].map(current => getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id)));
  expect(new Set(snapshots.map(snapshot => snapshot.reportContentKey)).size).toBe(4);
  const stored = parseBrowserJourneyState(JSON.parse(JSON.stringify({ version: browserStateVersion, stage: snapshots[3].stage, case: readded, unrepresented: [] })));
  const text = (await inspect(stored.case)).fields[narrative];
  expect(text).toContain("Outcome: improved but not back to baseline (clinician explicitly restores uncertainty).");
  expect(text).not.toContain(courseContext.outcome); expect(text).not.toContain("later telephone account");
  expect((await inspect(removed)).fields[narrative]).toContain("Outcome: improved but not back to baseline.");
  expect(readded.event.facts.outcome.supersededValues.some(value => value.value.kind === "known" && value.value.qualifier === courseContext.outcome)).toBe(true);
  expect(readded.products).toEqual(first.products); expect(readded.relevantTests).toEqual(first.relevantTests);
  expect(readded.event.facts.dischargeDate).toEqual(first.event.facts.dischargeDate);
});
it.each(["unknown", "declined", "explicitly-absent", "inapplicable"] as const)("keeps superseded course context out of a current %s answer", async kind => {
  let current = courseContextCase();
  for (const field of courseFields) current = setContextFact(current, `event:event:${field}`, { kind });
  const { fields, projection } = await inspect(current);
  expect(fields[narrative]).not.toMatch(/Treatment:|Outcome:|Discharged/);
  for (const field of courseFields) {
    expect(fields[narrative]).not.toContain(courseContext[field]);
    expect(projection.omissions).toContainEqual(expect.objectContaining({ target: `event:event:${field}`, reason: kind }));
    expect(current.event.facts[field].supersededValues.some(value => value.value.kind === "known" && value.value.qualifier === courseContext[field])).toBe(true);
  }
});
it.each(courseFields.flatMap(field => ["β uncertain", "W".repeat(4100)].map(qualifier => ({ field, qualifier }))))("retains unrepresentable $field context and blocks both PDF modes", async ({ field, qualifier }) => {
  let current = courseContextCase(); const value = current.event.facts[field].resolvedValue!.value;
  if (value.kind !== "known") throw new Error("Expected known course fact");
  current = setContextFact(current, `event:event:${field}`, { ...value, qualifier });
  const before = structuredClone(current), snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id);
  if (!qualifier.includes("β")) {
    expect(snapshot.outputIssues.some(issue => ["unsupported-test-history", "unsupported-event-narrative"].includes(issue.code))).toBe(false);
    const output = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection);
    expect(output.readback.pageCount).toBeGreaterThan(8);
    expect(current).toEqual(before);
    return;
  }
  expect(snapshot.downloadReady).toBe(false);
  expect(snapshot.projection.sections.B.eventDescription).toContain(qualifier);
  expect(snapshot.outputIssues).toContainEqual(expect.objectContaining({ code: "unsupported-event-narrative", targets: expect.arrayContaining([`event:event:${field}`]) }));
  for (const mode of ["preview", "download"]) {
    const response = await pdfPost(new NextRequest("http://wilson.test/api/case/pdf", { method: "POST", headers: { host: "wilson.test", origin: "http://wilson.test", "content-type": "application/json" }, body: JSON.stringify({ mode, state: { version: browserStateVersion, stage: snapshot.stage, case: current, unrepresented: [] } }) }));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "pdf-not-ready", error: expect.stringContaining("B5 event description") });
  }
  expect(current).toEqual(before);
});
