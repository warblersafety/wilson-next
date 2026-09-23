import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { allFacts } from "../../src/domain/case/facts";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { browserStateVersion } from "../../src/server/case/browser-state";
import { getJourneySnapshot, performJourneyAction, type JourneyAction } from "../../src/server/journey/service";
import { createAnthropicJourneyModel, type AnthropicRequester } from "../../src/server/model/anthropic-journey";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { groupingAcceptedCase, groupingUpdate, preservedGroupingOutput } from "../fixtures/grouping-failure";

function setup(output: unknown = preservedGroupingOutput) {
  const baseline = groupingAcceptedCase();
  const repository = new InMemoryCaseRepository({ initialCase: baseline });
  const requester = vi.fn<AnthropicRequester>(async () => ({ id: "preserved-response-replay", model: "deterministic-replay", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(output) }], usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null } }));
  const model = createAnthropicJourneyModel(requester);
  const act = (action: JourneyAction) => performJourneyAction(repository, baseline.id, action, model);
  const load = async () => (await repository.load(baseline.id))!;
  return { baseline, repository, requester, act, load };
}

const reporter: JourneyAction = { action: "answer-reporter", reportDate: "2026-09-23", reporter: { kind: "provided", firstName: "Casey", lastName: "Reed", email: "casey.reed@example.test", healthProfessional: true, occupation: "Physician", country: "UNITED STATES", reportedTo: [], doNotDiscloseIdentity: true } };

describe("preserved grouping failure through the production model boundary", () => {
  it("requires separate history, medication and test acceptance before reporter and PDF; preserves accepted facts", async () => {
    const { baseline, requester, act, load } = setup();
    let snapshot = await act({ action: "submit-update", text: groupingUpdate });
    expect(requester).toHaveBeenCalledOnce();
    expect(snapshot).toMatchObject({ stage: "review-update", downloadReady: false, unrepresented: [] });
    const pending = await load();
    for (const { target, fact } of allFacts(baseline)) {
      const after = allFacts(pending).find(item => JSON.stringify(item.target) === JSON.stringify(target))!.fact;
      expect(after.resolvedValue).toEqual(fact.resolvedValue);
      expect(after.supersededValues).toEqual(fact.supersededValues);
    }
    const medication = snapshot.understanding.products[0].facts.stopped.proposals[0].groupId;
    const history = snapshot.understanding.event.relevantHistory.proposals[0].groupId;
    expect(medication).not.toBe(history);
    const tests = snapshot.openingGroups;
    expect(tests).toHaveLength(2);
    await expect(act(reporter)).rejects.toThrow();
    await expect(act({ action: "review-opening-group", groupId: tests[0], corrections: [] })).rejects.toThrow();
    snapshot = await act({ action: "review-update-group", groupId: medication, decision: "accept" });
    expect(snapshot.understanding.products[0].facts.stopped.resolved).toEqual({ kind: "known", value: true });
    expect(snapshot.understanding.event.relevantHistory.resolved).toBeUndefined();
    expect(snapshot.understanding.event.relevantHistory.proposals).toHaveLength(1);
    expect(snapshot.downloadReady).toBe(false);
    snapshot = await act({ action: "review-update-group", groupId: history, decision: "accept" });
    expect(snapshot.stage).toBe("understanding");
    expect(snapshot.understanding.event.relevantHistory.resolved).toEqual({ kind: "explicitly-absent" });
    for (const groupId of tests) {
      expect(snapshot.downloadReady).toBe(false);
      snapshot = await act({ action: "review-opening-group", groupId, corrections: [] });
    }
    expect(snapshot.downloadReady).toBe(false); // Reporter remains required.
    snapshot = await act(reporter);
    expect(snapshot.downloadReady).toBe(true);
    expect(requester).toHaveBeenCalledOnce();
    const current = await load();
    expect(current.products[0].facts.dose).toEqual(baseline.products[0].facts.dose);
    expect(current.patient).toEqual(baseline.patient);
    const bytes = new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf"));
    const { output } = await fillForm3500Projection(bytes, snapshot.projection);
    const directory = await mkdtemp(join(tmpdir(), "wilson-grouping-"));
    const file = join(directory, "accepted.pdf");
    await writeFile(file, output);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", file, "--named"]);
    const fields = JSON.parse(stdout).namedFields;
    const testPrefix = "topmostSubform[0].Page3[0].TestDataTable[0]";
    for (const [row, value, date] of [[1, "8.9", "11"], [2, "9.4", "12"]]) {
      expect(fields[`${testPrefix}.Row${row}[0].TestData${row}[0]`]).toBe(`Hemoglobin: ${value} g/dL`);
      expect(fields[`${testPrefix}.Row${row}[0].TLowRange${row}[0]`]).toBe("12 g/dL");
      expect(fields[`${testPrefix}.Row${row}[0].THighRange${row}[0]`]).toBe("16 g/dL");
      expect(fields[`${testPrefix}.Row${row}[0].TDate${row}[0]`]).toBe(`${date}-SEP-2026`);
    }
    const productPrefix = "topmostSubform[0].Page4[0].Prod1[0].Prod1";
    expect(fields[`${productPrefix}TherapyStopDate[0]`]).toBe("11-SEP-2026");
    for (const suffix of ["AbatedYes", "ReappearNA"]) {
      expect(fields[`${productPrefix}${suffix}[0]`]).toBeTruthy();
      expect(fields[`${productPrefix}${suffix}[0]`]).not.toBe("/Off");
    }
    for (const suffix of ["AbatedNo", "ReappearYes", "ReappearNo"]) expect([undefined, "/Off"]).toContain(fields[`${productPrefix}${suffix}[0]`]);
    if (process.env.WILSON_GROUPING_EVIDENCE) {
      await writeFile(join(process.env.WILSON_GROUPING_EVIDENCE, "accepted.pdf"), output);
      await writeFile(join(process.env.WILSON_GROUPING_EVIDENCE, "pdf-readback.json"), stdout);
      await writeFile("/private/tmp/wilson109-pending-state.json", JSON.stringify({ version: browserStateVersion, stage: "review-update", case: pending, unrepresented: [] }));
      await writeFile("/private/tmp/wilson109-accepted-state.json", JSON.stringify({ version: browserStateVersion, stage: snapshot.stage, case: current, unrepresented: [] }));
    }
  });

  it("rejects history independently without accepting it or discarding medication proposals", async () => {
    const { act, baseline, requester } = setup();
    const pending = await act({ action: "submit-update", text: groupingUpdate });
    const history = pending.understanding.event.relevantHistory.proposals[0].groupId;
    const snapshot = await act({ action: "review-update-group", groupId: history, decision: "reject" });
    expect(snapshot.understanding.event.relevantHistory.proposals).toEqual([]);
    expect(snapshot.understanding.event.relevantHistory.resolved).toBeUndefined();
    expect(snapshot.understanding.products[0].facts.stopped.proposals).toHaveLength(1);
    expect(snapshot.downloadReady).toBe(false);
    expect(baseline.products[0].facts.stopped.resolvedValue).toBeUndefined();
    expect(requester).toHaveBeenCalledOnce();
  });

  it("retains the complete accepted case and stage on a genuinely invalid response, without retry", async () => {
    const output = structuredClone(preservedGroupingOutput);
    output.proposals[1].proposalReference = output.proposals[0].proposalReference;
    const { baseline, repository, act, load, requester } = setup(output);
    const before = await getJourneySnapshot(repository, baseline.id);
    await expect(act({ action: "submit-update", text: groupingUpdate })).rejects.toThrow();
    expect(await load()).toEqual(baseline);
    expect(await getJourneySnapshot(repository, baseline.id)).toEqual(before);
    expect(requester).toHaveBeenCalledOnce();
  });

  it("keeps accepted incompatible alternatives unresolved rather than choosing one while splitting groups", async () => {
    const first = preservedGroupingOutput.proposals[0];
    const { act, load } = setup({ products: [], proposals: [
      { ...first, intent: "alternative", value: { kind: "known", value: true, qualifier: "first record" } },
      { ...first, proposalReference: "opposite", intent: "alternative", value: { kind: "known", value: false, qualifier: "second record" } },
      preservedGroupingOutput.proposals[4],
    ] });
    const text = groupingUpdate.replace("Ibuprofen was stopped on September 11, 2026.", "One record says ibuprofen stopped while another says it continued.");
    const pending = await act({ action: "submit-update", text });
    const groupId = pending.understanding.products[0].facts.stopped.proposals[0].groupId;
    await act({ action: "review-update-group", groupId, decision: "accept" });
    const state = await load();
    expect(state.products[0].facts.stopped.state).toBe("conflicted");
    expect(state.products[0].facts.stopped.resolvedValue).toBeUndefined();
    expect(state.products[0].facts.stopped.conflictingValues.map(v => v.value)).toEqual([
      { kind: "known", value: true, qualifier: "first record" },
      { kind: "known", value: false, qualifier: "second record" },
    ]);
    expect(state.event.facts.relevantHistory.resolvedValue).toBeUndefined();
    expect(state.event.facts.relevantHistory.proposedValues).toHaveLength(1);
  });
});
