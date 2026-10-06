import { describe, expect, it } from "vitest";
import { PutFlag } from "../../src/application/put-flag";
import { FlagKey } from "../../src/domain/flag-key";
import { FakeFlagRepository } from "./support/fake-flag-repository";

describe("PutFlag", () => {
  it("creates an absent flag", async () => {
    const repository = new FakeFlagRepository();
    const putFlag = new PutFlag(repository);

    await expect(
      putFlag.dispatch(FlagKey.create("new-checkout"), true),
    ).resolves.toMatchObject({ created: true, flag: { enabled: true } });
  });

  it("replaces an existing flag", async () => {
    const repository = new FakeFlagRepository();
    const putFlag = new PutFlag(repository);
    const key = FlagKey.create("new-checkout");
    await putFlag.dispatch(key, true);

    await expect(putFlag.dispatch(key, false)).resolves.toMatchObject({
      created: false,
      flag: { enabled: false },
    });
  });
});
