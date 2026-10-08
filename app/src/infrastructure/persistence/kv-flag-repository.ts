import type { FlagRepository } from "../../application/flag-repository";
import type { FeatureFlag } from "../../domain/feature-flag";
import { FlagKey } from "../../domain/flag-key";
import { InvalidPersistedFlagError } from "./invalid-persisted-flag-error";

interface PersistedFlagV1 {
  version: 1;
  key: string;
  enabled: boolean;
}

export class KvFlagRepository implements FlagRepository {
  constructor(private readonly namespace: KVNamespace) {}

  async find(key: FlagKey): Promise<FeatureFlag | null> {
    const value = await this.namespace.get(storageKey(key));
    if (value === null) {
      return null;
    }

    const persistedFlag = parsePersistedFlag(value);
    if (persistedFlag.key !== key.value) {
      throw new InvalidPersistedFlagError();
    }

    return {
      key: FlagKey.create(persistedFlag.key),
      enabled: persistedFlag.enabled,
    };
  }

  async save(flag: FeatureFlag): Promise<void> {
    const persistedFlag: PersistedFlagV1 = {
      version: 1,
      key: flag.key.value,
      enabled: flag.enabled,
    };

    await this.namespace.put(
      storageKey(flag.key),
      JSON.stringify(persistedFlag),
    );
  }

  async delete(key: FlagKey): Promise<void> {
    await this.namespace.delete(storageKey(key));
  }
}

function storageKey(key: FlagKey): string {
  return `flags:${key.value}`;
}

function parsePersistedFlag(value: string): PersistedFlagV1 {
  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    throw new InvalidPersistedFlagError();
  }

  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    throw new InvalidPersistedFlagError();
  }

  const keys = Object.keys(candidate);
  if (
    keys.length !== 3 ||
    !keys.includes("version") ||
    !keys.includes("key") ||
    !keys.includes("enabled") ||
    !("version" in candidate) ||
    candidate.version !== 1 ||
    !("key" in candidate) ||
    typeof candidate.key !== "string" ||
    !("enabled" in candidate) ||
    typeof candidate.enabled !== "boolean"
  ) {
    throw new InvalidPersistedFlagError();
  }

  return {
    version: 1,
    key: candidate.key,
    enabled: candidate.enabled,
  };
}
