import { describe, expect, it } from "vitest";
import { DeleteFlag } from "../../src/application/delete-flag";
import { GetFlag } from "../../src/application/get-flag";
import { FlagKey } from "../../src/domain/flag-key";
import { FakeFlagRepository } from "./support/fake-flag-repository";

describe("DeleteFlag", () => {
  it("deletes an existing flag", async () => {
    const repository = new FakeFlagRepository();
    const key = FlagKey.create("new-checkout");
    await repository.save({ key, enabled: true });

    await new DeleteFlag(repository).dispatch(key);

    await expect(new GetFlag(repository).dispatch(key)).rejects.toThrow();
  });

  it("treats deleting an absent flag as successful", async () => {
    const deleteFlag = new DeleteFlag(new FakeFlagRepository());

    await expect(
      deleteFlag.dispatch(FlagKey.create("absent")),
    ).resolves.toBeUndefined();
  });
});
