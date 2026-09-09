import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { hmr: false, middlewareMode: true, ws: false },
});

try {
  const { runStage2Gate } = await server.ssrLoadModule("/tools/model/run-stage-2-gate.ts");
  await runStage2Gate();
} finally {
  await server.close();
}
