export class InvalidPersistedFlagError extends Error {
  constructor() {
    super("Persisted flag data is invalid or unsupported");
    this.name = "InvalidPersistedFlagError";
  }
}
