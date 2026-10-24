import { describe, expect, it } from "vitest";
import { FlagNotFoundError } from "../../src/application/flag-not-found-error";
import { GetFlag } from "../../src/application/get-flag";
import { FlagKey } from "../../src/domain/flag-key";
import { FakeFlagRepository } from "./support/fake-flag-repository";

describe("GetFlag", () => {
  it("returns an existing flag", async () => {
    const repository = new FakeFlagRepository();
    const key = FlagKey.create("new-checkout");
    await repository.save({ key, enabled: true });

    await expect(new GetFlag(repository).dispatch(key)).resolves.toEqual({
      key,
      enabled: true,
    });
  });

  it("rejects an absent flag", async () => {
    const getFlag = new GetFlag(new FakeFlagRepository());

    await expect(getFlag.dispatch(FlagKey.create("absent"))).rejects.toEqual(
      new FlagNotFoundError("absent"),
    );
  });
});
