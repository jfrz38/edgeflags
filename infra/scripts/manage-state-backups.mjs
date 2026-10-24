import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const environments = new Set(["dev", "prod"]);
const retention = "30d";

export function validateEnvironment(environment) {
  if (!environments.has(environment)) {
    throw new Error("Environment must be one of: dev, prod");
  }
  return environment;
}

export function backupObjectKey(environment, date = new Date()) {
  validateEnvironment(environment);
  const timestamp = date.toISOString().replaceAll(/[-:]/g, "").replace(".000", "");
  return `backups/${timestamp}.tfstate`;
}

export async function manageStateBackups({
  environment,
  accountId,
  backupAccessKeyId,
  backupSecretAccessKey,
  run = execFileSync,
  createTempDirectory = () => mkdtemp(join(tmpdir(), "edgeflags-state-")),
  write = writeFile,
  remove = rm,
  now = () => new Date(),
} = {}) {
  validateEnvironment(environment);
  if (!/^[0-9a-f]{32}$/.test(accountId ?? "")) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
  }
  if (!backupAccessKeyId || !backupSecretAccessKey) {
    throw new Error("R2 backup credentials are required");
  }

  const bucket = `:s3:edgeflags-terraform-state-${environment}`;
  const commandEnvironment = {
    ...process.env,
    RCLONE_S3_PROVIDER: "Cloudflare",
    RCLONE_S3_ACCESS_KEY_ID: backupAccessKeyId,
    RCLONE_S3_SECRET_ACCESS_KEY: backupSecretAccessKey,
    RCLONE_S3_ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com`,
  };
  const runText = (command, args, options = {}) =>
    run(command, args, {
      encoding: "utf8",
      env: commandEnvironment,
      ...options,
    });

  const listing = runText("rclone", [
    "lsf",
    bucket,
    "--include",
    "terraform.tfstate",
    "--files-only",
    "--s3-no-check-bucket",
  ]);
  let backupKey;

  if (listing.split(/\r?\n/).includes("terraform.tfstate")) {
    const state = runText(
      "terragrunt",
      [
        "run",
        "--tf-forward-stdout",
        "--tf-path",
        "terraform",
        "--",
        "state",
        "pull",
      ],
      { cwd: new URL(`../live/${environment}/`, import.meta.url) },
    );
    const directory = await createTempDirectory();
    const statePath = join(directory, "terraform.tfstate");
    backupKey = backupObjectKey(environment, now());

    try {
      await write(statePath, state, { encoding: "utf8", mode: 0o600 });
      runText("rclone", [
        "copyto",
        statePath,
        `${bucket}/${backupKey}`,
        "--s3-no-check-bucket",
      ]);
    } finally {
      await remove(directory, { recursive: true, force: true });
    }
  }

  runText("rclone", [
    "delete",
    `${bucket}/backups`,
    "--min-age",
    retention,
    "--include",
    "*.tfstate",
    "--s3-no-check-bucket",
  ]);

  return { backedUp: backupKey !== undefined, backupKey, retention };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await manageStateBackups({
    environment: process.argv[2],
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    backupAccessKeyId: process.env.R2_BACKUP_ACCESS_KEY_ID,
    backupSecretAccessKey: process.env.R2_BACKUP_SECRET_ACCESS_KEY,
  });

  if (result.backedUp) {
    console.log(`State backed up to ${result.backupKey}`);
  } else {
    console.log("No remote state exists yet; skipped the pre-apply backup");
  }
  console.log(`Removed state backups older than ${result.retention}`);
}
