import { describe, expect, it } from "vitest";
import { applyCaseCommandToRepository } from "../../src/server/case/apply-command";
import { createSemanticCase } from "../../src/domain/case/create";
import {
  InMemoryCaseRepository,
  RepositoryCapacityError,
  RepositoryRevisionError,
} from "../../src/server/case/repository";

describe("temporary case repository", () => {
  it("returns isolated immutable cases and saves one revision atomically", async () => {
    const repository = new InMemoryCaseRepository();
    await repository.create(createSemanticCase("case-1"));
    const loaded = await repository.load("case-1");
    expect(loaded).toBeDefined();
    expect(Object.isFrozen(loaded)).toBe(true);

    const updated = await applyCaseCommandToRepository(repository, "case-1", {
      type: "record-asked-need",
      commandId: "invalid-before-products",
      expectedRevision: 0,
      key: "suspect-product-indications",
      productIds: [],
    }).catch((error: unknown) => error);
    expect(updated).toBeInstanceOf(Error);
    expect((await repository.load("case-1"))?.revision).toBe(0);
  });

  it("persists only command-boundary results and treats a repeated command as idempotent", async () => {
    const repository = new InMemoryCaseRepository();
    await repository.create(createSemanticCase("case-1"));
    const text = "Patient identifier TEST-57";
    const command = {
      type: "record-clinician-facts" as const,
      commandId: "record-patient-id",
      expectedRevision: 0,
      source: {
        id: "source-patient-id",
        inputId: "input-patient-id",
        inputType: "answer" as const,
        excerpt: text,
        start: 0,
        end: text.length,
        actor: "clinician" as const,
        recordedAt: "2026-09-05T20:00:00.000Z",
      },
      facts: [{
        id: "patient-id",
        target: { entity: "patient" as const, entityId: "patient" as const, field: "identifier" as const },
        intent: "fact" as const,
        value: { kind: "known" as const, value: "TEST-57" },
      }],
    };
    const updated = await applyCaseCommandToRepository(repository, "case-1", command);
    expect(updated.revision).toBe(1);
    expect((await repository.load("case-1"))?.patient.facts.identifier.resolvedValue?.value).toEqual({
      kind: "known",
      value: "TEST-57",
    });
    const duplicate = await applyCaseCommandToRepository(repository, "case-1", command);
    expect(duplicate.revision).toBe(1);
  });

  it("rejects stale repository saves", async () => {
    const repository = new InMemoryCaseRepository();
    const initial = createSemanticCase("case-1");
    await repository.create(initial);
    await expect(repository.save(initial, 1)).rejects.toBeInstanceOf(RepositoryRevisionError);
  });

  it("expires inactive cases and enforces a small fixed capacity", async () => {
    let now = 0;
    const repository = new InMemoryCaseRepository({ idleTtlMs: 100, maxCases: 1, now: () => now });
    await repository.create(createSemanticCase("case-1"));
    await expect(repository.create(createSemanticCase("case-2"))).rejects.toBeInstanceOf(RepositoryCapacityError);
    now = 101;
    expect(await repository.load("case-1")).toBeUndefined();
    await expect(repository.create(createSemanticCase("case-2"))).resolves.toBeUndefined();
  });
});
