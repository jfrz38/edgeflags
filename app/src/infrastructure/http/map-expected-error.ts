import { FlagNotFoundError } from "../../application/flag-not-found-error";
import { InvalidFlagKeyError } from "../../domain/invalid-flag-key-error";
import { errorResponse } from "./error-response";

export function mapExpectedError(error: unknown): Response {
  if (error instanceof InvalidFlagKeyError) {
    return errorResponse(400, "INVALID_FLAG_KEY", error.message);
  }
  if (error instanceof FlagNotFoundError) {
    return errorResponse(404, "FLAG_NOT_FOUND", error.message);
  }

  throw error;
}
