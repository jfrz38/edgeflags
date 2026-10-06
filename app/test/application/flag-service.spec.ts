import { describe, expect, it } from "vitest";
import {
  FlagNotFoundError,
  FlagService,
  type FlagRepository,
} from "../../src/application/flag-service";
import type { FeatureFlag, FlagKey } from "../../src/domain/feature-flag";
import { FlagKey as Key } from "../../src/domain/feature-flag";

class FakeFlagRepository implements FlagRepository {
  private readonly flags = new Map<string, FeatureFlag>();

  async find(key: FlagKey): Promise<FeatureFlag | null> {
    return this.flags.get(key.value) ?? null;
  }

  async save(flag: FeatureFlag): Promise<void> {
    this.flags.set(flag.key.value, flag);
  }

  async delete(key: FlagKey): Promise<void> {
    this.flags.delete(key.value);
  }
}

describe("FlagService", () => {
  it("creates, replaces, evaluates, and deletes a flag", async () => {
    const service = new FlagService(new FakeFlagRepository());
    const key = Key.create("new-checkout");

    await expect(service.put(key, true)).resolves.toMatchObject({
      created: true,
      flag: { enabled: true },
    });
    await expect(service.evaluate(key)).resolves.toBe(true);

    await expect(service.put(key, false)).resolves.toMatchObject({
      created: false,
      flag: { enabled: false },
    });
    await expect(service.evaluate(key)).resolves.toBe(false);

    await service.delete(key);
    await expect(service.get(key)).rejects.toEqual(
      new FlagNotFoundError("new-checkout"),
    );
  });

  it("treats deleting an absent flag as successful", async () => {
    const service = new FlagService(new FakeFlagRepository());

    await expect(service.delete(Key.create("absent"))).resolves.toBeUndefined();
  });
});
