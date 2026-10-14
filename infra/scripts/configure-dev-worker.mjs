import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const sourcePath = new URL("../../app/wrangler.toml", import.meta.url);
const destinationPath = new URL("../../app/wrangler.dev.toml", import.meta.url);
const terragruntDirectory = new URL("../live/dev", import.meta.url);

export function readNamespaceId() {
  return execFileSync(
    "terragrunt",
    [
      "run",
      "--tf-forward-stdout",
      "--tf-path",
      "terraform",
      "--",
      "output",
      "-raw",
      "flags_kv_namespace_id",
    ],
    {
      cwd: terragruntDirectory,
      encoding: "utf8",
    },
  ).trim();
}

export function renderDevWorkerConfig(baseConfig, namespaceId) {
  if (!/^[0-9a-f]{32}$/.test(namespaceId)) {
    throw new Error("Terragrunt returned an invalid Cloudflare KV namespace ID");
  }

  return `${baseConfig.trimEnd()}

[env.dev]
name = "edgeflags-dev"

[[env.dev.kv_namespaces]]
binding = "FLAGS_KV"
id = "${namespaceId}"
remote = false
`;
}

export async function configureDevWorker({
  getNamespaceId = readNamespaceId,
  read = readFile,
  write = writeFile,
  source = sourcePath,
  destination = destinationPath,
} = {}) {
  const namespaceId = getNamespaceId();
  const baseConfig = await read(source, "utf8");
  const devConfig = renderDevWorkerConfig(baseConfig, namespaceId);

  await write(destination, devConfig, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await configureDevWorker();
  console.log("Generated app/wrangler.dev.toml from Terragrunt-managed state");
}
