import { z } from "zod";
import {
  modelProposalOutputSchema,
  parseModelProposalEnvelope,
  type ModelBoundaryIdentityFactory,
} from "../../domain/case/model-boundary";
import { createAnthropicJourneyModel } from "./anthropic-journey";
import type { JourneyModel } from "./journey-model";

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
  const predetermined = process.env.WILSON_PREDETERMINED_MODEL_RESPONSES;
  if (!predetermined) return createAnthropicJourneyModel();

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
          promptRevision: "wilson-medication-completion-v1",
          schemaRevision: "wilson-grounded-proposals-v8",
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          estimatedCostUsd: 0,
        },
      };
    },
  };
}
