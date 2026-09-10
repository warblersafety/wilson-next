import { z } from "zod";
import {
  modelProposalOutputSchema,
  parseModelProposalEnvelope,
  type ModelBoundaryIdentityFactory,
} from "../../domain/case/model-boundary";
import { createAnthropicJourneyModel } from "./anthropic-journey";
import type { JourneyModel } from "./journey-model";

const AUTHORIZED_GIT_PREVIEW = {
  provider: "github",
  owner: "warblersafety",
  repository: "wilson-next",
  repositoryId: "1357402525",
} as const;

type ModelEnvironment = Readonly<Record<string, string | undefined>>;
type LiveModelFactory = () => JourneyModel;

const responseSchema = z.object({
  identityScope: z.string().regex(/^[a-z0-9-]+$/),
  turn: z.enum(["opening", "correction"]),
  output: modelProposalOutputSchema,
}).strict();

let configuredModel: Promise<JourneyModel> | undefined;

export function journeyModelForEnvironment(): Promise<JourneyModel> {
  configuredModel ??= createConfiguredModel();
  return configuredModel;
}

async function createConfiguredModel(): Promise<JourneyModel> {
  return selectJourneyModel(process.env);
}

export function selectJourneyModel(
  environment: ModelEnvironment,
  createLiveModel: LiveModelFactory = createAnthropicJourneyModel,
): JourneyModel {
  const predetermined = environment.WILSON_PREDETERMINED_MODEL_RESPONSES;
  if (predetermined) return predeterminedJourneyModel(predetermined);

  if (!isAuthorizedGitPreview(environment)) {
    throw new Error("The live application model is not available in this environment");
  }

  return createLiveModel();
}

function isAuthorizedGitPreview(environment: ModelEnvironment): boolean {
  return environment.VERCEL_ENV === "preview"
    && environment.VERCEL_GIT_PROVIDER === AUTHORIZED_GIT_PREVIEW.provider
    && environment.VERCEL_GIT_REPO_OWNER === AUTHORIZED_GIT_PREVIEW.owner
    && environment.VERCEL_GIT_REPO_SLUG === AUTHORIZED_GIT_PREVIEW.repository
    && environment.VERCEL_GIT_REPO_ID === AUTHORIZED_GIT_PREVIEW.repositoryId
    && environment.VERCEL_GIT_COMMIT_REF !== undefined
    && environment.VERCEL_GIT_COMMIT_REF !== "main"
    && /^[1-9]\d*$/.test(environment.VERCEL_GIT_PULL_REQUEST_ID ?? "");
}

function predeterminedJourneyModel(predetermined: string): JourneyModel {
  const decoded = JSON.parse(predetermined);
  const responses = z.array(responseSchema).min(1).parse(decoded);
  let next = 0;
  return {
    async propose(turn, text, reviewedCase) {
      const fixture = responses[next];
      if (!fixture) throw new Error("The predetermined model response queue is exhausted");
      if (fixture.turn !== turn) throw new Error(`Expected predetermined ${fixture.turn} response, received ${turn}`);
      const call = next++;
      const createIdentity: ModelBoundaryIdentityFactory = (kind, reference) => {
        if (kind === "product") return `product-${fixture.identityScope}-${reference}`;
        if (kind === "group") return `group-${fixture.identityScope}-${reference}`;
        return `${kind}-${fixture.identityScope}-${reference}`;
      };
      return {
        envelope: parseModelProposalEnvelope({
          turn,
          input: {
            id: `input-${call}`,
            type: turn === "opening" ? "narrative" : "correction",
            text,
            recordedAt: "2026-09-09T20:00:00.000Z",
          },
          existingProductIds: reviewedCase?.products.map(({ id }) => id),
          existingTestIds: reviewedCase?.relevantTests.map(({ id }) => id),
          output: fixture.output,
        }, createIdentity),
        metrics: {
          model: "predetermined-model-response",
          promptRevision: "wilson-layer3-device-depth-v1",
          schemaRevision: "wilson-grounded-proposals-v10",
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          estimatedCostUsd: 0,
        },
      };
    },
  };
}
