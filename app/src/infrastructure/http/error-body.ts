export interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
