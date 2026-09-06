import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/model/run-slice-3-sample.operator.test.ts"],
    retry: 0,
    testTimeout: 120_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});

