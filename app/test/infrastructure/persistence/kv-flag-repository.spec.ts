import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { FlagKey } from "../../../src/domain/flag-key";
import { InvalidPersistedFlagError } from "../../../src/infrastructure/persistence/invalid-persisted-flag-error";
import { KvFlagRepository } from "../../../src/infrastructure/persistence/kv-flag-repository";

describe("KvFlagRepository", () => {
  it.each([true, false])(
    "persists and reconstitutes a flag enabled=%s",
    async (enabled) => {
      const key = FlagKey.create("new-checkout");
      await new KvFlagRepository(env.FLAGS_KV).save({ key, enabled });

      await expect(
        new KvFlagRepository(env.FLAGS_KV).find(key),
      ).resolves.toEqual({ key, enabled });
      await expect(env.FLAGS_KV.get("flags:new-checkout")).resolves.toBe(
        JSON.stringify({ version: 1, key: "new-checkout", enabled }),
      );
    },
  );

  it("deletes a flag idempotently", async () => {
    const repository = new KvFlagRepository(env.FLAGS_KV);
    const key = FlagKey.create("retired-flag");
    await repository.save({ key, enabled: true });

    await repository.delete(key);
    await repository.delete(key);

    await expect(repository.find(key)).resolves.toBeNull();
  });

  it.each([
    ["invalid JSON", "{"],
    [
      "an unsupported version",
      JSON.stringify({ version: 2, key: "stored-flag", enabled: true }),
    ],
    [
      "an unexpected field",
      JSON.stringify({
        version: 1,
        key: "stored-flag",
        enabled: true,
        extra: true,
      }),
    ],
    [
      "a different embedded key",
      JSON.stringify({ version: 1, key: "other-flag", enabled: true }),
    ],
  ])("rejects %s", async (_description, value) => {
    await env.FLAGS_KV.put("flags:stored-flag", value);

    await expect(
      new KvFlagRepository(env.FLAGS_KV).find(FlagKey.create("stored-flag")),
    ).rejects.toEqual(new InvalidPersistedFlagError());
  });
});
