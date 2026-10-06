import type { FeatureFlag } from "../domain/feature-flag";
import type { FlagKey } from "../domain/flag-key";
import type { FlagRepository } from "./flag-repository";
import type { PutFlagResult } from "./put-flag-result";

export class PutFlag {
  constructor(private readonly repository: FlagRepository) {}

  async dispatch(key: FlagKey, enabled: boolean): Promise<PutFlagResult> {
    const created = (await this.repository.find(key)) === null;
    const flag: FeatureFlag = { key, enabled };

    await this.repository.save(flag);

    return { flag, created };
  }
}
