import type { FeatureFlag, FlagKey } from "../domain/feature-flag";

export interface FlagRepository {
  find(key: FlagKey): Promise<FeatureFlag | null>;
  save(flag: FeatureFlag): Promise<void>;
  delete(key: FlagKey): Promise<void>;
}

export class FlagNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Flag '${key}' was not found`);
    this.name = "FlagNotFoundError";
  }
}

export interface PutFlagResult {
  readonly flag: FeatureFlag;
  readonly created: boolean;
}

export class FlagService {
  constructor(private readonly repository: FlagRepository) {}

  async put(key: FlagKey, enabled: boolean): Promise<PutFlagResult> {
    const created = (await this.repository.find(key)) === null;
    const flag = { key, enabled };

    await this.repository.save(flag);

    return { flag, created };
  }

  async get(key: FlagKey): Promise<FeatureFlag> {
    const flag = await this.repository.find(key);

    if (flag === null) {
      throw new FlagNotFoundError(key.value);
    }

    return flag;
  }

  async delete(key: FlagKey): Promise<void> {
    await this.repository.delete(key);
  }

  async evaluate(key: FlagKey): Promise<boolean> {
    return (await this.get(key)).enabled;
  }
}
