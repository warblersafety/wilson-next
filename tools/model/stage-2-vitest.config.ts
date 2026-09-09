import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/model/run-stage-2-gate.operator.test.ts"],
    retry: 0,
    testTimeout: 0,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
