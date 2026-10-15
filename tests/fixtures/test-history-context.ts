import { applyCaseCommand } from "../../src/domain/case/commands";
import { contextCase, contextSource, setContextFact, assayContext } from "./reviewed-context";
export const labHistoryFields = ["testName", "testResult", "lowRange", "highRange", "date"] as const;
export const labHistoryContext = { testName: "name transcribed from paper report", testResult: assayContext, lowRange: "lower limit copied from same report", highRange: "upper limit copied from same report", date: "collection day reported; time not recorded" } as const;
export const historyWording = "Prior episodic wheeze; the clinician supplied no exact onset date.";
export const historyContext = "patient recalls this before the current episode; dates uncertain";
export function testHistoryContextCase() {
  let current = contextCase();
  current = setContextFact(current, "test:test-hemoglobin:testResult", { kind: "known", value: "14.2 µg/L" });
  const source = contextSource("second-lab", "A separate fictional assay result was 15.8 µg/L on 19 August2026, with stated reference limits4.0 and16.0.");
  const values = { testName: "Fictional assay", testResult: "15.8 µg/L", lowRange: "4.0", highRange: "16.0", date: "2026-08-19" };
  current = applyCaseCommand(current, { type: "attach-grounded-proposals", commandId: "second-lab", expectedRevision: current.revision, products: [], relevantTests: [{ id: "test-lab-second", groupId: "second-lab" }], sources: [source], proposals: labHistoryFields.map(field => ({ proposalId: `second-lab-${field}`, groupId: "second-lab", intent: "fact", target: { entity: "test", entityId: "test-lab-second", field }, value: { kind: "known", value: values[field] }, sourceIds: [source.id] })) }).case;
  current = applyCaseCommand(current, { type: "review-proposal-groups", commandId: "accept-second-lab", expectedRevision: current.revision, decisions: [{ groupId: "second-lab", action: "accept" }] }).case;
  for (const id of ["test-hemoglobin", "test-lab-second"]) for (const field of labHistoryFields) {
    const test = current.relevantTests.find(test => test.id === id)!, value = test.facts[field].resolvedValue!.value;
    if (value.kind !== "known") throw new Error("Expected known test fixture");
    current = setContextFact(current, `test:${id}:${field}`, { ...value, qualifier: id === "test-hemoglobin" ? labHistoryContext[field] : `second report: ${labHistoryContext[field]}` });
  }
  return setContextFact(current, "event:event:relevantHistory", { kind: "known", value: historyWording, qualifier: historyContext });
}
