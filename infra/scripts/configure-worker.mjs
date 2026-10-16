import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const sourcePath = new URL("../../app/wrangler.toml", import.meta.url);
const environments = new Set(["dev", "prod"]);

export function validateEnvironment(environment) {
  if (!environments.has(environment)) {
    throw new Error("Environment must be one of: dev, prod");
  }

  return environment;
}

export function readNamespaceId(environment) {
  validateEnvironment(environment);

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
      cwd: new URL(`../live/${environment}/`, import.meta.url),
      encoding: "utf8",
    },
  ).trim();
}

export function renderWorkerConfig(
  baseConfig,
  namespaceId,
  environment,
  accessEnabled = false,
) {
  validateEnvironment(environment);

  if (!/^[0-9a-f]{32}$/.test(namespaceId)) {
    throw new Error("Terragrunt returned an invalid Cloudflare KV namespace ID");
  }

  return `${baseConfig.trimEnd()}

[env.${environment}]
name = "edgeflags-${environment}"

[env.${environment}.vars]
ACCESS_ENFORCEMENT_ENABLED = "${accessEnabled}"

[[env.${environment}.kv_namespaces]]
binding = "FLAGS_KV"
id = "${namespaceId}"
remote = false
`;
}

export async function configureWorker(
  environment,
  {
    getNamespaceId = readNamespaceId,
    read = readFile,
    write = writeFile,
    source = sourcePath,
    destination = new URL(
      `../../app/wrangler.${environment}.toml`,
      import.meta.url,
    ),
    accessEnabled = process.env.ACCESS_ENABLED === "true",
  } = {},
) {
  validateEnvironment(environment);

  const namespaceId = getNamespaceId(environment);
  const baseConfig = await read(source, "utf8");
  const workerConfig = renderWorkerConfig(
    baseConfig,
    namespaceId,
    environment,
    accessEnabled,
  );

  await write(destination, workerConfig, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const environment = process.argv[2];
  await configureWorker(environment);
  console.log(
    `Generated app/wrangler.${environment}.toml from Terragrunt-managed state`,
  );
}
