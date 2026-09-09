import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const predeterminedResponses = readFileSync("tests/e2e/predetermined-model-responses.json", "utf8");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      WILSON_PREDETERMINED_MODEL_RESPONSES: predeterminedResponses,
    },
  },
});
