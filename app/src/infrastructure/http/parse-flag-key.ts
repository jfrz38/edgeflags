import { FlagKey } from "../../domain/flag-key";
import { InvalidFlagKeyError } from "../../domain/invalid-flag-key-error";

export function parseFlagKey(rawKey: string): FlagKey {
  try {
    return FlagKey.create(decodeURIComponent(rawKey));
  } catch (error) {
    if (error instanceof InvalidFlagKeyError) {
      throw error;
    }
    throw new InvalidFlagKeyError();
  }
}
