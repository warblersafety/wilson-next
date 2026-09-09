import { describe, expect, it } from "vitest";
import { humanOmission } from "../../app/journey";
import type { JourneySnapshot } from "../../src/server/journey/service";

describe("journey labels", () => {
  it("uses the projection concept for a field-less event omission", () => {
    expect(humanOmission({} as JourneySnapshot, "event:event", "event description"))
      .toBe("event description");
  });
});
