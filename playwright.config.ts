import { defineConfig } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { predeterminedModelResponses, predeterminedResponseScenarios } from "./tests/e2e/build-predetermined-responses";

const selectedScenarios = process.env.WILSON_E2E_SCENARIOS?.split(",") as Array<keyof typeof predeterminedResponseScenarios> | undefined;
const predeterminedResponses = JSON.stringify(selectedScenarios
  ? selectedScenarios.flatMap((key) => { if (!predeterminedResponseScenarios[key]) throw new Error(`Unknown browser scenario: ${key}`); return predeterminedResponseScenarios[key]; })
  : predeterminedModelResponses);
// Linux limits an individual exec environment value to 128 KiB. Load the same
// JSON into the server process after it starts, instead of passing it to exec.
const fixtureDirectory = mkdtempSync(join(tmpdir(), "wilson-e2e-"));
const fixtureFile = join(fixtureDirectory, "responses.json");
writeFileSync(fixtureFile, predeterminedResponses, { mode: 0o600 });
process.once("exit", () => rmSync(fixtureDirectory, { recursive: true, force: true }));

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
    command: "node --require ./tests/e2e/load-fixtures.cjs ./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      WILSON_PREDETERMINED_MODEL_RESPONSES: "",
      WILSON_E2E_FIXTURE_FILE: fixtureFile,
    },
  },
});
