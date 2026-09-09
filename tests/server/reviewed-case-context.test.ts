import { describe, expect, it } from "vitest";
import { createReviewedCaseModelContext } from "../../src/server/model/reviewed-case-context";
import { acceptOpeningCase, createOpeningCase } from "../domain/fixture";

describe("reviewed case model context", () => {
  it("exposes only accepted semantic values and stable entity IDs", () => {
    const proposed = createReviewedCaseModelContext(createOpeningCase());
    expect(proposed.products).toEqual([]);

    const context = createReviewedCaseModelContext(acceptOpeningCase());
    expect(context.patient).toContainEqual({
      field: "identifier",
      value: { kind: "known", value: "TEST-57" },
    });
    expect(context.products).toContainEqual(expect.objectContaining({
      id: "product-apixaban",
      name: "apixaban",
      facts: expect.arrayContaining([
        { field: "dose", value: { kind: "known", value: "5 mg" } },
        { field: "startDate", value: { kind: "known", value: "2026-08-12" } },
      ]),
    }));
    expect(JSON.stringify(context)).not.toMatch(/sourceIds|proposalGroupId|proposedValues|evidence/);
  });
});
