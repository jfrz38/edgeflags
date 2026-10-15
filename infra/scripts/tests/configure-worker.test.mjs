import assert from "node:assert/strict";
import { test } from "node:test";

import {
  configureWorker,
  renderWorkerConfig,
  validateEnvironment,
} from "../configure-worker.mjs";

const namespaceId = "abcdef0123456789abcdef0123456789";
const baseConfig = `name = "edgeflags"
main = "src/index.ts"

[[kv_namespaces]]
binding = "FLAGS_KV"
remote = false
`;

test("renders an environment binding without changing the base configuration", () => {
  const config = renderWorkerConfig(baseConfig, namespaceId, "dev");

  assert.match(config, /^name = "edgeflags"/);
  assert.match(config, /\[env\.dev\]\nname = "edgeflags-dev"/);
  assert.match(config, new RegExp(`id = "${namespaceId}"`));
  assert.match(config, /\[\[env\.dev\.kv_namespaces\]\][\s\S]*remote = false/);
});

test("renders the production environment independently", () => {
  const config = renderWorkerConfig(baseConfig, namespaceId, "prod");

  assert.match(config, /\[env\.prod\]\nname = "edgeflags-prod"/);
  assert.match(config, /\[\[env\.prod\.kv_namespaces\]\]/);
  assert.doesNotMatch(config, /env\.dev/);
});

test("rejects an unknown environment", () => {
  assert.throws(() => validateEnvironment("staging"), /dev, prod/);
});

test("rejects an invalid namespace output", () => {
  assert.throws(
    () => renderWorkerConfig(baseConfig, "not-a-cloudflare-id", "dev"),
    /invalid Cloudflare KV namespace ID/,
  );
});

test("writes configuration from the supplied Terraform output contract", async () => {
  let written;

  await configureWorker("prod", {
    getNamespaceId: () => namespaceId,
    read: async () => baseConfig,
    write: async (destination, contents, encoding) => {
      written = { destination, contents, encoding };
    },
    source: "base.toml",
    destination: "generated.toml",
  });

  assert.equal(written.destination, "generated.toml");
  assert.equal(written.encoding, "utf8");
  assert.match(written.contents, new RegExp(`id = "${namespaceId}"`));
  assert.match(written.contents, /env\.prod/);
});

test("does not write when reading Terraform output fails", async () => {
  let wrote = false;

  await assert.rejects(
    configureWorker("dev", {
      getNamespaceId: () => {
        throw new Error("terraform output failed");
      },
      read: async () => baseConfig,
      write: async () => {
        wrote = true;
      },
    }),
    /terraform output failed/,
  );

  assert.equal(wrote, false);
});
