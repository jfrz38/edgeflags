import type { FeatureFlag } from "../domain/feature-flag";
import type { FlagKey } from "../domain/flag-key";

export interface FlagRepository {
  find(key: FlagKey): Promise<FeatureFlag | null>;
  save(flag: FeatureFlag): Promise<void>;
  delete(key: FlagKey): Promise<void>;
}
