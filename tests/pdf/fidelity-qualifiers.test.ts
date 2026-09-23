import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import { parseModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import { createReviewView } from "../../src/domain/case/views";
import { projectForm3500 } from "../../src/domain/case/projection";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { medicationCase, medicationSource, setMedication } from "../fixtures/medication-case";
import protocol from "../../evidence/issue-94/live-protocol.json";
import count from "../../evidence/issue-94/count-without-total-model.json";
import ambiguous from "../../evidence/issue-94/ambiguous-dose-model.json";

function replay(output: unknown, id: string) {
  const text = protocol.cases.find(c => c.id === id)!.text;
  const envelope = parseModelProposalEnvelope({ turn: "opening", input: { id: "qualifier-source", type: "narrative", text, recordedAt: "2026-09-23T20:00:00.000Z" }, output }, (kind, ref) => `${kind}-${ref}`);
  let state = applyCaseCommand(createSemanticCase("case-qualifiers"), { type: "attach-grounded-proposals", commandId: "attach", expectedRevision: 0, ...envelope }).case;
  state = applyCaseCommand(state, { type: "review-proposal-groups", commandId: "review", expectedRevision: state.revision, decisions: [...new Set(envelope.proposals.map(p => p.groupId))].map(groupId => ({ groupId, action: "accept" })) }).case;
  return state;
}
async function independentFields(projection: ReturnType<typeof projectForm3500>) {
  const { output } = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), projection);
  const directory = await mkdtemp(join(tmpdir(), "wilson-qualifiers-")); const file = join(directory, "qualified.pdf"); await writeFile(file, output);
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
  return JSON.parse(stdout).namedFields;
}
const narrative = "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]";

it("preserves the retained symptom uncertainty and denied symptom through actual PDF without changing the accepted fact", async () => {
  const state = replay(count, "count-without-total"); const before = structuredClone(state);
  const projection = projectForm3500(state);
  const text = "Symptoms: prickly skin and no rash (patient is unsure whether the prickly feeling was a reaction to the medicine).";
  expect(projection.sections.B.eventDescription).toBe(text);
  expect(projection.sourceTrace["sections.B.eventDescription"]).toEqual(state.event.facts.symptoms.resolvedValue!.sourceIds);
  expect((await independentFields(projection))[narrative]).toBe(text);
  expect(state).toEqual(before);
});

it("keeps an uncertain product complaint qualified and genuine conflicting symptom proposals unresolved", async () => {
  const state = replay(ambiguous, "ambiguous-dose");
  expect(state.event.facts.symptoms.state).toBe("conflicted");
  expect(state.event.facts.symptoms.resolvedValue).toBeUndefined();
  const projection = projectForm3500(state);
  expect(projection.sections.B.eventDescription).toBe("Problem detail: packaging problem (possible, undescribed).");
  expect(createReviewView(state).attention).toContainEqual(expect.objectContaining({ target: "event:event:symptoms", kind: "conflict" }));
  expect(projection.omissions).toContainEqual(expect.objectContaining({ target: "event:event:symptoms", reason: "conflicted" }));
  expect((await independentFields(projection))[narrative]).toBe(projection.sections.B.eventDescription);
});

it.each(["explicitly-absent", "unknown", "unmentioned"] as const)("discloses a %s product complaint without inventing one in the actual B5 output", async (kind) => {
  let state = medicationCase();
  if (kind !== "unmentioned") state = applyCaseCommand(state, { type: "record-clinician-facts", commandId: "complaint-disposition", expectedRevision: state.revision,
    source: medicationSource(kind === "unknown" ? "I do not know whether there was a product defect." : "There was no product defect.", "complaint"),
    facts: [{ id: "complaint", target: { entity: "event", entityId: "event", field: "problemDescription" }, intent: "fact", value: { kind } }],
  }).case;
  const before = structuredClone(state);
  const projection = projectForm3500(state);
  expect(projection.omissions).toContainEqual({ concept: "product problem", target: "event:event:problemDescription", reason: kind === "unmentioned" ? "empty" : kind, sourceIds: state.event.facts.problemDescription.sourceIds });
  expect(projection.sections.B.eventDescription).toBe("Symptoms: rash.");
  expect((await independentFields(projection))[narrative]).toBe("Symptoms: rash.");
  expect(state).toEqual(before);
});

it("keeps a simple qualified quantity intact in the actual D6 text control", async () => {
  const state = setMedication(medicationCase(), "amoxicillin", { dose: { kind: "known", value: "500 mg", qualifier: "approximate" } });
  const fields = await independentFields(projectForm3500(state));
  expect(fields["topmostSubform[0].Page4[0].Prod1[0].Prod1Dose[0]"]).toBe("500 mg (approximate)");
  // The original FDA dropdown's blank option has export value 40.
  expect(fields["topmostSubform[0].Page4[0].Prod1[0].Prod1DoseUnit[0]"]).toBe("40");
});

it("retains dose/strength qualifiers in their own suspect-product PDF slots without arithmetic or cross-attribution", async () => {
  let state = setMedication(medicationCase(true), "amoxicillin", { dose: { kind: "known", value: "two capsules, 500 mg", qualifier: "reported; diary uncertain" }, strength: { kind: "known", value: "250 mg per capsule", qualifier: "label difficult to read" } });
  state = setMedication(state, "naproxen", { dose: { kind: "known", value: "half a tablet", qualifier: "approximately" }, strength: { kind: "unknown" } });
  const projection = projectForm3500(state);
  expect(projection.sections.D.suspectProducts[0].dose).toBe("two capsules, 500 mg (reported; diary uncertain)");
  expect(projection.sections.D.suspectProducts[1].dose).toBe("half a tablet (approximately)");
  expect(projection.sections.D.suspectProducts[1].strength).toBeUndefined();
  const fields = await independentFields(projection);
  for (const [n, page] of [[1, 4], [2, 5]]) {
    const prefix = `topmostSubform[0].Page${page}[0].Prod${n}[0].Prod${n}`;
    expect(fields[`${prefix}Dose[0]`]).toBe(projection.sections.D.suspectProducts[n - 1].dose);
  }
  expect(fields["topmostSubform[0].Page4[0].Prod1[0].Prod1Strength[0]"]).toBe("250 mg per capsule (label difficult to read)");
  // A subsequent explicit correction replaces the qualifier; it must not be
  // resurrected from a superseded assertion in a regenerated PDF.
  state = setMedication(state, "amoxicillin", { dose: { kind: "known", value: "one capsule, 250 mg" } });
  expect(projectForm3500(state).sections.D.suspectProducts[0].dose).toBe("one capsule, 250 mg");
  expect(state.products[0].facts.dose.supersededValues[0].value).toEqual({ kind: "known", value: "two capsules, 500 mg", qualifier: "reported; diary uncertain" });
});
