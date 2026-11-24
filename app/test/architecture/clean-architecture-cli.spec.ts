import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createTemporaryProject } from "./support/temporary-project";

const executeFile = promisify(execFile);
const require = createRequire(import.meta.url);
const cliEntry = require.resolve("@jfrz38/clean-architecture-highlighter-cli");
const applicationRoot = resolve(dirname(import.meta.filename), "../..");
const architectureConfig = join(applicationRoot, "clean-architecture.json");

describe("clean architecture layer rules", () => {
  it("accepts the current application source", async () => {
    const result = await runArchitectureCheck(
      applicationRoot,
      architectureConfig,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("[]");
  });

  it.each([
    ["domain", "application"],
    ["domain", "infrastructure"],
    ["application", "infrastructure"],
  ])("rejects a dependency from %s to %s", async (source, target) => {
    const project = await createTemporaryProject();

    try {
      await project.write(
        `src/${target}/target.ts`,
        "export const target = true;\n",
      );
      await project.write(
        `src/${source}/source.ts`,
        `import { target } from "../${target}/target";\nexport const source = target;\n`,
      );

      const result = await runArchitectureCheck(
        project.root,
        architectureConfig,
      );

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual([
        expect.objectContaining({
          filePath: `src/${source}/source.ts`,
          message: `${source} layer should not depend on ${target} layer.`,
        }),
      ]);
    } finally {
      await project.remove();
    }
  });
});

async function runArchitectureCheck(
  projectRoot: string,
  config: string,
): Promise<{ exitCode: number; stdout: string }> {
  try {
    const { stdout } = await executeFile(process.execPath, [
      cliEntry,
      "check",
      projectRoot,
      "--source-folder",
      "src",
      "--config",
      config,
      "--format",
      "json",
    ]);

    return { exitCode: 0, stdout: stdout.trim() };
  } catch (error) {
    if (!isExecutionError(error)) throw error;

    return {
      exitCode: error.code,
      stdout: error.stdout.trim(),
    };
  }
}

function isExecutionError(
  error: unknown,
): error is Error & { code: number; stdout: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "number" &&
    "stdout" in error &&
    typeof error.stdout === "string"
  );
}
