import { describe, expect, it } from "vitest";
import {
  predeterminedModelResponses,
  predeterminedResponseScenarios,
} from "../e2e/build-predetermined-responses";

describe("predetermined E2E scenario ownership", () => {
  it("assembles the exact attributable 22-call queue from one authored source", () => {
    const scenarios = Object.values(predeterminedResponseScenarios) as ReadonlyArray<
      ReadonlyArray<{ identityScope: string }>
    >;
    const assembled = scenarios.flat();

    expect(scenarios).toHaveLength(17);
    expect(scenarios.every((responses) => responses.length > 0)).toBe(true);
    expect(assembled).toHaveLength(22);
    expect(predeterminedModelResponses).toEqual(assembled);
    expect(new Set(assembled.map(({ identityScope }) => identityScope)).size).toBe(22);
  });
});
