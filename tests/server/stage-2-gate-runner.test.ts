import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelCallFailure, type JourneyModel, type ModelProposalResult } from "../../src/server/model/journey-model";
import {
  cumulativeCost,
  executeStage2Gate,
  resumeInterruptedRichOpeningReview,
  STAGE_2_PER_CALL_RESERVE_USD,
  type HumanVerdict,
  type Stage2GateRecord,
} from "../../tools/model/run-stage-2-gate";
import { stage2Input, type Stage2CallSlot } from "../../tools/model/stage-2-inputs";

beforeEach(() => vi.spyOn(process.stdout, "write").mockImplementation(() => true));
afterEach(() => vi.restoreAllMocks());

describe("Experiment 2 Stage 2 runner", () => {
  it("leaves a semantic mismatch for human review and stops without another call after failure", async () => {
    let calls = 0;
    const model: JourneyModel = {
      async propose() {
        calls += 1;
        return openingPatientResult("WRONG-BUT-REPRESENTABLE");
      },
    };
    const records: Stage2GateRecord[] = [];

    const result = await executeStage2Gate(
      model,
      async (_slot, _attempt, proposedCase) => {
        expect(proposedCase.patient.facts.identifier.proposedValues[0].value)
          .toEqual({ kind: "known", value: "WRONG-BUT-REPRESENTABLE" });
        return { verdict: "fail", assessment: "Patient identifier is wrong." };
      },
      async (record) => { records.push(structuredClone(record)); },
      () => undefined,
      () => "case-00000000-0000-4000-8000-000000000001",
      async () => "verdict.json",
    );

    expect(calls).toBe(1);
    expect(result.record).toMatchObject({
      status: "stopped",
      stopReason: "rich-opening failed human semantic review.",
      attempts: [{ boundaryAccepted: true, humanVerdict: "fail", status: "failed" }],
    });
    expect(records.some(({ status }) => status === "awaiting-human-review")).toBe(true);
  });

  it("runs the exact three-call sequence and supplies reviewed opaque IDs to the update", async () => {
    const calls: Array<{ slot: Stage2CallSlot; context: unknown }> = [];
    let index = 0;
    const model: JourneyModel = {
      async propose(_turn, _text, context) {
        const slot = (["rich-opening", "repeated-opening", "repeated-update"] as const)[index++];
        calls.push({ slot, context });
        if (slot === "rich-opening") return openingPatientResult("TEST-68");
        if (slot === "repeated-opening") return repeatedOpeningResult();
        return repeatedUpdateResult("product-opaque-acetaminophen");
      },
    };
    const verdicts: HumanVerdict[] = [
      { verdict: "pass", assessment: "rich reviewed" },
      { verdict: "pass", assessment: "opening reviewed" },
      { verdict: "pass", assessment: "update reviewed" },
    ];

    const result = await executeStage2Gate(
      model,
      async () => verdicts.shift()!,
      async () => undefined,
      () => undefined,
      sequentialCaseId(),
      async () => "verdict.json",
    );

    expect(calls.map(({ slot }) => slot)).toEqual([
      "rich-opening",
      "repeated-opening",
      "repeated-update",
    ]);
    expect(calls[0].context).toBeUndefined();
    expect(calls[1].context).toBeUndefined();
    expect(calls[2].context).toMatchObject({
      products: [{ id: "product-opaque-acetaminophen", name: "acetaminophen" }],
    });
    expect(result.record.status).toBe("complete");
    expect(result.record.attempts).toHaveLength(3);
    expect(result.record.attempts.every(({ status, humanVerdict }) => status === "passed" && humanVerdict === "pass"))
      .toBe(true);
    expect(result.richCase?.patient.facts.identifier.proposedValues[0].value)
      .toEqual({ kind: "known", value: "TEST-68" });
    expect(result.richCase?.patient.facts.identifier.resolvedValue).toBeUndefined();
    expect(result.repeatedCase?.products[0].facts.startDate).toMatchObject({
      state: "resolved",
      resolvedValue: { value: { kind: "known", value: "2026-07-01" } },
      conflictingValues: [],
    });
  });

  it("records an interrupted first review and resumes with only the two unused calls", async () => {
    const retained = richOpeningAwaitingReviewRecord();
    const persisted: Stage2GateRecord[] = [];
    const verdicts: string[] = [];
    await resumeInterruptedRichOpeningReview(
      retained,
      async (slot) => {
        verdicts.push(slot);
        return { verdict: "pass", assessment: "Minor issues noted; continue bounded evidence collection." };
      },
      async (record) => { persisted.push(structuredClone(record)); },
      async () => "verdict.json",
    );

    const calledSlots: Stage2CallSlot[] = [];
    let index = 0;
    const model: JourneyModel = {
      async propose(_turn, _text, context) {
        const slot = (["repeated-opening", "repeated-update"] as const)[index++];
        calledSlots.push(slot);
        return slot === "repeated-opening"
          ? repeatedOpeningResult()
          : repeatedUpdateResult((context as { products: Array<{ id: string }> }).products[0].id);
      },
    };
    const result = await executeStage2Gate(
      model,
      async () => ({ verdict: "pass", assessment: "reviewed" }),
      async () => undefined,
      () => undefined,
      sequentialCaseId(),
      async () => "verdict.json",
      retained,
    );

    expect(verdicts).toEqual(["rich-opening"]);
    expect(persisted.at(-1)).toMatchObject({
      status: "running",
      attempts: [{ status: "passed", humanVerdict: "pass" }],
    });
    expect(calledSlots).toEqual(["repeated-opening", "repeated-update"]);
    expect(result.record.status).toBe("complete");
    expect(result.record.attempts).toHaveLength(3);
  });

  it("stops before a next call when its reservation would exceed USD 5", async () => {
    let calls = 0;
    const model: JourneyModel = {
      async propose() {
        calls += 1;
        const output = openingPatientResult("TEST-68");
        output.metrics!.estimatedCostUsd = 3.51;
        return output;
      },
    };

    const result = await executeStage2Gate(
      model,
      async () => ({ verdict: "pass", assessment: "reviewed" }),
      async () => undefined,
      () => undefined,
      () => "case-00000000-0000-4000-8000-000000000004",
      async () => "verdict.json",
    );

    expect(calls).toBe(1);
    expect(result.record).toMatchObject({
      status: "stopped",
      stopReason: "The USD 5 cap has insufficient reserved capacity for another call.",
    });
    expect(cumulativeCost(result.record)).toBe(3.51);
  });

  it("reserves USD 1.50 and stops on a provider failure without retrying", async () => {
    let calls = 0;
    const model: JourneyModel = {
      async propose() {
        calls += 1;
        throw new ModelCallFailure("failed", { phase: "provider-request", errorName: "APIConnectionError" });
      },
    };

    const result = await executeStage2Gate(
      model,
      async () => { throw new Error("review must not run"); },
      async () => undefined,
      () => undefined,
      sequentialCaseId(),
      async () => "verdict.json",
    );

    expect(calls).toBe(1);
    expect(cumulativeCost(result.record)).toBe(STAGE_2_PER_CALL_RESERVE_USD);
    expect(result.record).toMatchObject({
      status: "stopped",
      attempts: [{ status: "stopped", lastFailure: { phase: "provider-request" } }],
    });
  });

  it("stops before human review when the authoritative case boundary rejects the envelope", async () => {
    let calls = 0;
    let reviews = 0;
    const model: JourneyModel = {
      async propose() {
        calls += 1;
        const output = openingPatientResult("TEST-68");
        output.envelope.sources[0].start = -1;
        return output;
      },
    };

    const result = await executeStage2Gate(
      model,
      async () => {
        reviews += 1;
        return { verdict: "pass", assessment: "must not run" };
      },
      async () => undefined,
      () => undefined,
      sequentialCaseId(),
      async () => "verdict.json",
    );

    expect(calls).toBe(1);
    expect(reviews).toBe(0);
    expect(result.richCase).toBeNull();
    expect(result.repeatedCase).toBeNull();
    expect(result.record).toMatchObject({
      status: "stopped",
      stopReason: "rich-opening could not enter the authoritative case boundary.",
      attempts: [{
        status: "stopped",
        boundaryAccepted: false,
        humanVerdict: null,
        lastFailure: { phase: "case-replay", errorName: "Error" },
      }],
    });
  });
});

function openingPatientResult(identifier: string): ModelProposalResult {
  const text = stage2Input("rich-opening").text;
  const excerpt = "Patient TEST-68";
  return result({
    caseText: text,
    sources: [{ id: "source-rich", excerpt }],
    proposals: [{
      proposalId: "proposal-rich-patient",
      groupId: "patient",
      intent: "fact",
      target: { entity: "patient", entityId: "patient", field: "identifier" },
      value: { kind: "known", value: identifier },
      sourceIds: ["source-rich"],
    }],
  });
}

function repeatedOpeningResult(): ModelProposalResult {
  const text = stage2Input("repeated-opening").text;
  return result({
    caseText: text,
    products: [{ id: "product-opaque-acetaminophen", groupId: "group-acetaminophen" }],
    sources: [{ id: "source-acetaminophen", excerpt: "acetaminophen (Tylenol)" }],
    proposals: [
      productProposal("proposal-name", "name", { kind: "known", value: "acetaminophen" }),
      productProposal("proposal-role", "role", { kind: "known", value: "suspect" }),
      productProposal("proposal-date", "startDate", { kind: "known", value: "2026-07-01" }),
    ],
  });
}

function repeatedUpdateResult(productId: string): ModelProposalResult {
  const text = stage2Input("repeated-update").text;
  const excerpt = "acetaminophen began 02-Jul-2026 rather than 01-Jul-2026";
  return result({
    caseText: text,
    inputType: "correction",
    sources: [{ id: "source-update", excerpt }],
    proposals: [{
      proposalId: "proposal-update",
      groupId: "group-update",
      intent: "alternative",
      target: { entity: "product", entityId: productId, field: "startDate" },
      value: { kind: "known", value: "2026-07-02" },
      sourceIds: ["source-update"],
    }],
  });
}

function productProposal(
  proposalId: string,
  field: "name" | "role" | "startDate",
  value: { kind: "known"; value: string },
) {
  return {
    proposalId,
    groupId: "group-acetaminophen",
    intent: "fact" as const,
    target: { entity: "product" as const, entityId: "product-opaque-acetaminophen", field },
    value,
    sourceIds: ["source-acetaminophen"],
  };
}

function result(input: {
  caseText: string;
  inputType?: "narrative" | "correction";
  products?: ModelProposalResult["envelope"]["products"];
  sources: Array<{ id: string; excerpt: string }>;
  proposals: ModelProposalResult["envelope"]["proposals"];
}): ModelProposalResult {
  return {
    envelope: {
      products: input.products ?? [],
      sources: input.sources.map(({ id, excerpt }) => {
        const start = input.caseText.indexOf(excerpt);
        return {
          id,
          inputId: `input-${id}`,
          inputType: input.inputType ?? "narrative",
          excerpt,
          start,
          end: start + excerpt.length,
          actor: "clinician" as const,
          recordedAt: "2026-09-09T00:00:00.000Z",
        };
      }),
      proposals: input.proposals,
    },
    metrics: {
      model: "claude-sonnet-5",
      promptRevision: "test",
      schemaRevision: "test",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
      estimatedCostUsd: 0.01,
    },
  };
}

function sequentialCaseId(): () => string {
  let number = 1;
  return () => `case-00000000-0000-4000-8000-${String(number++).padStart(12, "0")}`;
}

function richOpeningAwaitingReviewRecord(): Stage2GateRecord {
  return {
    version: 1,
    status: "awaiting-human-review",
    stopReason: null,
    attempts: [{
      number: 1,
      slot: "rich-opening",
      turn: "opening",
      status: "awaiting-human-review",
      metrics: {
        model: "claude-sonnet-5",
        promptRevision: "test",
        schemaRevision: "test",
        inputTokens: 10,
        outputTokens: 10,
        latencyMs: 10,
        estimatedCostUsd: 0.02,
      },
      boundaryAccepted: true,
      humanVerdict: null,
      humanAssessment: null,
      responseArtifact: "sample-1-opening-response.json",
      lastFailure: null,
    }],
  };
}
