import assert from "node:assert/strict";
import { test } from "node:test";

import { validateAccessAuthorization } from "../validate-access-authorization.mjs";

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
      const headers = new Headers(init.headers);
      requests.push({ request, headers });

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

const forbiddenResponse = () =>
  jsonResponse({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);

test("proves public access, authentication, and limited read authorization", async () => {
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "GET",
      path: "/flags/access-check",
      response: new Response("Unauthorized", { status: 401 }),
    },
    {
      method: "PUT",
      path: "/flags/access-check",
      response: jsonResponse({ key: "access-check", enabled: true }, 201),
    },
    {
      method: "GET",
      path: "/flags/access-check",
      response: jsonResponse({ key: "access-check", enabled: true }),
    },
    {
      method: "PUT",
      path: "/flags/access-check",
      response: forbiddenResponse(),
    },
    {
      method: "GET",
      path: "/evaluate/access-check",
      response: forbiddenResponse(),
    },
    {
      method: "DELETE",
      path: "/flags/access-check",
      response: forbiddenResponse(),
    },
    {
      method: "GET",
      path: "/flags/access-check",
      response: jsonResponse({ key: "access-check", enabled: true }),
    },
    {
      method: "DELETE",
      path: "/flags/access-check",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await validateAccessAuthorization({
    baseUrl: "https://dev.example.test",
    key: "access-check",
    fullAccessClientId: "full-id",
    fullAccessClientSecret: "full-secret",
    limitedAccessClientId: "limited-id",
    limitedAccessClientSecret: "limited-secret",
    fetch: scriptedFetch.fetch,
    sleep: async () => {},
  });

  assert.deepEqual([...scriptedFetch.requests[0].headers], []);
  assert.deepEqual([...scriptedFetch.requests[1].headers], []);
  for (const index of [2, 8]) {
    assert.equal(
      scriptedFetch.requests[index].headers.get("CF-Access-Client-Id"),
      "full-id",
    );
  }
  for (const index of [3, 4, 5, 6, 7]) {
    assert.equal(
      scriptedFetch.requests[index].headers.get("CF-Access-Client-Id"),
      "limited-id",
    );
  }
  scriptedFetch.assertComplete();
});

test("cleans up with the full-scope client after a failed authorization check", async () => {
  const scriptedFetch = createScriptedFetch([
    {
      method: "GET",
      path: "/",
      response: jsonResponse({ service: "edgeflags", status: "ok" }),
    },
    {
      method: "GET",
      path: "/flags/access-failure",
      response: new Response("Unauthorized", { status: 401 }),
    },
    {
      method: "PUT",
      path: "/flags/access-failure",
      response: jsonResponse({}, 201),
    },
    {
      method: "GET",
      path: "/flags/access-failure",
      response: jsonResponse({ key: "access-failure", enabled: true }),
    },
    {
      method: "PUT",
      path: "/flags/access-failure",
      response: jsonResponse({}, 200),
    },
    {
      method: "DELETE",
      path: "/flags/access-failure",
      response: new Response(null, { status: 204 }),
    },
  ]);

  await assert.rejects(
    validateAccessAuthorization({
      baseUrl: "https://dev.example.test",
      key: "access-failure",
      fullAccessClientId: "full-id",
      fullAccessClientSecret: "full-secret",
      limitedAccessClientId: "limited-id",
      limitedAccessClientSecret: "limited-secret",
      fetch: scriptedFetch.fetch,
      sleep: async () => {},
    }),
    /was not forbidden/,
  );
  assert.equal(
    scriptedFetch.requests.at(-1).headers.get("CF-Access-Client-Id"),
    "full-id",
  );
  scriptedFetch.assertComplete();
});

test("rejects incomplete limited-scope credentials before making a request", async () => {
  await assert.rejects(
    validateAccessAuthorization({
      baseUrl: "https://dev.example.test",
      fullAccessClientId: "full-id",
      fullAccessClientSecret: "full-secret",
      limitedAccessClientId: "limited-id",
    }),
    /Limited-scope Access client ID and client secret are required/,
  );
});
