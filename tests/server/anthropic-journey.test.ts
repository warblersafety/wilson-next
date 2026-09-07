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
    expect(captured?.system).toContain('emit only the canonical literal "suspect" or "concomitant"');
    expect(captured?.system).toContain('Map statements such as "I suspect ..." to "suspect"');
    expect(captured?.system).toContain("shortest exact, self-contained supporting substring");
    expect(captured?.system).toContain("identify both the subject and the claim");
    expect(captured?.system).toContain("connect the product name with the claimed property");
    expect(captured?.system).toContain("one shared clause may support multiple product proposals");
    const roleGuidanceSchema = findSchemaObject(
      captured?.output_config.format.schema,
      (candidate) => typeof candidate.description === "string"
        && candidate.description.includes('target.field is "role"'),
    );
    expect(roleGuidanceSchema).toMatchObject({
      type: "string",
      description: expect.stringContaining('value.value must be exactly "suspect" or "concomitant"'),
    });
    expect(roleGuidanceSchema).not.toHaveProperty("enum");
    expect(MODEL_MAX_RETRIES).toBe(0);
    expect(result.envelope).toEqual(parseFixedOpeningResponse(openingAccount));
    expect(result.diagnosticResponse).toEqual(responseFor("opening"));
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
    expect(failure.returnedResponse).toBe(response);
  });

  it("leaves the observed wrong-clause correction source available for operator review", async () => {
    const response = responseFor("correction");
    const output = responseOutput(response);
    const alternative = output.proposals.find(({ proposalId }) => proposalId === "apixaban-date-alternative")!;
    alternative.source.start = correctionAccount.lastIndexOf("12-Aug-2026");
    alternative.source.end = alternative.source.start + "12-Aug-2026".length;
    setResponseOutput(response, output);

    const result = await createAnthropicJourneyModel(async () => response)
      .propose("correction", correctionAccount);
    const source = result.envelope.sources.find(
      ({ id }) => id === "source-apixaban-date-alternative",
    );

    expect(source?.excerpt).toBe("12-Aug-2026");
    expect(result.envelope.proposals).toContainEqual(expect.objectContaining({
      proposalId: "apixaban-date-alternative",
      value: { kind: "known", value: "2026-08-13" },
      sourceIds: ["source-apixaban-date-alternative"],
    }));
  });

  it("accepts any nonempty in-bounds source span, including the observed trailing comma", async () => {
    const response = responseFor("opening");
    const output = responseOutput(response);
    setSourceToExactExcerpt(
      output,
      "event-treatment",
      openingAccount,
      "two units of packed red cells,",
    );
    setResponseOutput(response, output);

    const result = await createAnthropicJourneyModel(async () => response)
      .propose("opening", openingAccount);
    expect(result.metrics?.schemaRevision).toBe(MODEL_SCHEMA_REVISION);
    expect(result.envelope.sources.find(
      ({ id }) => id === "source-event-treatment",
    )?.excerpt).toBe("two units of packed red cells,");
  });

  it("leaves an incomplete semantic catalog available for operator assessment", async () => {
    const response = responseFor("opening");
    const output = responseOutput(response);
    output.proposals = output.proposals.filter(({ proposalId }) => proposalId !== "event-symptoms");
    setResponseOutput(response, output);

    const result = await createAnthropicJourneyModel(async () => response)
      .propose("opening", openingAccount);

    expect(result.envelope.proposals).not.toContainEqual(expect.objectContaining({
      proposalId: "event-symptoms",
    }));
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
    expect(failure.returnedResponse).toBe(refusal);
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

  it.each(["suspected", "primary", "causal"])(
    "rejects noncanonical product role %s at the local structured-schema boundary",
    async (role) => {
      const response = responseFor("opening");
      const output = responseOutput(response);
      const proposalIndex = output.proposals.findIndex(({ proposalId }) => proposalId === "apixaban-role");
      const proposal = output.proposals[proposalIndex];
      (proposal.value as { kind: "known"; value: unknown }).value = role;
      setResponseOutput(response, output);

      const failure = await modelFailure(
        createAnthropicJourneyModel(async () => response).propose("opening", openingAccount),
      );

      expect(failure.diagnostic).toMatchObject({
        phase: "structured-schema",
        requestId: "message-opening",
        issues: [{
          path: `proposals.${proposalIndex}.value.value`,
          code: "custom",
          message: "Role value must be the canonical literal suspect or concomitant",
        }],
      });
      expect(failure.returnedResponse).toBe(response);
    },
  );

  it.each([
    ["naproxen-dose-correction", "naproxen-dose-change", "naproxen-dose-correction"],
    ["apixaban-date-alternative", "apixaban-start-conflict", "apixaban-date-conflict"],
  ])(
    "rejects an unrecognized correction action group for %s",
    async (proposalId, groupId, expectedGroupId) => {
      const response = responseFor("correction");
      const output = responseOutput(response);
      const proposalIndex = output.proposals.findIndex((proposal) => proposal.proposalId === proposalId);
      output.proposals[proposalIndex].groupId = groupId;
      setResponseOutput(response, output);

      const failure = await modelFailure(
        createAnthropicJourneyModel(async () => response).propose("correction", correctionAccount),
      );

      expect(failure.diagnostic).toMatchObject({
        phase: "structured-schema",
        requestId: "message-correction",
        issues: [{
          path: `proposals.${proposalIndex}.groupId`,
          code: "invalid_correction_group",
          message: `Correction action requires group ${expectedGroupId}`,
        }],
      });
      expect(failure.returnedResponse).toBe(response);
    },
  );

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
    expect(captureFailure.returnedResponse).toMatchObject({ id: "message-opening" });
  });

  it("rejects inputs outside the approved fixed experiment without making a request", async () => {
    const requester = vi.fn<AnthropicRequester>();
    await expect(createAnthropicJourneyModel(requester).propose("opening", `${openingAccount} extra`))
      .rejects.toThrow("only the displayed fictional account");
    expect(requester).not.toHaveBeenCalled();
  });

  it("keeps a structurally valid semantic mismatch proposed through the ordinary command boundary", async () => {
    const repository = new InMemoryCaseRepository();
    const response = responseFor("opening");
    const output = responseOutput(response);
    const age = output.proposals.find(({ proposalId }) => proposalId === "patient-age")!;
    age.value = { kind: "known", value: 58 };
    setSourceToExactExcerpt(output, "patient-age", openingAccount, "woman");
    setResponseOutput(response, output);
    const requester: AnthropicRequester = async () => response;
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
    expect(snapshot.understanding.patient.ageYears).toMatchObject({
      state: "proposed",
      resolved: undefined,
      proposals: [{
        id: "patient-age",
        value: { kind: "known", value: 58 },
        evidence: ["woman"],
      }],
    });
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

function setSourceToExactExcerpt(
  output: ReturnType<typeof toModelOutput>,
  proposalId: string,
  input: string,
  excerpt: string,
): void {
  const proposal = output.proposals.find((candidate) => candidate.proposalId === proposalId)!;
  const containerStart = proposalId.startsWith("apixaban-")
    ? input.indexOf("apixaban 5 mg by mouth twice daily")
    : 0;
  proposal.source.start = input.indexOf(excerpt, containerStart);
  proposal.source.end = proposal.source.start + excerpt.length;
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

function findSchemaObject(
  value: unknown,
  predicate: (candidate: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  if (!Array.isArray(value) && predicate(value as Record<string, unknown>)) {
    return value as Record<string, unknown>;
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const match = findSchemaObject(child, predicate);
    if (match) return match;
  }
  return undefined;
}
