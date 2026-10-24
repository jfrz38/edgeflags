import assert from "node:assert/strict";
import { test } from "node:test";

import { manageAccessServiceToken } from "../manage-access-service-token.mjs";

const accountId = "0123456789abcdef0123456789abcdef";
const serviceTokenId = "12345678-1234-1234-1234-123456789abc";

test("creates a bounded development service token", async () => {
  let request;
  const result = await manageAccessServiceToken({
    action: "create",
    environment: "dev",
    accountId,
    apiToken: "api-token",
    fetch: async (url, init) => {
      request = { url, init };
      return response();
    },
  });

  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), {
    name: "edgeflags-dev-smoke",
    duration: "8760h",
  });
  assert.equal(result.clientSecret, "client-secret");
});

test("creates a distinctly named authorization validation token", async () => {
  let request;
  await manageAccessServiceToken({
    action: "create",
    environment: "dev",
    accountId,
    apiToken: "api-token",
    serviceTokenName: "edgeflags-dev-read-validation",
    fetch: async (url, init) => {
      request = { url, init };
      return response();
    },
  });

  assert.deepEqual(JSON.parse(request.init.body), {
    name: "edgeflags-dev-read-validation",
    duration: "8760h",
  });
});

test("rejects an invalid service token name before contacting Cloudflare", async () => {
  await assert.rejects(
    manageAccessServiceToken({
      action: "create",
      environment: "dev",
      accountId,
      apiToken: "api-token",
      serviceTokenName: "Invalid token name",
      fetch: async () => {
        throw new Error("Fetch should not be called");
      },
    }),
    /must be a lowercase kebab-case name/,
  );
});

test("rotates with a 24-hour overlap", async () => {
  let request;
  await manageAccessServiceToken({
    action: "rotate",
    environment: "dev",
    accountId,
    apiToken: "api-token",
    serviceTokenId,
    now: () => Date.parse("2026-10-16T00:00:00.000Z"),
    fetch: async (url, init) => {
      request = { url, init };
      return response({
        previous_client_secret_expires_at: "2026-10-17T00:00:00.000Z",
      });
    },
  });

  assert.match(request.url, new RegExp(`${serviceTokenId}/rotate$`));
  assert.deepEqual(JSON.parse(request.init.body), {
    previous_client_secret_expires_at: "2026-10-17T00:00:00.000Z",
  });
});

test("supports an explicit short overlap for a revocation exercise", async () => {
  let request;
  await manageAccessServiceToken({
    action: "rotate",
    environment: "dev",
    accountId,
    apiToken: "api-token",
    serviceTokenId,
    rotationOverlapMilliseconds: 10 * 60 * 1_000,
    now: () => Date.parse("2026-10-16T00:00:00.000Z"),
    fetch: async (url, init) => {
      request = { url, init };
      return response({
        previous_client_secret_expires_at: "2026-10-16T00:10:00.000Z",
      });
    },
  });

  assert.deepEqual(JSON.parse(request.init.body), {
    previous_client_secret_expires_at: "2026-10-16T00:10:00.000Z",
  });
});

test("deletes a service token by resource ID", async () => {
  let request;
  const result = await manageAccessServiceToken({
    action: "delete",
    environment: "dev",
    accountId,
    apiToken: "api-token",
    serviceTokenId,
    fetch: async (url, init) => {
      request = { url, init };
      return response();
    },
  });

  assert.match(request.url, new RegExp(`${serviceTokenId}$`));
  assert.equal(request.init.method, "DELETE");
  assert.equal(request.init.body, undefined);
  assert.deepEqual(result, { id: serviceTokenId });
});

test("hides provider details when Cloudflare rejects the request", async () => {
  await assert.rejects(
    manageAccessServiceToken({
      action: "create",
      environment: "dev",
      accountId,
      apiToken: "api-token",
      fetch: async () =>
        new Response(JSON.stringify({ success: false, errors: ["secret"] }), {
          status: 403,
        }),
    }),
    /Cloudflare rejected Access token create/,
  );
});

function response(overrides = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      result: {
        id: serviceTokenId,
        client_id: "client-id.access",
        client_secret: "client-secret",
        expires_at: "2027-10-16T00:00:00.000Z",
        ...overrides,
      },
    }),
  );
}
