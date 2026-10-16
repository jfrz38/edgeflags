import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("EdgeFlags Worker", () => {
  it("identifies the service from the root endpoint", async () => {
    const response = await fetchWorker(new Request("https://edgeflags.test/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      service: "edgeflags",
      status: "ok",
    });
  });

  it("supports the complete boolean flag lifecycle", async () => {
    const createResponse = await request("PUT", "/flags/new-checkout", {
      enabled: true,
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.headers.get("location")).toBe("/flags/new-checkout");
    await expect(createResponse.json()).resolves.toEqual({
      key: "new-checkout",
      enabled: true,
    });

    const readResponse = await request("GET", "/flags/new-checkout");
    expect(readResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toEqual({
      key: "new-checkout",
      enabled: true,
    });

    const firstEvaluation = await request("GET", "/evaluate/new-checkout");
    await expect(firstEvaluation.json()).resolves.toEqual({
      key: "new-checkout",
      value: true,
    });

    const replaceResponse = await request("PUT", "/flags/new-checkout", {
      enabled: false,
    });
    expect(replaceResponse.status).toBe(200);

    const secondEvaluation = await request("GET", "/evaluate/new-checkout");
    await expect(secondEvaluation.json()).resolves.toEqual({
      key: "new-checkout",
      value: false,
    });

    expect((await request("DELETE", "/flags/new-checkout")).status).toBe(204);
    expect((await request("DELETE", "/flags/new-checkout")).status).toBe(204);

    const missingResponse = await request("GET", "/flags/new-checkout");
    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: {
        code: "FLAG_NOT_FOUND",
        message: "Flag 'new-checkout' was not found",
      },
    });
  });

  it.each([
    ["GET", "/flags/Invalid", 400, "INVALID_FLAG_KEY"],
    ["GET", "/evaluate/absent", 404, "FLAG_NOT_FOUND"],
    ["GET", "/missing", 404, "ROUTE_NOT_FOUND"],
  ])("returns a stable error for %s %s", async (method, path, status, code) => {
    const response = await request(method, path);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it("rejects an unsupported method on a known route", async () => {
    const response = await request("POST", "/flags/method-check");

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PUT, DELETE");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "METHOD_NOT_ALLOWED" },
    });
  });

  it("requires JSON for PUT requests", async () => {
    const response = await fetchWorker(
      new Request("https://edgeflags.test/flags/content-type-check", {
        method: "PUT",
        body: "enabled=true",
      }),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
  });

  it("returns a generic internal error for corrupt persisted data", async () => {
    await env.FLAGS_KV.put("flags:corrupt", "{");

    const response = await request("GET", "/flags/corrupt");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  });

  it.each([
    ["not json", "malformed JSON"],
    [JSON.stringify({ enabled: "true" }), "a non-boolean value"],
    [JSON.stringify({ enabled: true, extra: true }), "an unknown property"],
  ])("rejects %s as an invalid request", async (body) => {
    const response = await fetchWorker(
      new Request("https://edgeflags.test/flags/invalid-body-check", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });
});

function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetchWorker(
    new Request(`https://edgeflags.test${path}`, {
      method,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function fetchWorker(request: Request): Promise<Response> {
  return worker.fetch(
    request as Parameters<typeof worker.fetch>[0],
    {
      ...env,
      ACCESS_ENFORCEMENT_ENABLED: "true",
      AUTHORIZATION_POLICY: JSON.stringify({
        "service:local-test-token": [
          "flags:read",
          "flags:write",
          "flags:evaluate",
        ],
      }),
    },
    {
      access: {
        aud: "local-development",
        getIdentity: async () => ({
          service_token_id: "local-test-token",
          service_token_status: true,
        }),
      },
    } as unknown as ExecutionContext,
  );
}
