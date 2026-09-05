import { emptyEventFacts, emptyPatientFacts, freezeCase } from "./internal";
import type { SemanticCase } from "./types";

export function createSemanticCase(id: string): SemanticCase {
  if (!id.trim()) throw new Error("Case ID is required");

  return freezeCase({
    id,
    revision: 0,
    patient: { id: "patient", state: "proposed", facts: emptyPatientFacts() },
    event: { id: "event", state: "proposed", facts: emptyEventFacts() },
    products: [],
    askedNeeds: [],
    sources: [],
    changes: [],
  });
}
