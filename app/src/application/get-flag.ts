import type { FeatureFlag } from "../domain/feature-flag";
import type { FlagKey } from "../domain/flag-key";
import { FlagNotFoundError } from "./flag-not-found-error";
import type { FlagRepository } from "./flag-repository";

export class GetFlag {
  constructor(private readonly repository: FlagRepository) {}

  async dispatch(key: FlagKey): Promise<FeatureFlag> {
    const flag = await this.repository.find(key);

    if (flag === null) {
      throw new FlagNotFoundError(key.value);
    }

    return flag;
  }
}
