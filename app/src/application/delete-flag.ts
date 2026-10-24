import type { FlagKey } from "../domain/flag-key";
import type { FlagRepository } from "./flag-repository";

export class DeleteFlag {
  constructor(private readonly repository: FlagRepository) {}

  async dispatch(key: FlagKey): Promise<void> {
    await this.repository.delete(key);
  }
}
