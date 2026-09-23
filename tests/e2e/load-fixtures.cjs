// Playwright-only preload; application model selection remains unchanged.
const { readFileSync } = require("node:fs");
const fixtureFile = process.env.WILSON_E2E_FIXTURE_FILE;
if (!fixtureFile) throw new Error("Missing Playwright fixture file");
process.env.WILSON_PREDETERMINED_MODEL_RESPONSES = readFileSync(fixtureFile, "utf8");
delete process.env.WILSON_E2E_FIXTURE_FILE;
