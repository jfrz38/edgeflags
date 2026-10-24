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

  it("maps a service token ID to configured scopes", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({
        "service:token-id": ["flags:read", "flags:evaluate"],
      }),
    );

    const client = await authenticator.authenticate(
      accessContext({ service_token_id: "token-id" }),
    );

    expect(client).toEqual({
      principalId: "service:token-id",
      kind: "service",
      scopes: new Set(["flags:read", "flags:evaluate"]),
    });
  });

  it("maps a verified service assertion when identity is unavailable", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "service:token-client-id": ["flags:evaluate"] }),
      assertionVerifier("token-client-id"),
    );

    const client = await authenticator.authenticate(
      accessContext(undefined),
      "signed-assertion",
    );

    expect(client).toEqual({
      principalId: "service:token-client-id",
      kind: "service",
      scopes: new Set(["flags:evaluate"]),
    });
  });

  it("does not trust a service assertion without an Access context", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "service:token-client-id": ["flags:evaluate"] }),
      assertionVerifier("token-client-id"),
    );

    const client = await authenticator.authenticate(
      undefined,
      "signed-assertion",
    );

    expect(client).toBeNull();
  });

  it("prefers a human identity over a supplied service assertion", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({
        "user:person-id": ["flags:read"],
        "service:token-client-id": ["flags:write"],
      }),
      assertionVerifier("token-client-id"),
    );

    const client = await authenticator.authenticate(
      accessContext({ user_uuid: "person-id" }),
      "signed-assertion",
    );

    expect(client).toEqual({
      principalId: "user:person-id",
      kind: "user",
      scopes: new Set(["flags:read"]),
    });
  });

  it("rejects inconsistent service identity sources", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "service:asserted-token": ["flags:write"] }),
      assertionVerifier("asserted-token"),
    );

    const client = await authenticator.authenticate(
      accessContext({ service_token_id: "identity-token" }),
      "signed-assertion",
    );

    expect(client).toBeNull();
  });

  it("prefers a service token ID over user-shaped identity fields", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "service:token-id": ["flags:evaluate"] }),
    );

    const client = await authenticator.authenticate(
      accessContext({
        service_token_id: "token-id",
        service_token_status: true,
        email: "non-identity@example.com",
      }),
    );

    expect(client).toEqual({
      principalId: "service:token-id",
      kind: "service",
      scopes: new Set(["flags:evaluate"]),
    });
  });

  it("does not treat an Access audience as a client identity", async () => {
    const authenticator = new CloudflareAccessAuthenticator(
      JSON.stringify({ "service:known-token": ["flags:evaluate"] }),
    );

    const client = await authenticator.authenticate(accessContext(undefined));

    expect(client).toBeNull();
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
      JSON.stringify({ "service:test-token": ["flags:write"] }),
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
    [
      JSON.stringify({ "audience:test-audience": ["flags:read"] }),
      "invalid principal",
    ],
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

function assertionVerifier(clientId: string | null) {
  return {
    verify: async () => clientId,
  };
}
