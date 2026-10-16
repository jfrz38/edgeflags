import { describe, expect, it } from "vitest";
import { CloudflareAccessAuthenticator } from "../../../src/infrastructure/auth/cloudflare-access-authenticator";

describe("CloudflareAccessAuthenticator", () => {
  it("maps an Access user to configured scopes", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "user:person-id": ["flags:read"] }),
    );

    const client = await authenticator.authenticate(
      accessContext({ user_uuid: "person-id" }),
    );

    expect(client).toEqual({
      principalId: "user:person-id",
      kind: "user",
      scopes: new Set(["flags:read"]),
    });
  });

  it("maps a service token common name to configured scopes", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({
        "service:smoke.access": ["flags:read", "flags:evaluate"],
      }),
    );

    const client = await authenticator.authenticate(
      accessContext({ common_name: "smoke.access" }),
    );

    expect(client).toEqual({
      principalId: "service:smoke.access",
      kind: "service",
      scopes: new Set(["flags:read", "flags:evaluate"]),
    });
  });

  it("uses the application audience when Access exposes no identity", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "audience:test-audience": ["flags:write"] }),
    );

    const client = await authenticator.authenticate(accessContext(undefined));

    expect(client).toEqual({
      principalId: "audience:test-audience",
      kind: "service",
      scopes: new Set(["flags:write"]),
    });
  });

  it("falls back to the audience when a service identity is not mapped", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "audience:test-audience": ["flags:write"] }),
    );

    const client = await authenticator.authenticate(
      accessContext({ common_name: "unmapped.access" }),
    );

    expect(client).toEqual({
      principalId: "audience:test-audience",
      kind: "service",
      scopes: new Set(["flags:write"]),
    });
  });

  it("can authorize a human by verified email before their UUID is recorded", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "user:operator@example.com": ["flags:read"] }),
    );

    const client = await authenticator.authenticate(
      accessContext({
        user_uuid: "person-id",
        email: "operator@example.com",
      }),
    );

    expect(client?.principalId).toBe("user:operator@example.com");
  });

  it("does not grant an audience policy to an unmapped human", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "audience:test-audience": ["flags:write"] }),
    );

    const client = await authenticator.authenticate(
      accessContext({
        user_uuid: "unmapped-person",
        email: "unmapped@example.com",
      }),
    );

    expect(client).toBeNull();
  });

  it("rejects an authenticated principal missing from the policy", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "user:another-person": ["flags:read"] }),
    );

    await expect(
      authenticator.authenticate(accessContext({ user_uuid: "person-id" })),
    ).resolves.toBeNull();
  });

  it.each([
    ["not-json", "valid JSON"],
    ["{}", "at least one principal"],
    [JSON.stringify({ invalid: ["flags:read"] }), "invalid principal"],
    [JSON.stringify({ "user:test": [] }), "invalid scopes"],
    [JSON.stringify({ "user:test": ["unknown"] }), "invalid scopes"],
    [
      JSON.stringify({ "user:test": ["flags:read", "flags:read"] }),
      "invalid scopes",
    ],
  ])("rejects an invalid authorization policy", (policy, message) => {
    expect(() => new CloudflareAccessAuthenticator(policy)).toThrow(message);
  });
});

function accessContext(
  identity: CloudflareAccessIdentity | undefined,
): CloudflareAccessContext {
  return {
    aud: "test-audience",
    getIdentity: async () => identity,
  };
}
