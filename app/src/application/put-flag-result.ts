import type { FeatureFlag } from "../domain/feature-flag";

export interface PutFlagResult {
  readonly flag: FeatureFlag;
  readonly created: boolean;
}
