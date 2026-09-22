import { defineConfig } from "@playwright/test";
import { predeterminedModelResponses, predeterminedResponseScenarios } from "./tests/e2e/build-predetermined-responses";

const selectedScenarios = process.env.WILSON_E2E_SCENARIOS?.split(",") as Array<keyof typeof predeterminedResponseScenarios> | undefined;
const predeterminedResponses = JSON.stringify(selectedScenarios
  ? selectedScenarios.flatMap((key) => { if (!predeterminedResponseScenarios[key]) throw new Error(`Unknown browser scenario: ${key}`); return predeterminedResponseScenarios[key]; })
  : predeterminedModelResponses);

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
