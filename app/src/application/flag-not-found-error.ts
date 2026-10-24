export class FlagNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Flag '${key}' was not found`);
    this.name = "FlagNotFoundError";
  }
}
