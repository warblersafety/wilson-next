import { describe, expect, it, vi } from "vitest";
import type { ParsedModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import { correctionAccount, openingAccount } from "../../src/experiment/fixed-inputs";
import {
  ANTHROPIC_MODEL_ID,
  createAnthropicJourneyModel,
  MODEL_MAX_TOKENS,
  MODEL_MAX_RETRIES,
  MODEL_PROMPT_REVISION,
  MODEL_SCHEMA_REVISION,
  type AnthropicModelRequest,
  type AnthropicModelResponse,
  type AnthropicRequester,
} from "../../src/server/model/anthropic-journey";
import {
  parseFixedCorrectionResponse,
  parseFixedOpeningResponse,
} from "../../src/server/model/fixed-journey";
import type { ModelTurn } from "../../src/server/model/journey-model";
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
      max_tokens: MODEL_MAX_TOKENS,
      messages: [{ role: "user" }],
      output_config: { format: { type: "json_schema" } },
    });
    expect(captured).not.toHaveProperty("temperature");
    expect(captured).not.toHaveProperty("top_p");
    expect(captured).not.toHaveProperty("top_k");
    expect(captured).not.toHaveProperty("tools");
    expect(captured).not.toHaveProperty("thinking");
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

  it("rejects malformed grounded output with a safe error before it reaches case commands", async () => {
    const response = responseFor("correction");
    response.parsed_output!.proposals[0].source.end = correctionAccount.length + 1;
    const model = createAnthropicJourneyModel(async () => response);

    await expect(model.propose("correction", correctionAccount)).rejects.toThrow(
      "Accepted case knowledge is unchanged",
    );
  });

  it("does not retry or expose provider detail after a failed request or refusal", async () => {
    const failed = vi.fn<AnthropicRequester>(async () => {
      throw new Error("provider detail containing request material");
    });
    await expect(createAnthropicJourneyModel(failed).propose("opening", openingAccount))
      .rejects.toThrow("Accepted case knowledge is unchanged");
    expect(failed).toHaveBeenCalledOnce();

    const refusal = responseFor("opening");
    refusal.stop_reason = "refusal";
    refusal.parsed_output = null;
    await expect(createAnthropicJourneyModel(async () => refusal).propose("opening", openingAccount))
      .rejects.toThrow("Accepted case knowledge is unchanged");
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
    model: ANTHROPIC_MODEL_ID,
    stop_reason: "end_turn",
    parsed_output: toModelOutput(parsed),
    usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 15,
      output_tokens: 30,
    },
  };
}

function toModelOutput(parsed: ParsedModelProposalEnvelope): NonNullable<AnthropicModelResponse["parsed_output"]> {
  const sourceById = new Map(parsed.sources.map((source) => [source.id, source]));
  return {
    products: parsed.products as NonNullable<AnthropicModelResponse["parsed_output"]>["products"],
    proposals: parsed.proposals.map((proposal) => {
      const source = sourceById.get(proposal.sourceIds[0])!;
      return {
        proposalId: proposal.proposalId,
        groupId: proposal.groupId,
        intent: proposal.intent,
        target: proposal.target as NonNullable<AnthropicModelResponse["parsed_output"]>["proposals"][number]["target"],
        value: proposal.value as NonNullable<AnthropicModelResponse["parsed_output"]>["proposals"][number]["value"],
        source: { id: source.id, start: source.start, end: source.end },
      };
    }),
  };
}
