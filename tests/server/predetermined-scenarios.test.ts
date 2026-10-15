import { describe, expect, it } from "vitest";
import {
  predeterminedModelResponses,
  predeterminedResponseScenarios,
} from "../e2e/build-predetermined-responses";

describe("predetermined E2E scenario ownership", () => {
  it("assembles the exact attributable 48-call queue from one authored source", () => {
    const scenarios = Object.values(predeterminedResponseScenarios) as ReadonlyArray<
      ReadonlyArray<{ identityScope: string }>
    >;
    const assembled = scenarios.flat();

    expect(scenarios).toHaveLength(31);
    expect(scenarios.every((responses) => responses.length > 0)).toBe(true);
    expect(assembled).toHaveLength(48);
    expect(predeterminedModelResponses).toEqual(assembled);
    const serialStart = assembled.indexOf(predeterminedResponseScenarios.serial105[0]);
    expect(assembled.slice(serialStart, serialStart + 3).map(({ identityScope }) => identityScope)).toEqual(["issue105", "issue105-mixed", "issue105-invalid"]);
    expect(serialStart + 3).toBe(assembled.indexOf(predeterminedResponseScenarios.issue96[0]));
    // Draft 4 deliberately reuses the two medication fixtures in separate browser cases.
    expect(predeterminedResponseScenarios.draft4Navigation).toBe(predeterminedResponseScenarios.issue92Sparse);
    expect(predeterminedResponseScenarios.draft4Correction).toBe(predeterminedResponseScenarios.issue92Two);
    expect(assembled.slice(-3).map(({ identityScope }) => identityScope)).toEqual(["issue106", "issue106-update", "issue109-update"]);
    expect(new Set(assembled.map(({ identityScope }) => identityScope)).size).toBe(43);
  });
});
