import { readFile, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { renderDevWorkerConfig } from "./configure-dev-worker.mjs";

const appDirectory = new URL("../../app/", import.meta.url);
const sourcePath = new URL("wrangler.toml", appDirectory);
const testConfigPath = new URL(".wrangler.binding-test.toml", appDirectory);
const vitestPath = new URL("node_modules/vitest/vitest.mjs", appDirectory);
const namespaceId = "abcdef0123456789abcdef0123456789";

try {
  const baseConfig = await readFile(sourcePath, "utf8");
  await writeFile(
    testConfigPath,
    renderDevWorkerConfig(baseConfig, namespaceId),
    "utf8",
  );

  const result = spawnSync(
    process.execPath,
    [fileURLToPath(vitestPath), "run", "test/index.spec.ts"],
    {
      cwd: appDirectory,
      env: {
        ...process.env,
        EDGEFLAGS_WRANGLER_CONFIG: "./.wrangler.binding-test.toml",
        EDGEFLAGS_WRANGLER_ENV: "dev",
      },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
} finally {
  await unlink(testConfigPath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
