import { describe, expect, it, vi } from "vitest";
import { APIError } from "@anthropic-ai/sdk";
import type { ParsedModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import { correctionAccount, openingAccount } from "../../src/experiment/fixed-inputs";
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
import {
  parseFixedCorrectionResponse,
  parseFixedOpeningResponse,
} from "../../src/server/model/fixed-journey";
import { ModelCallFailure, type ModelTurn } from "../../src/server/model/journey-model";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { performJourneyAction } from "../../src/server/journey/service";

describe("Anthropic fixed-journey adapter", () => {
  it("uses the pinned structured-output request without sampling overrides, tools, or retries", async () => {
    let captured: AnthropicModelRequest | undefined;
    const requester = vi.fn<AnthropicRequester>(async (request) => {
      captured = request;
      return responseFor("opening");
    });
    const times = [1_000, 1_250];
    const result = await createAnthropicJourneyModel(requester, () => times.shift()!)
      .propose("opening", openingAccount);

    expect(requester).toHaveBeenCalledOnce();
    expect(captured).toMatchObject({
      model: ANTHROPIC_MODEL_ID,
      max_tokens: PROVIDER_MAX_OUTPUT_TOKENS,
      messages: [{ role: "user" }],
      output_config: { format: { type: "json_schema" } },
    });
    expect(captured).not.toHaveProperty("temperature");
    expect(captured).not.toHaveProperty("top_p");
    expect(captured).not.toHaveProperty("top_k");
    expect(captured).not.toHaveProperty("tools");
    expect(captured).not.toHaveProperty("thinking");
    expect(captured?.output_config.format).not.toHaveProperty("parse");
    expect(MODEL_MAX_RETRIES).toBe(0);
    expect(result.envelope).toEqual(parseFixedOpeningResponse(openingAccount));
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

  it("streams the request so the SDK accepts the provider's full output capacity", async () => {
    const finalMessage = vi.fn(async () => responseFor("opening"));
    const stream = vi.fn(() => ({ finalMessage }));
    const requester = createStreamingRequester({ messages: { stream } });
    const request = createAnthropicRequest("opening", openingAccount);

    await expect(requester(request)).resolves.toEqual(responseFor("opening"));
    expect(stream).toHaveBeenCalledWith(request);
    expect(finalMessage).toHaveBeenCalledOnce();
  });

  it("rejects malformed grounded output with a safe error before it reaches case commands", async () => {
    const response = responseFor("correction");
    const output = responseOutput(response);
    output.proposals[0].source.end = correctionAccount.length + 1;
    setResponseOutput(response, output);
    const model = createAnthropicJourneyModel(async () => response);

    const failure = await modelFailure(model.propose("correction", correctionAccount));
    expect(failure.message).toContain("Accepted case knowledge is unchanged");
    expect(failure.diagnostic).toMatchObject({
      phase: "domain-boundary",
      requestId: "message-correction",
      issues: [{ code: "custom", message: "Invalid source span source-naproxen-dose-correction" }],
    });
  });

  it("does not retry or expose provider detail after a failed request", async () => {
    const failed = vi.fn<AnthropicRequester>(async () => {
      throw new Error("provider detail containing request material");
    });
    const failure = await modelFailure(
      createAnthropicJourneyModel(failed).propose("opening", openingAccount),
    );
    expect(failure.message).not.toContain("provider detail");
    expect(failure.diagnostic).toEqual({ phase: "provider-request", errorName: "Error" });
    expect(failed).toHaveBeenCalledOnce();
  });

  it("retains safe provider status metadata without retaining the provider message", async () => {
    const providerError = APIError.generate(
      429,
      { error: { type: "rate_limit_error", message: "sensitive provider detail" } },
      undefined,
      new Headers({ "request-id": "request-test" }),
    );
    const failure = await modelFailure(createAnthropicJourneyModel(
      async () => { throw providerError; },
    ).propose("opening", openingAccount));

    expect(failure.diagnostic).toEqual({
      phase: "provider-request",
      providerStatus: 429,
      providerType: "rate_limit_error",
      requestId: "request-test",
      errorName: "RateLimitError",
    });
    expect(JSON.stringify(failure.diagnostic)).not.toContain("sensitive provider detail");
  });

  it("records a non-success provider stop separately from structured parsing", async () => {
    const refusal = responseFor("opening");
    refusal.stop_reason = "refusal";
    const failure = await modelFailure(
      createAnthropicJourneyModel(async () => refusal).propose("opening", openingAccount),
    );
    expect(failure.diagnostic).toMatchObject({
      phase: "provider-stop",
      requestId: "message-opening",
      stopReason: "refusal",
    });
  });

  it("distinguishes invalid JSON from a structured-schema failure", async () => {
    const invalidJson = responseFor("opening");
    invalidJson.content = [{ type: "text", text: "{" }];
    const jsonFailure = await modelFailure(
      createAnthropicJourneyModel(async () => invalidJson).propose("opening", openingAccount),
    );
    expect(jsonFailure.diagnostic).toMatchObject({
      phase: "structured-json",
      issues: [{ path: "content", code: "invalid_json" }],
    });

    const invalidSchema = responseFor("opening");
    const output = responseOutput(invalidSchema);
    (output.proposals[0] as { intent: string }).intent = "unsupported";
    setResponseOutput(invalidSchema, output);
    const schemaFailure = await modelFailure(
      createAnthropicJourneyModel(async () => invalidSchema).propose("opening", openingAccount),
    );
    expect(schemaFailure.diagnostic).toMatchObject({
      phase: "structured-schema",
      issues: [{ path: "proposals.0.intent", code: "invalid_value" }],
    });
  });

  it("records the response before parsing and stops if protected capture fails", async () => {
    const recorder = vi.fn(async () => ".wilson-model-samples/sample-1-opening-response.json");
    const result = await createAnthropicJourneyModel(
      async () => responseFor("opening"),
      Date.now,
      recorder,
    ).propose("opening", openingAccount);
    expect(recorder).toHaveBeenCalledOnce();
    expect(result.responseArtifact).toBe(".wilson-model-samples/sample-1-opening-response.json");

    const captureFailure = await modelFailure(createAnthropicJourneyModel(
      async () => responseFor("opening"),
      Date.now,
      async () => { throw new Error("disk detail"); },
    ).propose("opening", openingAccount));
    expect(captureFailure.diagnostic).toEqual({ phase: "response-capture", errorName: "Error" });
  });

  it("rejects inputs outside the approved fixed experiment without making a request", async () => {
    const requester = vi.fn<AnthropicRequester>();
    await expect(createAnthropicJourneyModel(requester).propose("opening", `${openingAccount} extra`))
      .rejects.toThrow("only the displayed fictional account");
    expect(requester).not.toHaveBeenCalled();
  });

  it("feeds real-adapter proposals through the ordinary service and command boundary", async () => {
    const repository = new InMemoryCaseRepository();
    const requester: AnthropicRequester = async () => responseFor("opening");
    const snapshot = await performJourneyAction(
      repository,
      "case-real-adapter-test",
      { action: "submit-opening", text: openingAccount, reportType: "adverse-event" },
      createAnthropicJourneyModel(requester),
    );

    expect(snapshot).toMatchObject({ stage: "understanding", revision: 2 });
    expect(snapshot.understanding.products.map(({ id }) => id)).toEqual([
      "product-apixaban",
      "product-naproxen",
      "product-lisinopril",
    ]);
  });
});

function responseFor(turn: ModelTurn): AnthropicModelResponse {
  const parsed = turn === "opening"
    ? parseFixedOpeningResponse(openingAccount)
    : parseFixedCorrectionResponse(correctionAccount);
  return {
    id: `message-${turn}`,
    model: ANTHROPIC_MODEL_ID,
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(toModelOutput(parsed)) }],
    usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 15,
      output_tokens: 30,
    },
  };
}

function toModelOutput(parsed: ParsedModelProposalEnvelope) {
  const sourceById = new Map(parsed.sources.map((source) => [source.id, source]));
  return {
    products: parsed.products,
    proposals: parsed.proposals.map((proposal) => {
      const source = sourceById.get(proposal.sourceIds[0])!;
      return {
        proposalId: proposal.proposalId,
        groupId: proposal.groupId,
        intent: proposal.intent,
        target: proposal.target,
        value: proposal.value,
        source: { start: source.start, end: source.end },
      };
    }),
  };
}

function responseOutput(response: AnthropicModelResponse): ReturnType<typeof toModelOutput> {
  const block = response.content[0] as { text: string };
  return JSON.parse(block.text) as ReturnType<typeof toModelOutput>;
}

function setResponseOutput(
  response: AnthropicModelResponse,
  output: ReturnType<typeof toModelOutput>,
): void {
  response.content = [{ type: "text", text: JSON.stringify(output) }];
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
