export class InvalidFlagKeyError extends Error {
  constructor() {
    super(
      "Flag key must be 1 to 64 lowercase letters, numbers, or hyphens and start with a letter or number",
    );
    this.name = "InvalidFlagKeyError";
  }
}
