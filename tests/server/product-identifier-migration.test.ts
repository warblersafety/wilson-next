import { removeBirthDateFields } from "../fixtures/pre-dob";
import { expect, it } from "vitest";
import { applyCaseCommand } from "../../src/domain/case/commands";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { productCapacityCase } from "../fixtures/product-capacity";
import { contextSource } from "../fixtures/reviewed-context";

it.each(["resolved", "pending", "conflicted", "withdrawn"])("migrates genuine v10 %s products by adding only empty identifier facts without mutating the payload", kind => {
  let c = productCapacityCase();
  if (kind === "withdrawn") c = applyCaseCommand(c, { type: "withdraw-case-entity", commandId: "legacy-withdraw", expectedRevision: c.revision, target: { entity: "product", entityId: c.products[0].id }, source: contextSource("legacy-withdraw") }).case;
  if (kind === "pending" || kind === "conflicted") {
    const source = contextSource("legacy-lot-alternatives");
    c = applyCaseCommand(c, { type: "attach-grounded-proposals", commandId: "legacy-lot", expectedRevision: c.revision, products: [], sources: [source], proposals: ["LOT-00A", "LOT-00B"].map((value, i) => ({ proposalId: `lot-${i}`, groupId: "legacy-lot-group", intent: "alternative" as const, target: { entity: "product" as const, entityId: c.products[0].id, field: "lotNumber" as const }, value: { kind: "known" as const, value }, sourceIds: [source.id] })) }).case;
    if (kind === "conflicted") c = applyCaseCommand(c, { type: "review-proposal-groups", commandId: "accept-legacy-lot", expectedRevision: c.revision, decisions: [{ groupId: "legacy-lot-group", action: "accept" }] }).case;
  }
  const expected = { version: browserStateVersion, stage: "output", case: c, unrepresented: [] };
  const legacy = JSON.parse(JSON.stringify(expected)); legacy.version = "wilson-browser-state-v10";
  removeBirthDateFields(legacy.case);
  for (const p of legacy.case.products) delete p.facts.ndcOrUniqueId;
  const before = structuredClone(legacy);
  expect(parseBrowserJourneyState(legacy)).toEqual(expected);
  expect(legacy).toEqual(before);
});
it("rejects malformed/mislabeled/future payloads without inventing or overwriting identifier knowledge", () => {
  const good = { version: browserStateVersion, stage: "output", case: productCapacityCase(), unrepresented: [] };
  const missing = JSON.parse(JSON.stringify(good)); delete missing.case.products[0].facts.ndcOrUniqueId;
  const malformed = JSON.parse(JSON.stringify(good)); malformed.case.products[0].facts.ndcOrUniqueId = { state: "empty" };
  const mislabeled = { ...good, version: "wilson-browser-state-v10" };
  const future = { ...good, version: "wilson-browser-state-v99" };
  for (const candidate of [missing, malformed, mislabeled, future]) {
    const before = structuredClone(candidate); expect(() => parseBrowserJourneyState(candidate)).toThrow(); expect(candidate).toEqual(before);
  }
});

it("keeps model identifiers as exact grounded text and quarantines numeric coercion", async () => {
  const { parseQuotedFixture } = await import("../fixtures/source-references");
  const text = "Fictional product A has label identifier 00123-0045-06.";
  for (const value of ["00123-0045-06", 123004506]) {
    const result = parseQuotedFixture({ turn: "opening", input: { id: "identifier-input", type: "narrative", text, recordedAt: "2026-10-15T00:00:00Z" }, output: {
      products: [{ productReference: "a", groupReference: "a" }], proposals: [{ proposalReference: "name", groupReference: "a", intent: "fact", target: { entity: "product", productReference: "a", field: "name" }, value: { kind: "known", value: "Fictional product A" }, evidenceQuote: text }, { proposalReference: "id", groupReference: "a", intent: "fact", target: { entity: "product", productReference: "a", field: "ndcOrUniqueId" }, value: { kind: "known", value }, evidenceQuote: text }],
    } }, (kind, reference) => `${kind}-${reference}`);
    if (typeof value === "string") { expect(result.proposals[1].value).toEqual({ kind: "known", value }); expect(result.sources[0].excerpt).toBe(text); }
    else { expect(result.proposals).toHaveLength(1); expect(result.proposals[0].target.field).toBe("name"); expect(result.unrepresented).toContainEqual(expect.objectContaining({ field: "ndcOrUniqueId", reason: "incompatible-value" })); }
  }
});
