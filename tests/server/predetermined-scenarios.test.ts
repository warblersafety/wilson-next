import { describe, expect, it } from "vitest";
import {
  predeterminedModelResponses,
  predeterminedResponseScenarios,
} from "../e2e/build-predetermined-responses";

describe("predetermined E2E scenario ownership", () => {
  it("assembles the exact attributable 38-call queue from one authored source", () => {
    const scenarios = Object.values(predeterminedResponseScenarios) as ReadonlyArray<
      ReadonlyArray<{ identityScope: string }>
    >;
    const assembled = scenarios.flat();

    expect(scenarios).toHaveLength(24);
    expect(scenarios.every((responses) => responses.length > 0)).toBe(true);
    expect(assembled).toHaveLength(38);
    expect(predeterminedModelResponses).toEqual(assembled);
    // Draft 4 deliberately reuses the two medication fixtures in separate browser cases.
    expect(predeterminedResponseScenarios.draft4Navigation).toBe(predeterminedResponseScenarios.issue92Sparse);
    expect(predeterminedResponseScenarios.draft4Correction).toBe(predeterminedResponseScenarios.issue92Two);
    expect(assembled.slice(-2).map(({ identityScope }) => identityScope)).toEqual(["issue106", "issue106-update"]);
    expect(new Set(assembled.map(({ identityScope }) => identityScope)).size).toBe(33);
  });
});
