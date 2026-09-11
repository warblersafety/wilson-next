import { describe, expect, it, vi } from "vitest";
import {
  modelProposalOutputSchema,
  parseModelProposalEnvelope,
  type ModelBoundaryIdentityFactory,
} from "../../src/domain/case/model-boundary";
import { modelTargetValueContracts, type KnownValueContract } from "../../src/domain/case/value-contract";

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

  it("quarantines absent and ambiguous evidence while rejecting an unusable blank envelope", () => {
    const absent = candidate();
    absent.output.proposals[0].evidenceQuote = "missing";
    absent.output.proposals.push(companionProposal("Patient TEST-57") as never);
    expect(parseModelProposalEnvelope(absent, identities)).toMatchObject({
      proposals: [expect.objectContaining({ target: { entity: "event", entityId: "event", field: "problemDescription" } })],
      unrepresented: [{ entity: "patient", field: "identifier", evidenceQuote: "missing", reason: "evidence-not-found" }],
    });

    const ambiguous = candidate("rash then rash");
    ambiguous.output.proposals[0].evidenceQuote = "rash";
    ambiguous.output.proposals.push(companionProposal("rash then rash") as never);
    expect(parseModelProposalEnvelope(ambiguous, identities).unrepresented).toEqual([
      { entity: "patient", field: "identifier", evidenceQuote: "rash", reason: "evidence-ambiguous" },
    ]);

    const blank = candidate();
    blank.output.proposals[0].evidenceQuote = " ";
    expect(() => parseModelProposalEnvelope(blank, identities)).toThrow("must not be blank");
  });

  it("rejects the response when a proposal lacks the minimum citation required for visible quarantine", () => {
    const malformed = candidate() as unknown as {
      output: { proposals: Array<Record<string, unknown>> };
    };
    delete malformed.output.proposals[0].evidenceQuote;
    malformed.output.proposals[0].source = { id: "model-source", start: 8, end: 15 };
    malformed.output.proposals.push(companionProposal("Patient TEST-57"));

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

  it("quarantines products beyond the supported limit before allocating case identity", () => {
    const createIdentity = vi.fn<ModelBoundaryIdentityFactory>(identities);
    const productNames = ["Drug A", "Drug B", "Drug C", "Drug D"];
    const parsed = parseModelProposalEnvelope({
      turn: "opening",
      input: {
        id: "input-four-products",
        type: "narrative",
        text: productNames.join(", "),
        recordedAt,
      },
      output: {
        products: productNames.map((_, index) => ({
          productReference: `product-${index + 1}`,
          groupReference: `group-${index + 1}`,
        })),
        proposals: productNames.map((name, index) => ({
          proposalReference: `name-${index + 1}`,
          groupReference: `group-${index + 1}`,
          intent: "fact" as const,
          target: { entity: "product" as const, productReference: `product-${index + 1}`, field: "name" as const },
          value: { kind: "known" as const, value: name },
          evidenceQuote: name,
        })),
      },
    }, createIdentity);

    expect(parsed.products).toHaveLength(3);
    expect(parsed.proposals).toHaveLength(3);
    expect(parsed.sources.map(({ excerpt }) => excerpt)).toEqual(["Drug A", "Drug B", "Drug C"]);
    expect(parsed.unrepresented).toEqual([{
      entity: "product",
      field: "name",
      evidenceQuote: "Drug D",
      reason: "product-limit",
    }]);
    expect(createIdentity).not.toHaveBeenCalledWith("product", "product-4");
    expect(createIdentity).not.toHaveBeenCalledWith("group", "group-4");
    expect(createIdentity).not.toHaveBeenCalledWith("proposal", "name-4");
    expect(createIdentity).not.toHaveBeenCalledWith("source", "name-4");
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
    later.output.proposals.push(companionProposal(later.input.text) as never);
    expect(parseModelProposalEnvelope(later, identities).unrepresented).toEqual([
      expect.objectContaining({ entity: "product", field: "dose", reason: "unresolved-entity" }),
    ]);
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
    later.output.proposals.push(companionProposal(later.input.text) as never);
    expect(parseModelProposalEnvelope(later, identities).unrepresented).toEqual([
      expect.objectContaining({ entity: "test", field: "testResult", reason: "unresolved-entity" }),
    ]);
  });

  it("quarantines a runtime value type that does not match its semantic target", () => {
    const malformed = candidate();
    malformed.output.proposals[0].value = { kind: "known", value: 57 } as never;
    malformed.output.proposals.push(companionProposal("Patient TEST-57") as never);
    expect(parseModelProposalEnvelope(malformed, identities)).toMatchObject({
      proposals: [expect.objectContaining({ target: { entity: "event", entityId: "event", field: "problemDescription" } })],
      unrepresented: [{ entity: "patient", field: "identifier", evidenceQuote: "TEST-57", reason: "incompatible-value" }],
    });
  });

  it("quarantines an unsupported target field while preserving a valid sibling", () => {
    const malformed = candidate();
    malformed.output.proposals[0].target = { entity: "patient", field: "unsupportedClinicalCode" } as never;
    malformed.output.proposals.push(companionProposal("Patient TEST-57") as never);

    expect(parseModelProposalEnvelope(malformed, identities)).toMatchObject({
      proposals: [expect.objectContaining({ target: { entity: "event", entityId: "event", field: "problemDescription" } })],
      unrepresented: [{
        entity: "patient",
        field: "unsupportedClinicalCode",
        evidenceQuote: "TEST-57",
        reason: "unsupported-target",
      }],
    });
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

  it.each(["suspected", "primary", "causal"])("quarantines noncanonical product role %s", (role) => {
    const candidate = roleCandidate(role);
    candidate.output.proposals.push(companionProposal(candidate.input.text) as never);
    expect(parseModelProposalEnvelope(candidate, identities).unrepresented).toEqual([
      expect.objectContaining({ entity: "product", field: "role", reason: "incompatible-value" }),
    ]);
  });

  it("rejects a response when every proposal is quarantined", () => {
    const malformed = candidate();
    malformed.output.proposals[0].value = { kind: "known", value: 57 } as never;
    expect(() => parseModelProposalEnvelope(malformed, identities)).toThrow("Every proposal was unrepresentable");
  });

  it("still rejects duplicate identities and groups that span case entities", () => {
    const duplicate = candidate();
    duplicate.output.proposals.push({ ...duplicate.output.proposals[0] });
    expect(() => parseModelProposalEnvelope(duplicate, identities)).toThrow("Duplicate proposalReference");

    const spanning = candidate("Patient TEST-57 reported a rash");
    spanning.output.proposals[0].groupReference = "shared-group";
    spanning.output.proposals.push({
      proposalReference: "event-symptoms",
      groupReference: "shared-group",
      intent: "fact",
      target: { entity: "event", field: "symptoms" },
      value: { kind: "known", value: ["rash"] },
      evidenceQuote: "reported a rash",
    } as never);
    expect(() => parseModelProposalEnvelope(spanning, identities)).toThrow("cannot span different case entities");
  });

  it("keeps valid facts and exact evidence while quarantining both recorded target/value failures", () => {
    const text = "Patient TEST-68 developed hives. The device is available for evaluation.";
    const parsed = parseModelProposalEnvelope({
      turn: "opening",
      input: { id: "input-recorded-failures", type: "narrative", text, recordedAt },
      output: {
        products: [],
        proposals: [
          {
            proposalReference: "identifier", groupReference: "patient", intent: "fact",
            target: { entity: "patient", field: "identifier" },
            value: { kind: "known", value: "TEST-68" }, evidenceQuote: "TEST-68",
          },
          {
            proposalReference: "symptoms", groupReference: "event", intent: "fact",
            target: { entity: "event", field: "symptoms" },
            value: { kind: "known", value: "hives" }, evidenceQuote: "developed hives",
          },
          {
            proposalReference: "availability", groupReference: "event", intent: "fact",
            target: { entity: "event", field: "productAvailability" },
            value: { kind: "known", value: "available for evaluation" },
            evidenceQuote: "The device is available for evaluation",
          },
        ],
      },
    }, identities);

    expect(parsed.proposals).toEqual([
      expect.objectContaining({ target: { entity: "patient", entityId: "patient", field: "identifier" } }),
    ]);
    expect(parsed.sources).toEqual([
      expect.objectContaining({ excerpt: "TEST-68", start: 8, end: 15 }),
    ]);
    expect(parsed.unrepresented).toEqual([
      { entity: "event", field: "symptoms", evidenceQuote: "developed hives", reason: "incompatible-value" },
      { entity: "event", field: "productAvailability", evidenceQuote: "The device is available for evaluation", reason: "incompatible-value" },
    ]);
  });

  it("prunes a relevant test and its dependent details when test-and-result is quarantined", () => {
    const text = "Patient TEST-68. Tryptase was eighteen on 2026-09-10.";
    const parsed = parseModelProposalEnvelope({
      turn: "opening",
      input: { id: "input-test-prune", type: "narrative", text, recordedAt },
      output: {
        products: [],
        tests: [{ testReference: "tryptase", groupReference: "test-group" }],
        proposals: [
          {
            proposalReference: "identifier", groupReference: "patient", intent: "fact",
            target: { entity: "patient", field: "identifier" },
            value: { kind: "known", value: "TEST-68" }, evidenceQuote: "TEST-68",
          },
          {
            proposalReference: "test-result", groupReference: "test-group", intent: "fact",
            target: { entity: "test", testReference: "tryptase", field: "testResult" },
            value: { kind: "known", value: 18 }, evidenceQuote: "Tryptase was eighteen",
          },
          {
            proposalReference: "test-date", groupReference: "test-group", intent: "fact",
            target: { entity: "test", testReference: "tryptase", field: "date" },
            value: { kind: "known", value: "2026-09-10" }, evidenceQuote: "2026-09-10",
          },
        ],
      },
    }, identities);

    expect(parsed.relevantTests).toEqual([]);
    expect(parsed.proposals).toHaveLength(1);
    expect(parsed.unrepresented).toEqual([
      expect.objectContaining({ field: "testResult", reason: "incompatible-value" }),
      expect.objectContaining({ field: "date", reason: "incomplete-relevant-test" }),
    ]);
  });

  it("keeps model target enumeration aligned with the domain-owned value contract", () => {
    for (const [entity, contracts] of Object.entries(modelTargetValueContracts)) {
      for (const [field, contract] of Object.entries(contracts)) {
        const target = entity === "product" ? { entity, productReference: "product", field }
          : entity === "test" ? { entity, testReference: "test", field }
            : { entity, field };
        const output = {
          products: entity === "product" ? [{ productReference: "product", groupReference: "group" }] : [],
          tests: entity === "test" ? [{ testReference: "test", groupReference: "group" }] : [],
          proposals: [{
            proposalReference: "proposal", groupReference: "group", intent: "fact",
            target, value: { kind: "known", value: validKnownValue(contract) }, evidenceQuote: "synthetic evidence",
          }],
        };
        expect(modelProposalOutputSchema.safeParse(output).success, `${entity}.${field}`).toBe(true);
      }
    }
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

function companionProposal(evidenceQuote: string) {
  return {
    proposalReference: `companion-${evidenceQuote.length}`,
    groupReference: "event",
    intent: "fact" as const,
    target: { entity: "event" as const, field: "problemDescription" as const },
    value: { kind: "known" as const, value: evidenceQuote },
    evidenceQuote,
  };
}

function validKnownValue(contract: KnownValueContract): unknown {
  switch (contract.shape) {
    case "string": return "value";
    case "iso-date": return "2026-09-10";
    case "integer": return contract.minimum;
    case "boolean": return true;
    case "string-array": return ["value"];
    case "measurement": return { value: 1, unit: contract.units[0] };
    case "enum": return contract.values[0];
    case "enum-array": return [contract.values[0]];
  }
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
