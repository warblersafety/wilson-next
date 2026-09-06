import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/model/run-slice-3-sample.operator.test.ts"],
    retry: 0,
    // Zero disables Vitest's wall-clock timeout for the operator-run model call.
    testTimeout: 0,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
