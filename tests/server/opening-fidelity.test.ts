import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { getJourneySnapshot, performJourneyAction, type JourneyAction } from "../../src/server/journey/service";
import { createAnthropicJourneyModel, type AnthropicRequester } from "../../src/server/model/anthropic-journey";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import protocol from "../../evidence/issue-94/live-protocol.json";
import tablets from "../../evidence/issue-94/retained-tablets-model.json";
import doseOnly from "../../evidence/issue-94/retained-dose-only-model.json";

function setup(output: unknown) {
  const repository = new InMemoryCaseRepository();
  const id = "case-11111111-1111-4111-8111-111111111194";
  const requester = vi.fn<AnthropicRequester>(async () => ({ id: "first-pass-replay", model: "deterministic-replay", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(output) }], usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null } }));
  const model = createAnthropicJourneyModel(requester);
  const act = (action: JourneyAction) => performJourneyAction(repository, id, action, model);
  const load = async () => (await repository.load(id))!;
  return { repository, id, requester, act, load };
}
const reporter: JourneyAction = { action: "answer-reporter", reportDate: "2026-09-23", reporter: { kind: "provided", firstName: "Casey", lastName: "Reed", email: "casey.reed@example.test", healthProfessional: true, occupation: "Physician", reportedTo: [], doNotDiscloseIdentity: true } };

describe("first-pass symptom/dose fidelity through explicit review and PDF", () => {
  it.each([[doseOnly, 0], [tablets, 1]] as const)("retains actual response %# without a retry and requires separate review before faithful PDF", async (output, index) => {
    const { act, load, requester } = setup(output);
    const spec = protocol.cases[index];
    let snapshot = await act({ action: "submit-opening", text: spec.text, reportType: "adverse-event" });
    expect(snapshot).toMatchObject({ stage: "understanding", downloadReady: false, unrepresented: [] });
    expect(snapshot.openingGroups).toHaveLength(3);
    const pending = await load();
    const product = pending.products[0];
    expect(pending.event.facts.symptoms.resolvedValue).toBeUndefined();
    expect(product.facts.dose.resolvedValue).toBeUndefined();
    await expect(act(reporter)).rejects.toThrow();
    snapshot = await act({ action: "review-opening-group", groupId: "event", corrections: [] });
    expect((await load()).products[0].facts.dose.resolvedValue).toBeUndefined();
    expect((await load()).event.facts.symptoms.resolvedValue?.value).toEqual({ kind: "known", value: [index ? "abdominal pain" : "rash"] });
    expect((await load()).event.facts.problemDescription.state).toBe("empty");
    for (const groupId of snapshot.openingGroups) snapshot = await act({ action: "review-opening-group", groupId, corrections: [] });
    const clinical = await load();
    expect(clinical.products[0].facts.dose.resolvedValue?.value).toEqual({ kind: "known", value: index ? "two tablets, a total dose of 500 mg" : "500 mg" });
    expect(clinical.products[0].facts.strength.resolvedValue?.value).toEqual(index ? { kind: "known", value: "250 mg" } : { kind: "unknown" });
    // Complete only missing fields with explicit fictional unknown answers.
    for (let n = 0; n < 10 && snapshot.clarification?.kind !== "reporter"; n++) {
      const q = snapshot.clarification;
      if (q?.kind === "serious-outcomes") snapshot = await act({ action: "answer-serious-outcomes", selected: [], disposition: "unknown" });
      else if (q?.kind === "clinical-context") snapshot = await act({ action: "answer-clinical-context", ...(q.askTests ? { test: { kind: "unknown" } as const } : {}), ...(q.askHistory ? { history: { kind: "unknown" } as const } : {}) });
      else if (q?.kind === "medication-history") snapshot = await act({ action: "answer-medication-history", productId: q.productId, answers: Object.fromEntries(q.targetIds.map(t => [t.split(":")[2], { kind: "unknown" }])) });
      else throw Error(`Unexpected question ${q?.kind}`);
    }
    expect(snapshot.downloadReady).toBe(false);
    expect(snapshot.clarification?.kind).toBe("reporter");
    snapshot = await act(reporter);
    expect(snapshot.downloadReady).toBe(true);
    expect(requester).toHaveBeenCalledOnce();
    const { output: pdf } = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), snapshot.projection);
    const directory = await mkdtemp(join(tmpdir(), "wilson-fidelity-"));
    const file = join(directory, "accepted.pdf"); await writeFile(file, pdf);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
    const fields = JSON.parse(stdout).namedFields;
    const narrative = Object.entries(fields).find(([key]) => key.includes("DescEvent"))?.[1];
    expect(narrative).toContain(`Symptoms: ${index ? "abdominal pain" : "rash"}.`);
    expect(narrative).not.toContain("Problem detail:");
    const prefix = "topmostSubform[0].Page4[0].Prod1[0].Prod1";
    expect(fields[`${prefix}Dose[0]`]).toBe(index ? "two tablets, a total dose of 500 mg" : "500");
    if (index) {
      expect(fields[`${prefix}Strength[0]`]).toBe("250");
      expect(fields[`${prefix}StrengthUnit[0]`]).toBe("25");
      expect(fields[`${prefix}DoseUnit[0]`]).toBe("40"); // FDA export value for blank unit.
    } else expect(fields[`${prefix}Strength[0]`]).toBeUndefined();
    if (process.env.WILSON_FIDELITY_EVIDENCE) {
      const base = join(process.env.WILSON_FIDELITY_EVIDENCE, spec.id + "-replay");
      await writeFile(base + ".pdf", pdf); await writeFile(base + "-readback.json", stdout);
      await writeFile(base + "-pending.json", JSON.stringify({ version: browserStateVersion, stage: "understanding", case: pending, unrepresented: [] }));
      await writeFile(base + "-accepted.json", JSON.stringify({ version: browserStateVersion, stage: snapshot.stage, case: await load(), unrepresented: [] }));
    }
  });

  it("rejects only the chosen symptom group and leaves medication pending", async () => {
    const { act, load } = setup(tablets);
    await act({ action: "submit-opening", text: protocol.cases[1].text, reportType: "adverse-event" });
    const snapshot = await act({ action: "reject-group", groupId: "event" });
    expect((await load()).event.facts.symptoms.resolvedValue).toBeUndefined();
    expect((await load()).event.facts.symptoms.proposedValues).toEqual([]);
    expect((await load()).products[0].facts.dose.proposedValues).toHaveLength(1);
    expect(snapshot.downloadReady).toBe(false);
  });

  it("leaves an accepted case intact on invalid later response without retry", async () => {
    const output = structuredClone(tablets);
    const { repository, id, act, load, requester } = setup(output);
    await act({ action: "submit-opening", text: protocol.cases[1].text, reportType: "adverse-event" });
    await act({ action: "accept-understanding" });
    const before = await load(); const snapshot = await getJourneySnapshot(repository, id);
    // Duplicate response identity is an actual envelope failure, distinct from
    // proposal-local quarantine. No accepted fact may change.
    output.proposals.push(output.proposals[0]);
    await expect(act({ action: "submit-update", text: "The previously supplied details remain correct." })).rejects.toThrow();
    expect(await load()).toEqual(before);
    expect(await getJourneySnapshot(repository, id)).toEqual(snapshot);
    expect(requester).toHaveBeenCalledTimes(2);
  });
});
