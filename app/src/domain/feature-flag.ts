const FLAG_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class InvalidFlagKeyError extends Error {
  constructor() {
    super(
      "Flag key must be 1 to 64 lowercase letters, numbers, or hyphens and start with a letter or number",
    );
    this.name = "InvalidFlagKeyError";
  }
}

export class FlagKey {
  private constructor(readonly value: string) {}

  static create(value: string): FlagKey {
    if (!FLAG_KEY_PATTERN.test(value)) {
      throw new InvalidFlagKeyError();
    }

    return new FlagKey(value);
  }
}

export interface FeatureFlag {
  readonly key: FlagKey;
  readonly enabled: boolean;
}
