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
