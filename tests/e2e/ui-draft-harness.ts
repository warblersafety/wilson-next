import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { Page } from "@playwright/test";
import type { JsonObject } from "../../src/browser/active-case-store";

interface Probe {
  read(): JsonObject;
  remount(raw: unknown): { ok: boolean; code?: string };
  restore(raw: unknown): { ok: boolean; code?: string };
  rejectInvalid(): void;
}
export const readDraftOwner = (page: Page) => page.evaluate(() => (window as unknown as { draftProbe: Probe }).draftProbe.read());
export const remountDraftOwner = (page: Page, raw: unknown) => page.evaluate(value => (window as unknown as { draftProbe: Probe }).draftProbe.remount(value), raw);
export const tryRestoreDraftOwner = (page: Page, raw: unknown) => page.evaluate(value => (window as unknown as { draftProbe: Probe }).draftProbe.restore(value), raw);
export const rejectDraftAction = (page: Page) => page.evaluate(() => (window as unknown as { draftProbe: Probe }).draftProbe.rejectInvalid());

/** Test-only bundling of actual production components with a context probe.
 * Playwright fulfills the HTML; no production route/flag/global is introduced. */
export async function draftOwnerHarnessHtml(): Promise<string> {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), "wilson-draft-harness-"));
  try {
    const entry = join(directory, "entry.tsx");
    await writeFile(entry, `
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { JourneyBody } from ${JSON.stringify(join(root, "app/journey.tsx"))};
import { JourneyDraftProvider, useJourneyDrafts } from ${JSON.stringify(join(root, "app/journey-drafts.tsx"))};
import { decodeUiDrafts, encodeUiDrafts } from ${JSON.stringify(join(root, "src/browser/ui-drafts.ts"))};
const root = createRoot(document.getElementById("root"));
let generation = 0;
let latest;
function Probe() {
  const owner = useJourneyDrafts();
  useEffect(() => { latest = owner; });
  return null;
}
function render(initialSnapshot) {
  root.render(<JourneyDraftProvider key={++generation} initialSnapshot={initialSnapshot}><JourneyBody/><Probe/></JourneyDraftProvider>);
}
window.draftProbe = {
  read: () => encodeUiDrafts(latest.snapshot),
  remount: raw => {
    try { const decoded = decodeUiDrafts(raw, latest.snapshot.caseId ?? undefined); render(decoded); return { ok: true }; }
    catch (error) { return { ok: false, code: error.code }; }
  },
  restore: raw => {
    const result = latest.restore(raw, latest.snapshot.caseId ?? undefined);
    return result.ok ? { ok: true } : { ok: false, code: result.error.code };
  },
  rejectInvalid: () => latest.dispatch({ type: "component", kind: "card", scope: "invalid", dependency: "invalid", initial: { invalid: true } }),
};
render();
`);
    const result = await build({
      root, configFile: false, envFile: false, logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      resolve: { alias: [
        { find: /^react$/, replacement: join(root, "node_modules/react/index.js") },
        { find: /^react\/jsx-runtime$/, replacement: join(root, "node_modules/react/jsx-runtime.js") },
        { find: /^react-dom\/client$/, replacement: join(root, "node_modules/react-dom/client.js") },
      ] },
      oxc: { jsx: { runtime: "automatic" } },
      build: { write: false, minify: true, lib: { entry, name: "WilsonDraftHarness", formats: ["iife"] } },
    });
    let javascript = "", css = "";
    for (const output of Array.isArray(result) ? result : [result]) {
      if (!("output" in output)) throw new Error("Unexpected test bundle result");
      for (const item of output.output) {
        if (item.type === "chunk") javascript += item.code;
        else if (item.fileName.endsWith(".css")) css += String(item.source);
      }
    }
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>${javascript.replaceAll("</script", "<\\/script")}</script></body></html>`;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
