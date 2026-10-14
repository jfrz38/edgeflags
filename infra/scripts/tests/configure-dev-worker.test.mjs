import assert from "node:assert/strict";
import { test } from "node:test";

import {
  configureDevWorker,
  renderDevWorkerConfig,
} from "../configure-dev-worker.mjs";

const namespaceId = "abcdef0123456789abcdef0123456789";
const baseConfig = `name = "edgeflags"
main = "src/index.ts"

[[kv_namespaces]]
binding = "FLAGS_KV"
remote = false
`;

test("renders the development binding without changing the base configuration", () => {
  const config = renderDevWorkerConfig(baseConfig, namespaceId);

  assert.match(config, /^name = "edgeflags"/);
  assert.match(config, /\[env\.dev\]\nname = "edgeflags-dev"/);
  assert.match(config, new RegExp(`id = "${namespaceId}"`));
  assert.match(config, /\[\[env\.dev\.kv_namespaces\]\][\s\S]*remote = false/);
});

test("rejects an invalid namespace output", () => {
  assert.throws(
    () => renderDevWorkerConfig(baseConfig, "not-a-cloudflare-id"),
    /invalid Cloudflare KV namespace ID/,
  );
});

test("writes configuration from the supplied Terraform output contract", async () => {
  let written;

  await configureDevWorker({
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
});

test("does not write when reading Terraform output fails", async () => {
  let wrote = false;

  await assert.rejects(
    configureDevWorker({
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
