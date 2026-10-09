import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const sourcePath = new URL("../../app/wrangler.toml", import.meta.url);
const destinationPath = new URL("../../app/wrangler.dev.toml", import.meta.url);
const terragruntDirectory = new URL("../live/dev", import.meta.url);

const namespaceId = execFileSync(
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

if (!/^[0-9a-f]{32}$/.test(namespaceId)) {
  throw new Error("Terragrunt returned an invalid Cloudflare KV namespace ID");
}

const baseConfig = (await readFile(sourcePath, "utf8")).trimEnd();
const devConfig = `${baseConfig}

[env.dev]
name = "edgeflags-dev"

[[env.dev.kv_namespaces]]
binding = "FLAGS_KV"
id = "${namespaceId}"
`;

await writeFile(destinationPath, devConfig, "utf8");
console.log("Generated app/wrangler.dev.toml from Terragrunt-managed state");
