import { describe, expect, it } from "vitest";
import { FlagKey, InvalidFlagKeyError } from "../../src/domain/feature-flag";

describe("FlagKey", () => {
  it.each(["a", "new-checkout", "flag-123", "a".repeat(64)])(
    "accepts the valid key %s",
    (value) => {
      expect(FlagKey.create(value).value).toBe(value);
    },
  );

  it.each(["", "New-checkout", "new_checkout", "-flag", "a".repeat(65)])(
    "rejects the invalid key %s",
    (value) => {
      expect(() => FlagKey.create(value)).toThrow(InvalidFlagKeyError);
    },
  );
});
