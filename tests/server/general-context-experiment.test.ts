import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createAnthropicRequest } from "../../src/server/model/anthropic-journey";

it("appends only the frozen experimental paragraph to the unchanged v19 system prompt", () => {
  const request = createAnthropicRequest("opening", "Fictional product-problem report.");
  const split = request.system.lastIndexOf("\n\n");
  const baseline = request.system.slice(0, split);
  const addition = request.system.slice(split + 2);
  expect(createHash("sha256").update(baseline).digest("hex")).toBe("2c6ebe6980df8aff283196d4c3ef021d8fbcc284ea5dcdbf9fa1c80c56f98ca8");
  expect(createHash("sha256").update(addition + "\n").digest("hex")).toBe("f8f08082e9a982a59ce35e39daf5beb52601976be6b546a7ce646d2d052cafc5");
  expect(request.model).toBe("claude-sonnet-5");
  expect(request.max_tokens).toBe(128000);
});
