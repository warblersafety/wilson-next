import { test } from "vitest";
import { runStage2Gate } from "./run-stage-2-gate";

test("runs the human-gated Stage 2 model sequence", async () => {
  await runStage2Gate();
});
