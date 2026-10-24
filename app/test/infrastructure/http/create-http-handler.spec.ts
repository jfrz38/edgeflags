import { describe, expect, it } from "vitest";
import { DeleteFlag } from "../../../src/application/delete-flag";
import { EvaluateFlag } from "../../../src/application/evaluate-flag";
import type { FlagRepository } from "../../../src/application/flag-repository";
import { GetFlag } from "../../../src/application/get-flag";
import { PutFlag } from "../../../src/application/put-flag";
import type { FeatureFlag } from "../../../src/domain/feature-flag";
import type { FlagKey } from "../../../src/domain/flag-key";
import { createHttpHandler } from "../../../src/infrastructure/http/create-http-handler";

describe("createHttpHandler", () => {
  it("hides unexpected storage failures", async () => {
    const repository = new FailingFlagRepository();
    const getFlag = new GetFlag(repository);
    const handler = createHttpHandler(
      getFlag,
      new PutFlag(repository),
      new DeleteFlag(repository),
      new EvaluateFlag(getFlag),
      async () => ({
        principalId: "user:test",
        kind: "user",
        scopes: new Set(["flags:read"]),
      }),
    );

    const response = await handler(
      new Request("https://edgeflags.test/flags/new-checkout"),
      accessContext(),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  });

  it("rejects a protected route without an Access context", async () => {
    const repository = new FailingFlagRepository();
    const getFlag = new GetFlag(repository);
    const handler = createHttpHandler(
      getFlag,
      new PutFlag(repository),
      new DeleteFlag(repository),
      new EvaluateFlag(getFlag),
      async () => null,
    );

    const response = await handler(
      new Request("https://edgeflags.test/flags/new-checkout"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      },
    });
  });

  it.each([
    ["GET", "/flags/new-checkout", "flags:evaluate"],
    ["PUT", "/flags/new-checkout", "flags:read"],
    ["DELETE", "/flags/new-checkout", "flags:read"],
    ["GET", "/evaluate/new-checkout", "flags:read"],
  ] as const)(
    "rejects %s %s when the client only has %s",
    async (method, path, grantedScope) => {
      const repository = new FailingFlagRepository();
      const getFlag = new GetFlag(repository);
      const handler = createHttpHandler(
        getFlag,
        new PutFlag(repository),
        new DeleteFlag(repository),
        new EvaluateFlag(getFlag),
        async () => ({
          principalId: "user:test",
          kind: "user",
          scopes: new Set([grantedScope]),
        }),
      );

      const response = await handler(
        new Request(`https://edgeflags.test${path}`, { method }),
        accessContext(),
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permission",
        },
      });
    },
  );
});

function accessContext(): CloudflareAccessContext {
  return {
    aud: "test-audience",
    getIdentity: async () => ({ user_uuid: "test" }),
  };
}

class FailingFlagRepository implements FlagRepository {
  find(_key: FlagKey): Promise<FeatureFlag | null> {
    return Promise.reject(new Error("provider details"));
  }

  save(_flag: FeatureFlag): Promise<void> {
    return Promise.reject(new Error("provider details"));
  }

  delete(_key: FlagKey): Promise<void> {
    return Promise.reject(new Error("provider details"));
  }
}
