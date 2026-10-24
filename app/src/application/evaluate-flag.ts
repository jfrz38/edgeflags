import type { FlagKey } from "../domain/flag-key";
import type { GetFlag } from "./get-flag";

export class EvaluateFlag {
  constructor(private readonly getFlag: GetFlag) {}

  async dispatch(key: FlagKey): Promise<boolean> {
    return (await this.getFlag.dispatch(key)).enabled;
  }
}
