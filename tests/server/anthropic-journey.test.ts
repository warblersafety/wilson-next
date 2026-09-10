import { APIError } from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import type { ModelBoundaryIdentityFactory, ModelProposalOutput } from "../../src/domain/case/model-boundary";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { performJourneyAction } from "../../src/server/journey/service";
import {
  ANTHROPIC_MODEL_ID,
  createAnthropicJourneyModel,
  createAnthropicRequest,
  createStreamingRequester,
  MODEL_MAX_RETRIES,
  MODEL_PROMPT_REVISION,
  MODEL_SCHEMA_REVISION,
  PROVIDER_MAX_OUTPUT_TOKENS,
  type AnthropicModelRequest,
  type AnthropicModelResponse,
  type AnthropicRequester,
} from "../../src/server/model/anthropic-journey";
import { ModelCallFailure, type ReviewedCaseModelContext } from "../../src/server/model/journey-model";

const openingText = "Patient SYN-1 reported rash after taking Product A 10 mg. I suspect Product A.";
const correctionText = "Correction: Product A dose was 5 mg, not 10 mg.";
const recordedAt = "2026-09-09T01:00:00.000Z";

const reviewedCase: ReviewedCaseModelContext = {
  patient: [{ field: "identifier", value: { kind: "known", value: "SYN-1" } }],
  event: [{ field: "symptoms", value: { kind: "known", value: ["rash"] } }],
  products: [{
    id: "product-a-opaque",
    name: "Product A",
    facts: [
      { field: "name", value: { kind: "known", value: "Product A" } },
      { field: "dose", value: { kind: "known", value: "10 mg" } },
    ],
  }],
  relevantTests: [],
};

const opaqueIds: Record<string, string> = {
  "product-product-a": "product-a-opaque",
  "group-product-a-group": "group-a-opaque",
};
const identities: ModelBoundaryIdentityFactory = (kind, reference) => (
  opaqueIds[`${kind}-${reference}`] ?? `${kind}-${reference}`
);

describe("Anthropic production model boundary", () => {
  it("builds a case-agnostic structured request with quotations rather than offsets", () => {
    const request = createAnthropicRequest("opening", openingText);
    const requestText = `${request.system}\n${request.messages[0].content}`;
    const schema = JSON.stringify(request.output_config.format.schema);

    expect(request).toMatchObject({
      model: ANTHROPIC_MODEL_ID,
      max_tokens: PROVIDER_MAX_OUTPUT_TOKENS,
      output_config: { format: { type: "json_schema" } },
    });
    expect(request).not.toHaveProperty("temperature");
    expect(request).not.toHaveProperty("tools");
    expect(requestText).toContain("response-local productReference");
    expect(requestText).toContain("Wilson—not you—assigns stable case identity");
    expect(requestText).toContain("evidenceQuote");
    expect(requestText).toContain("Completeness outranks brevity");
    expect(requestText).toContain("preserve explicitly stated descriptive detail");
    expect(requestText).not.toMatch(/apixaban|naproxen|lisinopril/i);
    expect(schema).toContain("evidenceQuote");
    expect(schema).toContain("Completeness outranks brevity");
    expect(schema).toContain("Preserve explicitly stated descriptive detail");
    expect(schema).toContain("productReference");
    expect(schema).not.toContain('"start"');
    expect(schema).not.toContain('"end"');
    expect(MODEL_MAX_RETRIES).toBe(0);
  });

  it("accepts arbitrary nonempty synthetic input without a fixture catalog", async () => {
    const requester = vi.fn<AnthropicRequester>(async () => response(openingOutput(), "opening"));
    const times = [1_000, 1_250];
    const result = await createAnthropicJourneyModel(
      requester,
      () => times.shift()!,
      undefined,
      identities,
      () => recordedAt,
    ).propose("opening", openingText);

    expect(requester).toHaveBeenCalledOnce();
    expect(result.envelope.products).toEqual([{ id: "product-a-opaque", groupId: "group-a-opaque" }]);
    expect(result.envelope.proposals).toContainEqual(expect.objectContaining({
      target: { entity: "product", entityId: "product-a-opaque", field: "dose" },
      value: { kind: "known", value: "10 mg" },
    }));
    expect(result.metrics).toEqual({
      model: ANTHROPIC_MODEL_ID,
      promptRevision: MODEL_PROMPT_REVISION,
      schemaRevision: MODEL_SCHEMA_REVISION,
      inputTokens: 125,
      outputTokens: 30,
      latencyMs: 250,
      estimatedCostUsd: 0.00055,
    });
  });

  it("supplies generic reviewed-case context and stable product IDs for later input", async () => {
    const request = createAnthropicRequest("correction", correctionText, reviewedCase);
    const content = request.messages[0].content;
    expect(content).toContain("Reviewed case context (not clinician evidence; never quote it)");
    expect(content).toContain('"id":"product-a-opaque"');
    expect(content).toContain('"field":"dose"');
    expect(content).toContain('"value":"10 mg"');
    expect(content).toContain("Declare no products");

    const result = await createAnthropicJourneyModel(
      async () => response(correctionOutput(), "correction"),
      Date.now,
      undefined,
      identities,
      () => recordedAt,
    ).propose("correction", correctionText, reviewedCase);
    expect(result.envelope.products).toEqual([]);
    expect(result.envelope.proposals[0].target).toEqual({
      entity: "product",
      entityId: "product-a-opaque",
      field: "dose",
    });
  });

  it("requires reviewed context for later input before making a request", async () => {
    const requester = vi.fn<AnthropicRequester>();
    await expect(createAnthropicJourneyModel(requester).propose("correction", correctionText))
      .rejects.toThrow("Reviewed case context is required");
    expect(requester).not.toHaveBeenCalled();
  });

  it("rejects absent and ambiguous quotations at the domain boundary", async () => {
    const absent = openingOutput();
    absent.proposals[0].evidenceQuote = "not present";
    const absentFailure = await modelFailure(createAnthropicJourneyModel(
      async () => response(absent, "opening"),
      Date.now,
      undefined,
      identities,
      () => recordedAt,
    ).propose("opening", openingText));
    expect(absentFailure.diagnostic).toMatchObject({
      phase: "domain-boundary",
      issues: [{ path: "proposals.0.evidenceQuote", message: expect.stringContaining("absent") }],
    });

    const ambiguousText = "rash improved, then rash returned";
    const ambiguous = openingOutput();
    ambiguous.products = [];
    ambiguous.proposals = [eventProposal("symptoms", ["rash"], "rash")];
    const ambiguousFailure = await modelFailure(createAnthropicJourneyModel(
      async () => response(ambiguous, "opening"),
      Date.now,
      undefined,
      identities,
      () => recordedAt,
    ).propose("opening", ambiguousText));
    expect(ambiguousFailure.diagnostic).toMatchObject({
      phase: "domain-boundary",
      issues: [{ message: expect.stringContaining("more than once") }],
    });
  });

  it("rejects unknown later product references and later product declarations", async () => {
    const unknown = correctionOutput();
    unknown.proposals[0].target = { entity: "product", productReference: "Product A", field: "dose" };
    const unknownFailure = await modelFailure(createAnthropicJourneyModel(
      async () => response(unknown, "correction"), Date.now, undefined, identities, () => recordedAt,
    ).propose("correction", correctionText, reviewedCase));
    expect(unknownFailure.diagnostic.issues?.[0].message).toContain("Unknown reviewed product ID");

    const declared = correctionOutput();
    declared.products = [{ productReference: "new-product", groupReference: "new-group" }];
    const declarationFailure = await modelFailure(createAnthropicJourneyModel(
      async () => response(declared, "correction"), Date.now, undefined, identities, () => recordedAt,
    ).propose("correction", correctionText, reviewedCase));
    expect(declarationFailure.diagnostic.issues?.[0].message).toContain("cannot declare new entities");
  });

  it("rejects a noncanonical product role without a medicine-specific rule", async () => {
    const output = openingOutput();
    const role = output.proposals.find(({ target }) => target.entity === "product" && target.field === "role")!;
    role.value = { kind: "known", value: "causal" };
    const failure = await modelFailure(createAnthropicJourneyModel(
      async () => response(output, "opening"), Date.now, undefined, identities, () => recordedAt,
    ).propose("opening", openingText));
    expect(failure.diagnostic).toMatchObject({
      phase: "domain-boundary",
      issues: [{ message: "role requires suspect or concomitant" }],
    });
  });

  it("distinguishes provider, stop, JSON, and structured-schema failures without retrying", async () => {
    const failed = vi.fn<AnthropicRequester>(async () => { throw new Error("provider detail"); });
    const providerFailure = await modelFailure(createAnthropicJourneyModel(failed).propose("opening", openingText));
    expect(providerFailure.diagnostic).toEqual({ phase: "provider-request", errorName: "Error" });
    expect(failed).toHaveBeenCalledOnce();

    const stopped = response(openingOutput(), "opening");
    stopped.stop_reason = "refusal";
    expect((await modelFailure(createAnthropicJourneyModel(async () => stopped).propose("opening", openingText))).diagnostic)
      .toMatchObject({ phase: "provider-stop", stopReason: "refusal" });

    const invalidJson = response(openingOutput(), "opening");
    invalidJson.content = [{ type: "text", text: "{" }];
    expect((await modelFailure(createAnthropicJourneyModel(async () => invalidJson).propose("opening", openingText))).diagnostic)
      .toMatchObject({ phase: "structured-json", issues: [{ code: "invalid_json" }] });

    const invalidSchema = response(openingOutput(), "opening");
    const decoded = responseOutput(invalidSchema);
    (decoded.proposals[0] as { intent: string }).intent = "unsupported";
    setResponseOutput(invalidSchema, decoded);
    expect((await modelFailure(createAnthropicJourneyModel(async () => invalidSchema).propose("opening", openingText))).diagnostic)
      .toMatchObject({ phase: "structured-schema", issues: [{ path: "proposals.0.intent" }] });
  });

  it("retains safe provider status metadata without provider detail", async () => {
    const providerError = APIError.generate(
      429,
      { error: { type: "rate_limit_error", message: "sensitive provider detail" } },
      undefined,
      new Headers({ "request-id": "request-test" }),
    );
    const failure = await modelFailure(createAnthropicJourneyModel(
      async () => { throw providerError; },
    ).propose("opening", openingText));
    expect(failure.diagnostic).toEqual({
      phase: "provider-request",
      providerStatus: 429,
      providerType: "rate_limit_error",
      requestId: "request-test",
      errorName: "RateLimitError",
    });
    expect(JSON.stringify(failure.diagnostic)).not.toContain("sensitive provider detail");
  });

  it("records returned responses before parsing and stops if capture fails", async () => {
    const recorder = vi.fn(async () => ".wilson-model-samples/sample-opening-response.json");
    const result = await createAnthropicJourneyModel(
      async () => response(openingOutput(), "opening"), Date.now, recorder, identities, () => recordedAt,
    ).propose("opening", openingText);
    expect(recorder).toHaveBeenCalledOnce();
    expect(result.responseArtifact).toContain("sample-opening-response.json");

    const captureFailure = await modelFailure(createAnthropicJourneyModel(
      async () => response(openingOutput(), "opening"),
      Date.now,
      async () => { throw new Error("disk detail"); },
    ).propose("opening", openingText));
    expect(captureFailure.diagnostic).toEqual({ phase: "response-capture", errorName: "Error" });
  });

  it("streams the request so the SDK accepts the full provider output capacity", async () => {
    const finalMessage = vi.fn(async () => response(openingOutput(), "opening"));
    const stream = vi.fn(() => ({ finalMessage }));
    const requester = createStreamingRequester({ messages: { stream } });
    const request = createAnthropicRequest("opening", openingText);
    await expect(requester(request)).resolves.toEqual(response(openingOutput(), "opening"));
    expect(stream).toHaveBeenCalledWith(request);
    expect(finalMessage).toHaveBeenCalledOnce();
  });

  it("keeps a structurally valid unexpected value proposed through the write boundary", async () => {
    const output = openingOutput();
    output.proposals.find(({ target }) => target.entity === "patient")!.value = { kind: "known", value: "UNEXPECTED" };
    const model = createAnthropicJourneyModel(
      async () => response(output, "opening"), Date.now, undefined, identities, () => recordedAt,
    );
    const snapshot = await performJourneyAction(
      new InMemoryCaseRepository(),
      "case-generic-boundary",
      { action: "submit-opening", text: openingText, reportType: "adverse-event" },
      model,
    );
    expect(snapshot).toMatchObject({ stage: "understanding", revision: 2 });
    expect(snapshot.understanding.patient.identifier.proposals[0]).toMatchObject({
      value: { kind: "known", value: "UNEXPECTED" },
      evidence: ["SYN-1"],
    });
  });
});

function openingOutput(): ModelProposalOutput {
  return {
    products: [{ productReference: "product-a", groupReference: "product-a-group" }],
    proposals: [
      {
        proposalReference: "patient-id",
        groupReference: "patient-group",
        intent: "fact",
        target: { entity: "patient", field: "identifier" },
        value: { kind: "known", value: "SYN-1" },
        evidenceQuote: "SYN-1",
      },
      eventProposal("symptoms", ["rash"], "reported rash"),
      productProposal("name", "Product A", "taking Product A"),
      productProposal("dose", "10 mg", "Product A 10 mg"),
      productProposal("role", "suspect", "I suspect Product A"),
    ],
  };
}

function correctionOutput(): ModelProposalOutput {
  return {
    products: [],
    proposals: [{
      proposalReference: "dose-correction",
      groupReference: "dose-correction-group",
      intent: "correction",
      target: { entity: "product", productReference: "product-a-opaque", field: "dose" },
      value: { kind: "known", value: "5 mg" },
      evidenceQuote: "Product A dose was 5 mg, not 10 mg",
    }],
  };
}

function eventProposal(field: "symptoms", value: string[], evidenceQuote: string) {
  return {
    proposalReference: `event-${field}`,
    groupReference: "event-group",
    intent: "fact" as const,
    target: { entity: "event" as const, field },
    value: { kind: "known" as const, value },
    evidenceQuote,
  };
}

function productProposal(
  field: "name" | "dose" | "role",
  value: string,
  evidenceQuote: string,
) {
  return {
    proposalReference: `product-${field}`,
    groupReference: "product-a-group",
    intent: "fact" as const,
    target: { entity: "product" as const, productReference: "product-a", field },
    value: { kind: "known" as const, value },
    evidenceQuote,
  };
}

function response(output: ModelProposalOutput, turn: "opening" | "correction"): AnthropicModelResponse {
  return {
    id: `message-${turn}`,
    model: ANTHROPIC_MODEL_ID,
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(output) }],
    usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 15,
      output_tokens: 30,
    },
  };
}

function responseOutput(value: AnthropicModelResponse): ModelProposalOutput {
  return JSON.parse((value.content[0] as { text: string }).text) as ModelProposalOutput;
}

function setResponseOutput(value: AnthropicModelResponse, output: ModelProposalOutput): void {
  value.content = [{ type: "text", text: JSON.stringify(output) }];
}

async function modelFailure(promise: Promise<unknown>): Promise<ModelCallFailure> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ModelCallFailure);
    return error as ModelCallFailure;
  }
  throw new Error("Expected a ModelCallFailure");
}
