import type { FlagKey } from "./flag-key";

export interface FeatureFlag {
  readonly key: FlagKey;
  readonly enabled: boolean;
}
