import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("case mutation source boundary", () => {
  it("prevents application routes and UI modules from importing lower-level mutation helpers", async () => {
    const applicationFiles = await sourceFiles(join(root, "app"));
    const forbidden = [
      /(?:from|import\s*\()["'][^"']*domain\/case\/(?:commands|internal)["']/,
      /(?:from|import\s*\()["'][^"']*server\/case\/repository["']/,
    ];
    const violations: string[] = [];
    for (const path of applicationFiles) {
      const source = await readFile(path, "utf8");
      if (forbidden.some((pattern) => pattern.test(source))) violations.push(relative(root, path));
    }
    expect(violations).toEqual([]);
  });

  it("keeps lower-level mutation modules reachable only from the authoritative server boundary", async () => {
    const sourceFilesUnderSrc = await sourceFiles(join(root, "src"));
    const allowedCommandImporters = new Set(["src/server/case/apply-command.ts"]);
    const allowedInternalImporters = new Set([
      "src/domain/case/commands.ts",
      "src/domain/case/create.ts",
      "src/server/case/repository.ts",
    ]);
    const violations: string[] = [];

    for (const path of sourceFilesUnderSrc) {
      const name = relative(root, path);
      const source = await readFile(path, "utf8");
      if (/from ["'][^"']*domain\/case\/commands["']/.test(source) && !allowedCommandImporters.has(name)) {
        violations.push(`${name} imports commands`);
      }
      if (/from ["'][^"']*(?:domain\/case\/)?internal["']/.test(source) && !allowedInternalImporters.has(name)) {
        violations.push(`${name} imports internal helpers`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps experiment fixtures and semantic oracles out of the production model/evidence boundary", async () => {
    const boundaryFiles = [
      ...(await sourceFiles(join(root, "src/domain"))),
      ...(await sourceFiles(join(root, "src/server/model"))),
    ];
    const forbidden = [
      /(?:from|import\s*\()["'][^"']*experiment\//,
      /(?:from|import\s*\()["'][^"']*(?:fixed-journey|sample-oracle)["']/,
      /\b(?:apixaban|naproxen|lisinopril)\b/i,
    ];
    const violations: string[] = [];

    for (const path of boundaryFiles) {
      const source = await readFile(path, "utf8");
      if (forbidden.some((pattern) => pattern.test(source))) violations.push(relative(root, path));
    }

    expect(violations).toEqual([]);
  });

  it("keeps live model calls out of the browser route until separately authorized", async () => {
    const route = await readFile(join(root, "app/api/case/route.ts"), "utf8");
    expect(route).not.toMatch(/server\/model\/anthropic-journey/);
  });

  it("keeps the Stage 2 semantic oracle out of executable gate validation", async () => {
    const executableGateFiles = [
      "tools/model/run-stage-2-gate.ts",
    ];
    const forbidden = /(?:sample-oracle|fixed-inputs|fixed-journey|journey\/service|evidence\/experiment-2\/stage-2)/;
    const violations: string[] = [];

    for (const name of executableGateFiles) {
      if (forbidden.test(await readFile(join(root, name), "utf8"))) violations.push(name);
    }

    expect(violations).toEqual([]);
  });
});

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".jsx"].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}
