import type { FlagRepository } from "../application/flag-service";
import type { FeatureFlag, FlagKey } from "../domain/feature-flag";

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
