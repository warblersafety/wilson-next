import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { allFacts, getFact, targetFromKey, targetKey } from "../../src/domain/case/facts";
import { projectForm3500 } from "../../src/domain/case/projection";
import { createReviewView } from "../../src/domain/case/views";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { getJourneySnapshot } from "../../src/server/journey/service";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { assayContext, contextCase, contextSource, setContextFact, conflictedContextCase, pendingContextCase } from "../fixtures/reviewed-context";

const narrative = "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]";
async function fields(current: ReturnType<typeof contextCase>) {
  const before = structuredClone(current), projection = projectForm3500(current);
  const { output } = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  const dir = await mkdtemp(join(tmpdir(), "wilson115-context-")), file = join(dir, "context.pdf"); await writeFile(file, output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
  expect(current).toEqual(before); return JSON.parse(stdout).namedFields as Record<string, string>;
}
it("carries course context while disclosing other omitted text/date/number context without changing unrelated output", async () => {
  const plain = contextCase(); let current = plain;
  const targets = ["test:test-hemoglobin:testResult", "event:event:treatments", "event:event:outcome", "event:event:dischargeDate", "event:event:onsetDate", "patient:patient:ageYears"];
  for (const [i, target] of targets.entries()) {
    const value = getFact(current, targetFromKey(current, target)).resolvedValue!.value;
    if (value.kind !== "known") throw new Error("Expected known synthetic baseline");
    current = setContextFact(current, target, { ...value, qualifier: i === 0 ? assayContext : `Fictional context ${i}: attribution remains uncertain` });
  }
  const projection = projectForm3500(current);
  const carried = new Set(["event:event:treatments", "event:event:outcome", "event:event:dischargeDate"]);
  for (const target of targets) {
    const fact = getFact(current, targetFromKey(current, target));
    if (carried.has(target)) { expect(projection.omissions.some(omission => omission.target === target)).toBe(false); continue; }
    expect(projection.omissions).toContainEqual(expect.objectContaining({ target, reason: "qualifier-not-included", qualifier: fact.resolvedValue!.value.kind === "known" ? fact.resolvedValue!.value.qualifier : undefined, sourceIds: fact.resolvedValue!.sourceIds }));
  }
  const actual = await fields(current), before = await fields(plain);
  for (const key of Object.keys(before).filter(key => key !== narrative)) expect(actual[key]).toEqual(before[key]);
  for (const i of [1, 2, 3]) expect(actual[narrative]).toContain(`Fictional context ${i}: attribution remains uncertain`);
  expect(actual[narrative]).not.toContain(assayContext);
  expect(Object.values(await fields(current))).toContain("Fictional assay: 14.2");
});
it("does not falsely flag the four already carried qualifier shapes as omitted", async () => {
  let current = contextCase();
  for (const [target, value] of [["event:event:symptoms", ["rash"]], ["event:event:problemDescription", "reported package issue"], ["product:product-apixaban:dose", "5 mg"], ["product:product-apixaban:strength", "5 mg"]] as const) {
    current = setContextFact(current, target, { kind: "known", value: Array.isArray(value) ? [...value] : value, qualifier: "reported, uncertain" });
  }
  const projection = projectForm3500(current);
  expect(projection.omissions.filter(({ reason }) => reason === "qualifier-not-included")).toEqual([]);
  expect((await fields(current))[narrative]).toContain("Symptoms: rash (reported, uncertain).");
});
it.each(["unknown", "declined", "explicitly-absent", "inapplicable"] as const)("discloses %s narrative answers individually without inventing a B5 statement", async kind => {
  let current = contextCase();
  for (const field of ["treatments", "outcome", "dischargeDate"]) current = setContextFact(current, `event:event:${field}`, { kind });
  const projection = projectForm3500(current);
  for (const field of ["treatments", "outcome", "dischargeDate"] as const) {
    expect(projection.omissions).toContainEqual(expect.objectContaining({ target: `event:event:${field}`, reason: kind, sourceIds: current.event.facts[field].sourceIds }));
  }
  const text = (await fields(current))[narrative];
  expect(text).not.toMatch(/Treatment:|Outcome:|Discharged/); expect(text).toContain("Symptoms:");
});
it("keeps proposed/rejected context out of accepted omissions and PDF", async () => {
  const current = pendingContextCase();
  expect(projectForm3500(current).omissions.filter(({ reason }) => reason === "qualifier-not-included")).toEqual([]);
  expect(createReviewView(current).attention.some(({ kind }) => kind === "proposal")).toBe(true);
  const rejected = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "reject-context", expectedRevision: current.revision, decisions: [{ groupId: "outcome-context", action: "reject" }] }).case;
  expect(projectForm3500(rejected).omissions.filter(({ reason }) => reason === "qualifier-not-included")).toEqual([]);
  expect((await fields(rejected))[narrative]).not.toContain("partially improved");
});
it("discloses the whole conflicted narrative fact until explicit resolution, then only the chosen current qualifier", async () => {
  const current = conflictedContextCase(), fact = current.event.facts.outcome;
  expect(fact.state).toBe("conflicted");
  expect(projectForm3500(current).omissions).toContainEqual(expect.objectContaining({ target: "event:event:outcome", reason: "conflicted" }));
  expect((await fields(current))[narrative]).not.toContain("Outcome:");
  const chosen = fact.conflictingValues.find(v => v.value.kind === "known" && v.value.value === "partially improved")!;
  const resolved = applyCaseCommand(current, { type: "resolve-conflict", commandId: "resolve-context", expectedRevision: current.revision, target: { entity: "event", entityId: "event", field: "outcome" }, chosenValueId: chosen.id, source: contextSource("resolution") }).case;
  const omissions = projectForm3500(resolved).omissions.filter(({ target }) => target === "event:event:outcome");
  expect(omissions).toEqual([]);
  expect((await fields(resolved))[narrative]).toContain("Outcome: partially improved (chart A uncertain).");
  expect(resolved.event.facts.outcome.supersededValues.some(v => v.value.kind === "known" && v.value.qualifier === "chart B follow-up incomplete")).toBe(true);
});
it("qualifier-only changes/remove/re-add preserve base output key and superseded context, not a falsely new PDF", async () => {
  const plain = contextCase(), target = "test:test-hemoglobin:testResult";
  const qualified = setContextFact(plain, target, { kind: "known", value: "14.2", qualifier: assayContext });
  const removed = setContextFact(qualified, target, { kind: "known", value: "14.2" });
  const readded = setContextFact(removed, target, { kind: "known", value: "14.2", qualifier: "second explicit context" });
  const snapshots = await Promise.all([plain, qualified, removed, readded].map(current => getJourneySnapshot(new InMemoryCaseRepository({ initialCase: current }), current.id)));
  expect(new Set(snapshots.map(s => s.reportContentKey)).size).toBe(1);
  expect(projectForm3500(removed).omissions.some(({ reason }) => reason === "qualifier-not-included")).toBe(false);
  expect(projectForm3500(readded).omissions.filter(({ reason }) => reason === "qualifier-not-included")).toEqual([expect.objectContaining({ qualifier: "second explicit context" })]);
  expect(readded.relevantTests[0].facts.testResult.supersededValues.some(v => v.value.kind === "known" && v.value.qualifier === assayContext)).toBe(true);
  expect(readded.products).toEqual(plain.products); expect(readded.relevantTests[0].facts.date).toEqual(plain.relevantTests[0].facts.date);
});

it("covers every active known qualifier, including routing and medication prerequisites, exactly once or in supported text", async () => {
  let current = contextCase();
  for (const field of ["stopped", "doseReduced", "restarted"]) current = setContextFact(current, `product:product-apixaban:${field}`, { kind: "known", value: false });
  current = setContextFact(current, "event:event:relevantTestsAvailable", { kind: "known", value: true });
  for (const { target, fact } of allFacts(current)) {
    const value = fact.resolvedValue?.value;
    if (fact.state === "resolved" && value?.kind === "known") current = setContextFact(current, targetKey(target), { ...value, qualifier: "explicit context" });
  }
  const projection = projectForm3500(current), omissions = projection.omissions.filter(({ reason }) => reason === "qualifier-not-included");
  const carried = new Set(["event:event:symptoms", "event:event:problemDescription", "event:event:treatments", "event:event:outcome", "event:event:dischargeDate", ...projection.sections.D.suspectProducts.flatMap(p => [`product:${p.productId}:dose`, `product:${p.productId}:strength`])]);
  for (const { target, fact } of allFacts(current)) {
    const value = fact.resolvedValue?.value, key = targetKey(target);
    if (fact.state !== "resolved" || value?.kind !== "known" || !value.qualifier) continue;
    const matches = omissions.filter(o => o.target === key);
    if (carried.has(key)) expect(matches).toHaveLength(0);
    else expect(matches).toEqual([expect.objectContaining({ qualifier: "explicit context", sourceIds: fact.resolvedValue!.sourceIds })]);
  }
  for (const target of ["product:product-apixaban:stopped", "product:product-apixaban:doseReduced", "product:product-apixaban:restarted", "product:product-apixaban:role", "product:product-apixaban:productType", "event:event:relevantTestsAvailable"]) {
    expect(omissions).toContainEqual(expect.objectContaining({ target, baseValueIncluded: false }));
  }
  const named = await fields(current);
  expect(named["topmostSubform[0].Page4[0].Prod1[0].Prod1ReappearNA[0]"]).toBe("/1");
  expect(named["topmostSubform[0].Page4[0].Prod1[0].Prod1AbatedNA[0]"]).toBe("/1");
});
it("retains inactive entity context as history without presenting it as current omitted information", () => {
  let current = setContextFact(contextCase(), "product:product-lisinopril:role", { kind: "known", value: "concomitant", qualifier: "historical role context" });
  current = setContextFact(current, "test:test-hemoglobin:testResult", { kind: "known", value: "14.2", qualifier: assayContext });
  for (const [entity, entityId] of [["product", "product-lisinopril"], ["test", "test-hemoglobin"]] as const) {
    current = applyCaseCommand(current, { type: "withdraw-case-entity", commandId: `context-withdraw-${entity}`, expectedRevision: current.revision, target: { entity, entityId }, source: contextSource(`withdraw-${entity}`) }).case;
  }
  const projection = projectForm3500(current);
  expect(projection.omissions.filter(({ reason }) => reason === "qualifier-not-included")).toEqual([]);
  expect(current.products[2].facts.role.resolvedValue?.value).toEqual({ kind: "known", value: "concomitant", qualifier: "historical role context" });
  expect(current.relevantTests[0].facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "14.2", qualifier: assayContext });
});
