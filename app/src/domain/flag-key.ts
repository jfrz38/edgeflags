import { InvalidFlagKeyError } from "./invalid-flag-key-error";

const FLAG_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class FlagKey {
  private constructor(readonly value: string) {}

  static create(value: string): FlagKey {
    if (!FLAG_KEY_PATTERN.test(value)) {
      throw new InvalidFlagKeyError();
    }

    return new FlagKey(value);
  }
}
