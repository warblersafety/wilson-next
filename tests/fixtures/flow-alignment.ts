import { createSemanticCase } from "../../src/domain/case/create";
import { InMemoryCaseRepository } from "../../src/server/case/repository";
import { browserStateVersion, type BrowserJourneyState } from "../../src/server/case/browser-state";
import { performJourneyAction } from "../../src/server/journey/service";
import { createAnthropicJourneyModel } from "../../src/server/model/anthropic-journey";
import { groupingAcceptedCase, groupingUpdate, preservedGroupingOutput } from "./grouping-failure";

/** Preserved output replay, with one unextracted outcome to reproduce the blocked
 * Reporter/Output state. This variant is synthetic, not the original raw case. */
export async function flowAlignmentState(): Promise<BrowserJourneyState> {
  const baseline = structuredClone(groupingAcceptedCase());
  baseline.event.facts.otherSerious = createSemanticCase("empty").event.facts.otherSerious;
  const repository = new InMemoryCaseRepository({ initialCase: baseline });
  const model = createAnthropicJourneyModel(async () => ({
    id: "flow-replay", model: "deterministic-replay", stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(preservedGroupingOutput) }],
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null },
  }));
  const snapshot = await performJourneyAction(repository, baseline.id, { action: "submit-update", text: groupingUpdate }, model);
  return { version: browserStateVersion, stage: snapshot.stage, case: (await repository.load(baseline.id))!, unrepresented: snapshot.unrepresented };
}
