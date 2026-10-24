import assert from "node:assert/strict";
import { test } from "node:test";

import {
  backupObjectKey,
  manageStateBackups,
  validateEnvironment,
} from "../manage-state-backups.mjs";

const accountId = "0123456789abcdef0123456789abcdef";

test("creates a timestamped backup and prunes objects older than 30 days", async () => {
  const calls = [];
  let removed;
  let written;
  const run = (command, args) => {
    calls.push({ command, args });
    if (command === "rclone" && args[0] === "lsf") return "terraform.tfstate\n";
    if (command === "terragrunt") return '{"version":4}';
    return "";
  };

  const result = await manageStateBackups({
    environment: "prod",
    accountId,
    backupAccessKeyId: "backup-key",
    backupSecretAccessKey: "backup-secret",
    run,
    createTempDirectory: async () => "/temporary/state",
    write: async (...args) => {
      written = args;
    },
    remove: async (...args) => {
      removed = args;
    },
    now: () => new Date("2026-10-24T12:34:56.000Z"),
  });

  assert.deepEqual(result, {
    backedUp: true,
    backupKey: "backups/20261024T123456Z.tfstate",
    retention: "30d",
  });
  assert.equal(written[1], '{"version":4}');
  assert.deepEqual(written[2], { encoding: "utf8", mode: 0o600 });
  assert.deepEqual(removed, ["/temporary/state", { recursive: true, force: true }]);
  assert.ok(
    calls.some(
      ({ command, args }) =>
        command === "rclone" &&
        args[0] === "copyto" &&
        args[2] ===
          ":s3:edgeflags-terraform-state-prod/backups/20261024T123456Z.tfstate",
    ),
  );
  assert.ok(
    calls.some(
      ({ command, args }) =>
        command === "rclone" &&
        args[0] === "delete" &&
        args.includes("30d"),
    ),
  );
});

test("skips backup on a first deployment while still applying retention", async () => {
  const calls = [];
  const result = await manageStateBackups({
    environment: "prod",
    accountId,
    backupAccessKeyId: "backup-key",
    backupSecretAccessKey: "backup-secret",
    run: (command, args) => {
      calls.push({ command, args });
      return "";
    },
  });

  assert.deepEqual(result, {
    backedUp: false,
    backupKey: undefined,
    retention: "30d",
  });
  assert.deepEqual(
    calls.map(({ command, args }) => `${command} ${args[0]}`),
    ["rclone lsf", "rclone delete"],
  );
});

test("validates environment, account, and backup credentials", async () => {
  assert.throws(() => validateEnvironment("staging"), /dev, prod/);
  assert.equal(
    backupObjectKey("dev", new Date("2026-10-24T00:00:00.000Z")),
    "backups/20261024T000000Z.tfstate",
  );
  await assert.rejects(
    manageStateBackups({ environment: "dev", accountId: "invalid" }),
    /CLOUDFLARE_ACCOUNT_ID/,
  );
  await assert.rejects(
    manageStateBackups({ environment: "dev", accountId }),
    /backup credentials/,
  );
});
