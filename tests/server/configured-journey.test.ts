import { describe, expect, it, vi } from "vitest";
import { selectJourneyModel } from "../../src/server/model/configured-journey";
import type { JourneyModel } from "../../src/server/model/journey-model";

const authorizedPreview = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "warblersafety",
  VERCEL_GIT_REPO_SLUG: "wilson-next",
  VERCEL_GIT_REPO_ID: "1357402525",
  VERCEL_GIT_COMMIT_REF: "codex/37-protected-preview-model-selection",
  VERCEL_GIT_PULL_REQUEST_ID: "69",
};

const liveModel: JourneyModel = {
  async propose() {
    throw new Error("The test must not make a live model proposal");
  },
};

describe("configured journey model selection", () => {
  it("selects the live adapter only for the exact Wilson GitHub pull-request preview", () => {
    const createLiveModel = vi.fn(() => liveModel);

    expect(selectJourneyModel(authorizedPreview, createLiveModel)).toBe(liveModel);
    expect(createLiveModel).toHaveBeenCalledOnce();
  });

  it.each([
    ["local development", { NODE_ENV: "development" }],
    ["CI", { CI: "true", GITHUB_ACTIONS: "true", NODE_ENV: "test" }],
    ["production", { ...authorizedPreview, VERCEL_ENV: "production" }],
    ["Vercel development", { ...authorizedPreview, VERCEL_ENV: "development" }],
    ["unknown classification", { ...authorizedPreview, VERCEL_ENV: "staging" }],
    ["missing classification", { ...authorizedPreview, VERCEL_ENV: undefined }],
    ["non-Git preview", { ...authorizedPreview, VERCEL_GIT_PROVIDER: undefined }],
    ["different provider", { ...authorizedPreview, VERCEL_GIT_PROVIDER: "gitlab" }],
    ["different owner", { ...authorizedPreview, VERCEL_GIT_REPO_OWNER: "someone-else" }],
    ["different repository", { ...authorizedPreview, VERCEL_GIT_REPO_SLUG: "other" }],
    ["different repository ID", { ...authorizedPreview, VERCEL_GIT_REPO_ID: "1" }],
    ["production branch", { ...authorizedPreview, VERCEL_GIT_COMMIT_REF: "main" }],
    ["branch without a pull request", { ...authorizedPreview, VERCEL_GIT_PULL_REQUEST_ID: "" }],
  ])("fails closed for %s", (_name, environment) => {
    const createLiveModel = vi.fn(() => liveModel);

    expect(() => selectJourneyModel(environment, createLiveModel))
      .toThrow("The live application model is not available in this environment");
    expect(createLiveModel).not.toHaveBeenCalled();
  });

  it("uses explicit predetermined responses before environment selection without constructing Anthropic", async () => {
    const createLiveModel = vi.fn(() => liveModel);
    const model = selectJourneyModel({
      ...authorizedPreview,
      VERCEL_ENV: "production",
      WILSON_PREDETERMINED_MODEL_RESPONSES: predeterminedResponses,
    }, createLiveModel);

    const result = await model.propose("opening", "Patient TEST-1 reported a rash.");

    expect(createLiveModel).not.toHaveBeenCalled();
    expect(result.metrics).toMatchObject({
      model: "predetermined-model-response",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    });
    expect(result.envelope.proposals[0]).toMatchObject({
      target: { entity: "patient", entityId: "patient", field: "identifier" },
      value: { kind: "known", value: "TEST-1" },
    });
  });
});

const predeterminedResponses = JSON.stringify([{
  identityScope: "environment-test",
  turn: "opening",
  output: {
    products: [],
    proposals: [{
      proposalReference: "patient-id",
      groupReference: "patient",
      intent: "fact",
      target: { entity: "patient", field: "identifier" },
      value: { kind: "known", value: "TEST-1" },
      evidenceQuote: "Patient TEST-1",
    }],
  },
}]);
