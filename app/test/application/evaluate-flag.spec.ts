import { describe, expect, it } from "vitest";
import { EvaluateFlag } from "../../src/application/evaluate-flag";
import { GetFlag } from "../../src/application/get-flag";
import { FlagKey } from "../../src/domain/flag-key";
import { FakeFlagRepository } from "./support/fake-flag-repository";

describe("EvaluateFlag", () => {
  it.each([true, false])("returns the stored %s value", async (enabled) => {
    const repository = new FakeFlagRepository();
    const key = FlagKey.create("new-checkout");
    await repository.save({ key, enabled });
    const evaluateFlag = new EvaluateFlag(new GetFlag(repository));

    await expect(evaluateFlag.dispatch(key)).resolves.toBe(enabled);
  });
});
