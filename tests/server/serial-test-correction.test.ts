import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { performJourneyAction } from "../../src/server/journey/service";
import { createAnthropicJourneyModel, type AnthropicRequester } from "../../src/server/model/anthropic-journey";
import { fillForm3500Projection } from "../../src/server/pdf/form-3500";
import { firstSerialTestId, secondSerialTestId, serialTestCase, serialCorrectionText, mixedSerialText, serialOutput } from "../fixtures/serial-test-correction";

async function setup(output = serialOutput()) {
  const baseline = await serialTestCase();
  parseBrowserJourneyState({ version: browserStateVersion, stage: "output", case: baseline, unrepresented: [] });
  const repository = new InMemoryCaseRepository({ initialCase: baseline });
  const requester = vi.fn<AnthropicRequester>(async () => ({ id: "constructed-serial-response", model: "deterministic-replay", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(output) }], usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null } }));
  const model = createAnthropicJourneyModel(requester);
  const act = (action: Parameters<typeof performJourneyAction>[2]) => performJourneyAction(repository, baseline.id, action, model);
  const load = async () => (await repository.load(baseline.id))!;
  return { baseline, repository, requester, act, load };
}

describe("serial correction through the production request/boundary/service path", () => {
  it("corrects only the selected observation after acceptance and independently reads faithful PDF rows", async () => {
    const { baseline, requester, act, load } = await setup();
    const pending = await act({ action: "submit-update", text: serialCorrectionText });
    const unaccepted = await load();
    expect(unaccepted.relevantTests.map(t => t.id)).toEqual([firstSerialTestId, secondSerialTestId]);
    expect(unaccepted.relevantTests[0]).toEqual(baseline.relevantTests[0]);
    expect(unaccepted.relevantTests[1].facts.testResult.resolvedValue).toEqual(baseline.relevantTests[1].facts.testResult.resolvedValue);
    const groupId = pending.review.attention.find(item => item.target === `test:${secondSerialTestId}:testResult`)!.groupId!;
    const accepted = await act({ action: "review-update-group", groupId, decision: "accept" });
    const current = await load();
    expect(current.relevantTests.map(t => t.id)).toEqual(baseline.relevantTests.map(t => t.id));
    expect(current.relevantTests[0]).toEqual(baseline.relevantTests[0]);
    const second = current.relevantTests[1];
    expect(second.facts.testResult.resolvedValue?.value).toEqual({ kind: "known", value: "9.6 g/dL" });
    expect(second.facts.testResult.supersededValues.map(v => v.value)).toContainEqual({ kind: "known", value: "9.4 g/dL" });
    for (const field of ["testName", "date", "lowRange", "highRange"] as const) expect(second.facts[field]).toEqual(baseline.relevantTests[1].facts[field]);
    expect(current.products).toEqual(baseline.products); expect(current.patient).toEqual(baseline.patient);
    expect(accepted.downloadReady).toBe(true); expect(requester).toHaveBeenCalledOnce();
    const directory = await mkdtemp(join(tmpdir(), "wilson105-pdf-")), path = join(directory, "corrected.pdf");
    const bytes = await fillForm3500Projection(new Uint8Array(await readFile("assets/fda/form-fda-3500-09-2025.pdf")), accepted.projection); await writeFile(path, bytes.output);
    const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["tools/pdf/independent_readback.py", path, "--named"]);
    const fields = JSON.parse(stdout).namedFields, prefix = "topmostSubform[0].Page3[0].TestDataTable[0]";
    expect(fields[`${prefix}.Row1[0].TestData1[0]`]).toBe("hemoglobin: 8.9 g/dL");
    expect(fields[`${prefix}.Row2[0].TestData2[0]`]).toBe("hemoglobin: 9.6 g/dL");
    expect(fields[`${prefix}.Row1[0].TDate1[0]`]).toBe("11-SEP-2026");
    expect(fields[`${prefix}.Row2[0].TDate2[0]`]).toBe("12-SEP-2026");
  });
  it.each(["invented", `${secondSerialTestId}-typo`])("cannot allocate a new observation from correction reference %s; no retry or accepted-case loss", async reference => {
    const { baseline, requester, act, load } = await setup(serialOutput(serialCorrectionText, reference));
    await expect(act({ action: "submit-update", text: serialCorrectionText })).rejects.toThrow();
    const after = await load();
    expect(after.relevantTests).toEqual(baseline.relevantTests);
    expect(after.products).toEqual(baseline.products); expect(requester).toHaveBeenCalledOnce();
  });
  it("still admits a genuinely new observation without a correction", async () => {
    const text = "A separate platelet count on 13 September 2026 was 120 x10^9/L.";
    const output = serialOutput(text, secondSerialTestId, true);
    output.proposals = output.proposals.filter(p => p.intent === "fact");
    const { baseline, act, load, requester } = await setup(output);
    const pending = await act({ action: "submit-update", text });
    const current = await load();
    expect(current.relevantTests.slice(0, 2)).toEqual(baseline.relevantTests);
    expect(current.relevantTests[2].state).toBe("proposed");
    expect(current.relevantTests[2].facts.testName.proposedValues[0].value).toEqual({ kind: "known", value: "platelet count" });
    expect(pending.unrepresented).toEqual([]); expect(requester).toHaveBeenCalledOnce();
  });
  it("keeps a genuine addition separate from a correction and preserves both until their own review", async () => {
    const { baseline, act, load } = await setup(serialOutput(mixedSerialText, secondSerialTestId, true));
    const pending = await act({ action: "submit-update", text: mixedSerialText });
    const current = await load();
    expect(current.relevantTests).toHaveLength(3);
    expect(current.relevantTests[0]).toEqual(baseline.relevantTests[0]);
    expect(current.relevantTests[1].facts.testResult.resolvedValue).toEqual(baseline.relevantTests[1].facts.testResult.resolvedValue);
    expect(current.relevantTests[2].state).toBe("proposed");
    expect(pending.review.attention.find(item => item.target === `test:${secondSerialTestId}:testResult`)!.groupId).not.toBe(current.relevantTests[2].proposalGroupId);
  });
});
