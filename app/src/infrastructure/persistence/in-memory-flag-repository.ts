import type { FlagRepository } from "../../application/flag-repository";
import type { FeatureFlag } from "../../domain/feature-flag";
import type { FlagKey } from "../../domain/flag-key";

export class InMemoryFlagRepository implements FlagRepository {
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
