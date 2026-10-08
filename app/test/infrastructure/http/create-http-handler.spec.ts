import { describe, expect, it } from "vitest";
import { DeleteFlag } from "../../../src/application/delete-flag";
import { EvaluateFlag } from "../../../src/application/evaluate-flag";
import type { FlagRepository } from "../../../src/application/flag-repository";
import { GetFlag } from "../../../src/application/get-flag";
import { PutFlag } from "../../../src/application/put-flag";
import type { FeatureFlag } from "../../../src/domain/feature-flag";
import type { FlagKey } from "../../../src/domain/flag-key";
import { createHttpHandler } from "../../../src/infrastructure/http/create-http-handler";

describe("createHttpHandler", () => {
  it("hides unexpected storage failures", async () => {
    const repository = new FailingFlagRepository();
    const getFlag = new GetFlag(repository);
    const handler = createHttpHandler(
      getFlag,
      new PutFlag(repository),
      new DeleteFlag(repository),
      new EvaluateFlag(getFlag),
    );

    const response = await handler(
      new Request("https://edgeflags.test/flags/new-checkout"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  });
});

class FailingFlagRepository implements FlagRepository {
  find(_key: FlagKey): Promise<FeatureFlag | null> {
    return Promise.reject(new Error("provider details"));
  }

  save(_flag: FeatureFlag): Promise<void> {
    return Promise.reject(new Error("provider details"));
  }

  delete(_key: FlagKey): Promise<void> {
    return Promise.reject(new Error("provider details"));
  }
}
