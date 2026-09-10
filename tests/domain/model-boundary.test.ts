import { describe, expect, it, vi } from "vitest";
import {
  modelProposalOutputSchema,
  parseModelProposalEnvelope,
  providerModelProposalOutputSchema,
  type ModelBoundaryIdentityFactory,
} from "../../src/domain/case/model-boundary";
import { modelTargetValueContracts } from "../../src/domain/case/value-contract";

const recordedAt = "2026-09-05T20:00:00.000Z";

function candidate(text = "Patient TEST-57") {
  return {
    turn: "opening" as const,
    input: { id: "input-1", type: "narrative" as const, text, recordedAt },
    output: {
      products: [],
      proposals: [{
        proposalReference: "patient-identifier",
        groupReference: "patient-facts",
        intent: "fact" as const,
        target: { entity: "patient" as const, field: "identifier" as const },
        value: { kind: "known" as const, value: "TEST-57" },
        evidenceQuote: "TEST-57",
      }],
    },
  };
}

const identities: ModelBoundaryIdentityFactory = (kind, reference) => `${kind}-${reference}`;

describe("model proposal boundary", () => {
  it("deterministically locates one exact quotation and assigns application identities", () => {
    const parsed = parseModelProposalEnvelope(candidate(), identities);

    expect(parsed.sources).toEqual([{
      id: "source-patient-identifier",
      inputId: "input-1",
      inputType: "narrative",
      excerpt: "TEST-57",
      start: 8,
      end: 15,
      actor: "clinician",
      recordedAt,
    }]);
    expect(parsed.proposals).toEqual([expect.objectContaining({
      proposalId: "proposal-patient-identifier",
      groupId: "patient",
      sourceIds: ["source-patient-identifier"],
    })]);
  });

  it("rejects absent, ambiguous, and blank evidence before attachment", () => {
    const absent = candidate();
    absent.output.proposals[0].evidenceQuote = "missing";
    expect(() => parseModelProposalEnvelope(absent, identities)).toThrow("absent from the clinician input");

    const ambiguous = candidate("rash then rash");
    ambiguous.output.proposals[0].evidenceQuote = "rash";
    expect(() => parseModelProposalEnvelope(ambiguous, identities)).toThrow("occurs more than once");

    const blank = candidate();
    blank.output.proposals[0].evidenceQuote = " ";
    expect(() => parseModelProposalEnvelope(blank, identities)).toThrow("must not be blank");
  });

  it("does not accept model-calculated offsets or source identities", () => {
    const malformed = candidate() as unknown as {
      output: { proposals: Array<Record<string, unknown>> };
    };
    delete malformed.output.proposals[0].evidenceQuote;
    malformed.output.proposals[0].source = { id: "model-source", start: 8, end: 15 };

    expect(() => parseModelProposalEnvelope(malformed as never, identities)).toThrow();
  });

  it("shares one exact source when several proposals cite the same clause", () => {
    const shared = candidate();
    shared.output.proposals.push({
      proposalReference: "patient-sex",
      groupReference: "patient-facts",
      intent: "fact",
      target: { entity: "patient", field: "sex" },
      value: { kind: "known", value: "female" },
      evidenceQuote: "TEST-57",
    } as unknown as typeof shared.output.proposals[number]);

    const parsed = parseModelProposalEnvelope(shared, identities);
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.proposals.map(({ sourceIds }) => sourceIds)).toEqual([
      ["source-patient-identifier"],
      ["source-patient-identifier"],
    ]);
  });

  it("assigns opaque product and group IDs without retaining names, references, or order as identity", () => {
    const opaqueIds: Record<string, string> = {
      "group-first-group": "group-8b9c",
      "group-second-group": "group-12de",
      "product-first-mention": "product-b80a",
      "product-second-mention": "product-419f",
    };
    const createIdentity = vi.fn<ModelBoundaryIdentityFactory>((kind, reference) => (
      opaqueIds[`${kind}-${reference}`] ?? `${kind}-${reference}`
    ));
    const parsed = parseModelProposalEnvelope({
      turn: "opening",
      input: {
        id: "input-opening",
        type: "narrative",
        text: "First course used Drug Z. A second course also used Drug Z.",
        recordedAt,
      },
      output: {
        products: [
          { productReference: "first-mention", groupReference: "first-group" },
          { productReference: "second-mention", groupReference: "second-group" },
        ],
        proposals: [
          productNameProposal("first-name", "first-group", "first-mention", "First course used Drug Z"),
          productNameProposal("second-name", "second-group", "second-mention", "second course also used Drug Z"),
        ],
      },
    }, createIdentity);

    expect(parsed.products).toEqual([
      { id: "product-b80a", groupId: "group-8b9c" },
      { id: "product-419f", groupId: "group-12de" },
    ]);
    expect(parsed.proposals.map(({ target }) => target)).toEqual([
      { entity: "product", entityId: "product-b80a", field: "name" },
      { entity: "product", entityId: "product-419f", field: "name" },
    ]);
    expect(JSON.stringify(parsed)).not.toContain("first-mention");
    expect(JSON.stringify(parsed)).not.toContain("second-mention");
  });

  it("links later product mentions only to supplied stable application IDs", () => {
    const later = {
      turn: "correction" as const,
      input: {
        id: "input-update",
        type: "correction" as const,
        text: "The first course dose was 20 mg, not 10 mg.",
        recordedAt,
      },
      existingProductIds: ["product-b80a"],
      output: {
        products: [],
        proposals: [{
          proposalReference: "dose-change",
          groupReference: "dose-change-group",
          intent: "correction" as const,
          target: { entity: "product" as const, productReference: "product-b80a", field: "dose" as const },
          value: { kind: "known" as const, value: "20 mg" },
          evidenceQuote: "first course dose was 20 mg, not 10 mg",
        }],
      },
    };

    expect(parseModelProposalEnvelope(later, identities).proposals[0].target).toEqual({
      entity: "product",
      entityId: "product-b80a",
      field: "dose",
    });
    later.output.proposals[0].target.productReference = "Drug Z";
    expect(() => parseModelProposalEnvelope(later, identities)).toThrow("Unknown reviewed product ID Drug Z");
  });

  it("assigns stable relevant-test identity and requires that ID on later correction", () => {
    const opening = parseModelProposalEnvelope({
      turn: "opening",
      input: { id: "input-test", type: "narrative", text: "Serum tryptase was 18 ng/mL.", recordedAt },
      output: {
        products: [], tests: [{ testReference: "result-one", groupReference: "test-group" }],
        proposals: [{ proposalReference: "test-result", groupReference: "test-group", intent: "fact", target: { entity: "test", testReference: "result-one", field: "testResult" }, value: { kind: "known", value: "Serum tryptase: 18 ng/mL" }, evidenceQuote: "Serum tryptase was 18 ng/mL" }],
      },
    }, identities);
    expect(opening.relevantTests).toEqual([{ id: "test-result-one", groupId: "group-test-group" }]);
    expect(opening.proposals[0].target).toEqual({ entity: "test", entityId: "test-result-one", field: "testResult" });

    const later = {
      turn: "correction" as const,
      input: { id: "input-test-update", type: "correction" as const, text: "Correction: tryptase was 17 ng/mL.", recordedAt },
      existingTestIds: ["test-result-one"],
      output: { products: [], tests: [], proposals: [{ proposalReference: "test-correction", groupReference: "test-update", intent: "correction" as const, target: { entity: "test" as const, testReference: "test-result-one", field: "testResult" as const }, value: { kind: "known" as const, value: "Serum tryptase: 17 ng/mL" }, evidenceQuote: "tryptase was 17 ng/mL" }] },
    };
    expect(parseModelProposalEnvelope(later, identities).proposals[0].target).toEqual({ entity: "test", entityId: "test-result-one", field: "testResult" });
    later.output.proposals[0].target.testReference = "tryptase";
    expect(() => parseModelProposalEnvelope(later, identities)).toThrow("Unknown reviewed test ID tryptase");
  });

  it("rejects a runtime value type that does not match its semantic target", () => {
    const malformed = candidate();
    malformed.output.proposals[0].value = { kind: "known", value: 57 } as never;
    expect(() => parseModelProposalEnvelope(malformed, identities)).toThrow("identifier requires a string");
  });

  it.each([
    ["symptoms list", { entity: "event", field: "symptoms" }, ["rash"], true],
    ["symptoms scalar", { entity: "event", field: "symptoms" }, "rash", false],
    ["availability enum", { entity: "event", field: "productAvailability" }, "available", true],
    ["availability free text", { entity: "event", field: "productAvailability" }, "available for evaluation", false],
    ["ISO date", { entity: "event", field: "onsetDate" }, "2026-09-10", true],
    ["non-ISO date", { entity: "event", field: "onsetDate" }, "September 10", false],
    ["boolean", { entity: "event", field: "hospitalized" }, true, true],
    ["boolean text", { entity: "event", field: "hospitalized" }, "yes", false],
    ["age boundary", { entity: "patient", field: "ageYears" }, 150, true],
    ["age outside boundary", { entity: "patient", field: "ageYears" }, 151, false],
    ["sex enum", { entity: "patient", field: "sex" }, "intersex", true],
    ["sex free text", { entity: "patient", field: "sex" }, "not recorded", false],
    ["product role", { entity: "product", productReference: "product", field: "role" }, "suspect", true],
    ["product role free text", { entity: "product", productReference: "product", field: "role" }, "causal", false],
    ["test text", { entity: "test", testReference: "test", field: "testResult" }, "Tryptase: 18 ng/mL", true],
  ] as const)("locally decodes target-dependent %s values", (_label, target, value, accepted) => {
    const result = modelProposalOutputSchema.safeParse(modelOutput(target, value));
    expect(result.success).toBe(accepted);
  });

  it("expresses every model target in a provider-enforced target/value variant", () => {
    for (const [entity, contracts] of Object.entries(modelTargetValueContracts)) {
      for (const [field, contract] of Object.entries(contracts)) {
        expect(providerValueSchema(entity, field), `${entity}.${field}`).toMatchObject(
          expectedProviderValue(contract),
        );
      }
    }
    expect(JSON.stringify(providerModelProposalOutputSchema)).not.toContain("reportType");
    expect(JSON.stringify(providerModelProposalOutputSchema)).not.toContain("reporter");
  });

  it.each(["unknown", "explicitly-absent", "inapplicable", "declined"] as const)(
    "preserves an explicitly stated %s meaning as an unaccepted proposal",
    (kind) => {
      const explicit = candidate(`The identifier is ${kind}.`);
      explicit.output.proposals[0].value = { kind } as never;
      explicit.output.proposals[0].evidenceQuote = `identifier is ${kind}`;

      expect(parseModelProposalEnvelope(explicit, identities).proposals[0].value).toEqual({ kind });
    },
  );

  it.each(["suspect", "concomitant"])("accepts canonical product role %s", (role) => {
    expect(parseModelProposalEnvelope(roleCandidate(role), identities).proposals[0].value)
      .toEqual({ kind: "known", value: role });
  });

  it.each(["suspected", "primary", "causal"])("rejects noncanonical product role %s", (role) => {
    expect(() => parseModelProposalEnvelope(roleCandidate(role), identities))
      .toThrow("role requires suspect or concomitant");
  });
});

function productNameProposal(
  proposalReference: string,
  groupReference: string,
  productReference: string,
  evidenceQuote: string,
) {
  return {
    proposalReference,
    groupReference,
    intent: "fact" as const,
    target: { entity: "product" as const, productReference, field: "name" as const },
    value: { kind: "known" as const, value: "Drug Z" },
    evidenceQuote,
  };
}

function roleCandidate(role: string) {
  return {
    turn: "opening" as const,
    input: { id: "input-1", type: "narrative" as const, text: "I suspect Drug Z", recordedAt },
    output: {
      products: [{ productReference: "mentioned-product", groupReference: "mentioned-product-group" }],
      proposals: [{
        proposalReference: "product-role",
        groupReference: "mentioned-product-group",
        intent: "fact" as const,
        target: { entity: "product" as const, productReference: "mentioned-product", field: "role" as const },
        value: { kind: "known" as const, value: role },
        evidenceQuote: "I suspect Drug Z",
      }],
    },
  };
}

function modelOutput(target: object, value: unknown) {
  return {
    products: [],
    proposals: [{
      proposalReference: "proposal",
      groupReference: "group",
      intent: "fact",
      target,
      value: { kind: "known", value },
      evidenceQuote: "synthetic evidence",
    }],
  };
}

function providerValueSchema(entity: string, field: string): Record<string, unknown> {
  const proposals = providerModelProposalOutputSchema.properties as Record<string, Record<string, unknown>>;
  const proposalArray = proposals.proposals;
  const items = proposalArray.items as { anyOf: Array<Record<string, unknown>> };
  for (const variant of items.anyOf) {
    const properties = variant.properties as Record<string, Record<string, unknown>>;
    const value = properties.value;
    const valueProperties = value?.properties as Record<string, Record<string, unknown>> | undefined;
    if (valueProperties?.kind?.const !== "known") continue;
    const target = properties.target;
    const targetVariants = (target.anyOf as Array<Record<string, unknown>> | undefined) ?? [target];
    if (targetVariants.some((candidate) => {
      const candidateProperties = candidate.properties as Record<string, Record<string, unknown>>;
      return candidateProperties.entity.const === entity
        && (candidateProperties.field.enum as string[]).includes(field);
    })) return valueProperties.value;
  }
  throw new Error(`No provider contract for ${entity}.${field}`);
}

function expectedProviderValue(contract: { shape: string; values?: readonly string[] }) {
  switch (contract.shape) {
    case "string": return { type: "string" };
    case "iso-date": return { type: "string", format: "date" };
    case "integer": return { type: "integer" };
    case "boolean": return { type: "boolean" };
    case "string-array": return { type: "array", items: { type: "string" } };
    case "measurement": return { type: "object", properties: { value: { type: "number" }, unit: { enum: ["kg", "lb"] } } };
    case "enum": return { type: "string", enum: [...(contract.values ?? [])] };
    default: throw new Error(`Unexpected model value contract ${contract.shape}`);
  }
}
