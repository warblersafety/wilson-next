import { test } from "vitest";
import { runSlice3Sample } from "./run-slice-3-sample";

test("runs one capped real-model sample for human review", async () => {
  await runSlice3Sample();
});
