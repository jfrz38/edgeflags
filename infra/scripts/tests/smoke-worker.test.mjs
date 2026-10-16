import assert from "node:assert/strict";
import { test } from "node:test";

import { smokeWorker } from "../smoke-worker.mjs";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function createScriptedFetch(script) {
  const requests = [];

  return {
    fetch: async (input, init = {}) => {
      const expected = script.shift();
      const url = new URL(input);
      const method = init.method ?? "GET";
      const request = `${method} ${url.pathname}`;
      requests.push({ request, headers: new Headers(init.headers) });

      assert.ok(expected, `Unexpected request: ${request}`);
      assert.equal(request, `${expected.method} ${expected.path}`);
      return expected.response;
    },
    assertComplete() {
      assert.deepEqual(script, []);
    },
    requests,
  };
}

test("checks health and a disposable flag lifecycle", async () => {
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "PUT",
      path: "/flags/smoke-check",
      response: jsonResponse({ key: "smoke-check", enabled: true }, 201),
    },
    {
      method: "GET",
      path: "/flags/smoke-check",
      response: jsonResponse({ key: "smoke-check", enabled: true }),
    },
    {
      method: "GET",
      path: "/evaluate/smoke-check",
      response: jsonResponse({ key: "smoke-check", value: true }),
    },
    {
      method: "DELETE",
      path: "/flags/smoke-check",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await smokeWorker({
    baseUrl: "https://dev.example.test",
    key: "smoke-check",
    fetch: scriptedFetch.fetch,
    sleep: async () => {},
  });

  assert.deepEqual(
    scriptedFetch.requests.map(({ request }) => request),
    [
      "GET /",
      "PUT /flags/smoke-check",
      "GET /flags/smoke-check",
      "GET /evaluate/smoke-check",
      "DELETE /flags/smoke-check",
    ],
  );
  scriptedFetch.assertComplete();
});

test("retries reads that have not propagated", async () => {
  let sleeps = 0;
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "PUT",
      path: "/flags/smoke-retry",
      response: jsonResponse({}, 201),
    },
    {
      method: "GET",
      path: "/flags/smoke-retry",
      response: jsonResponse({ error: { code: "FLAG_NOT_FOUND" } }, 404),
    },
    {
      method: "GET",
      path: "/flags/smoke-retry",
      response: jsonResponse({ key: "smoke-retry", enabled: true }),
    },
    {
      method: "GET",
      path: "/evaluate/smoke-retry",
      response: jsonResponse({ key: "smoke-retry", value: true }),
    },
    {
      method: "DELETE",
      path: "/flags/smoke-retry",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await smokeWorker({
    baseUrl: "https://dev.example.test",
    key: "smoke-retry",
    fetch: scriptedFetch.fetch,
    sleep: async () => {
      sleeps += 1;
    },
  });

  assert.equal(sleeps, 1);
  scriptedFetch.assertComplete();
});

test("cleans up a created flag when evaluation fails", async () => {
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "PUT",
      path: "/flags/smoke-failure",
      response: jsonResponse({}, 201),
    },
    {
      method: "GET",
      path: "/flags/smoke-failure",
      response: jsonResponse({ key: "smoke-failure", enabled: true }),
    },
    {
      method: "GET",
      path: "/evaluate/smoke-failure",
      response: jsonResponse({ error: { code: "FLAG_NOT_FOUND" } }, 404),
    },
    {
      method: "GET",
      path: "/evaluate/smoke-failure",
      response: jsonResponse({ error: { code: "FLAG_NOT_FOUND" } }, 404),
    },
    {
      method: "DELETE",
      path: "/flags/smoke-failure",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await assert.rejects(
    smokeWorker({
      baseUrl: "https://dev.example.test",
      key: "smoke-failure",
      attempts: 2,
      fetch: scriptedFetch.fetch,
      sleep: async () => {},
    }),
    /Flag evaluation failed/,
  );
  scriptedFetch.assertComplete();
});

test("retries cleanup after a transient failure", async () => {
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "PUT",
      path: "/flags/smoke-cleanup",
      response: jsonResponse({}, 201),
    },
    {
      method: "GET",
      path: "/flags/smoke-cleanup",
      response: jsonResponse({ key: "smoke-cleanup", enabled: true }),
    },
    {
      method: "GET",
      path: "/evaluate/smoke-cleanup",
      response: jsonResponse({ key: "smoke-cleanup", value: true }),
    },
    {
      method: "DELETE",
      path: "/flags/smoke-cleanup",
      response: new Response(null, { status: 503 }),
    },
    {
      method: "DELETE",
      path: "/flags/smoke-cleanup",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await smokeWorker({
    baseUrl: "https://dev.example.test",
    key: "smoke-cleanup",
    fetch: scriptedFetch.fetch,
    sleep: async () => {},
  });

  scriptedFetch.assertComplete();
});

test("attempts cleanup after an unexpected create response", async () => {
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "PUT",
      path: "/flags/smoke-create-failure",
      response: jsonResponse({}, 502),
    },
    {
      method: "DELETE",
      path: "/flags/smoke-create-failure",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await assert.rejects(
    smokeWorker({
      baseUrl: "https://dev.example.test",
      key: "smoke-create-failure",
      fetch: scriptedFetch.fetch,
      sleep: async () => {},
    }),
    /Flag creation failed/,
  );
  scriptedFetch.assertComplete();
});

test("rejects non-HTTPS endpoints before making a request", async () => {
  const fetch = () => {
    throw new Error("Fetch should not be called");
  };

  await assert.rejects(
    smokeWorker({ baseUrl: "http://dev.example.test", fetch }),
    /must use HTTPS/,
  );
});

test("authenticates every request with a Cloudflare Access service token", async () => {
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "PUT",
      path: "/flags/smoke-access",
      response: jsonResponse({}, 201),
    },
    {
      method: "GET",
      path: "/flags/smoke-access",
      response: jsonResponse({ key: "smoke-access", enabled: true }),
    },
    {
      method: "GET",
      path: "/evaluate/smoke-access",
      response: jsonResponse({ key: "smoke-access", value: true }),
    },
    {
      method: "DELETE",
      path: "/flags/smoke-access",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await smokeWorker({
    baseUrl: "https://dev.example.test",
    key: "smoke-access",
    accessClientId: "client-id",
    accessClientSecret: "client-secret",
    fetch: scriptedFetch.fetch,
    sleep: async () => {},
  });

  for (const { headers } of scriptedFetch.requests) {
    assert.equal(headers.get("CF-Access-Client-Id"), "client-id");
    assert.equal(headers.get("CF-Access-Client-Secret"), "client-secret");
  }
});

test("rejects an incomplete Access service token", async () => {
  await assert.rejects(
    smokeWorker({
      baseUrl: "https://dev.example.test",
      accessClientId: "client-id",
    }),
    /Both Access client ID and client secret are required/,
  );
});
