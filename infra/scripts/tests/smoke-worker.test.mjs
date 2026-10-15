import assert from "node:assert/strict";
import { test } from "node:test";

import { smokeWorker } from "../smoke-worker.mjs";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("checks health and a disposable flag lifecycle", async () => {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    requests.push(`${method} ${url.pathname}`);

    if (url.pathname === "/") {
      return jsonResponse({ service: "edgeflags", status: "ok" });
    }
    if (method === "PUT") {
      return jsonResponse({ key: "smoke-check", enabled: true }, 201);
    }
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (url.pathname.startsWith("/evaluate/")) {
      return jsonResponse({ key: "smoke-check", value: true });
    }
    return jsonResponse({ key: "smoke-check", enabled: true });
  };

  await smokeWorker({
    baseUrl: "https://dev.example.test",
    key: "smoke-check",
    fetch,
    sleep: async () => {},
  });

  assert.deepEqual(requests, [
    "GET /",
    "PUT /flags/smoke-check",
    "GET /flags/smoke-check",
    "GET /evaluate/smoke-check",
    "DELETE /flags/smoke-check",
  ]);
});

test("retries reads that have not propagated", async () => {
  let reads = 0;
  let sleeps = 0;
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";

    if (url.pathname === "/") {
      return jsonResponse({ service: "edgeflags", status: "ok" });
    }
    if (method === "PUT") return jsonResponse({}, 201);
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (url.pathname.startsWith("/evaluate/")) {
      return jsonResponse({ key: "smoke-retry", value: true });
    }

    reads += 1;
    return reads === 1
      ? jsonResponse({ error: { code: "FLAG_NOT_FOUND" } }, 404)
      : jsonResponse({ key: "smoke-retry", enabled: true });
  };

  await smokeWorker({
    baseUrl: "https://dev.example.test",
    key: "smoke-retry",
    fetch,
    sleep: async () => {
      sleeps += 1;
    },
  });

  assert.equal(reads, 2);
  assert.equal(sleeps, 1);
});

test("cleans up a created flag when evaluation fails", async () => {
  let cleaned = false;
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";

    if (url.pathname === "/") {
      return jsonResponse({ service: "edgeflags", status: "ok" });
    }
    if (method === "PUT") return jsonResponse({}, 201);
    if (method === "DELETE") {
      cleaned = true;
      return new Response(null, { status: 204 });
    }
    if (url.pathname.startsWith("/evaluate/")) {
      return jsonResponse({ error: { code: "FLAG_NOT_FOUND" } }, 404);
    }
    return jsonResponse({ key: "smoke-failure", enabled: true });
  };

  await assert.rejects(
    smokeWorker({
      baseUrl: "https://dev.example.test",
      key: "smoke-failure",
      attempts: 2,
      fetch,
      sleep: async () => {},
    }),
    /Flag evaluation failed/,
  );
  assert.equal(cleaned, true);
});

test("retries cleanup after a transient failure", async () => {
  let cleanupAttempts = 0;
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";

    if (url.pathname === "/") {
      return jsonResponse({ service: "edgeflags", status: "ok" });
    }
    if (method === "PUT") return jsonResponse({}, 201);
    if (method === "DELETE") {
      cleanupAttempts += 1;
      return new Response(null, {
        status: cleanupAttempts === 1 ? 503 : 204,
      });
    }
    if (url.pathname.startsWith("/evaluate/")) {
      return jsonResponse({ key: "smoke-cleanup", value: true });
    }
    return jsonResponse({ key: "smoke-cleanup", enabled: true });
  };

  await smokeWorker({
    baseUrl: "https://dev.example.test",
    key: "smoke-cleanup",
    fetch,
    sleep: async () => {},
  });

  assert.equal(cleanupAttempts, 2);
});

test("attempts cleanup after an unexpected create response", async () => {
  let cleaned = false;
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";

    if (url.pathname === "/") {
      return jsonResponse({ service: "edgeflags", status: "ok" });
    }
    if (method === "PUT") return jsonResponse({}, 502);
    if (method === "DELETE") {
      cleaned = true;
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected request");
  };

  await assert.rejects(
    smokeWorker({
      baseUrl: "https://dev.example.test",
      key: "smoke-create-failure",
      fetch,
      sleep: async () => {},
    }),
    /Flag creation failed/,
  );
  assert.equal(cleaned, true);
});

test("rejects non-HTTPS endpoints before making a request", async () => {
  await assert.rejects(
    smokeWorker({ baseUrl: "http://dev.example.test" }),
    /must use HTTPS/,
  );
});
