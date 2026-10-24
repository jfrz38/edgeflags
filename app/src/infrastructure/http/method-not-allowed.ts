import { errorResponse } from "./error-response";

export function methodNotAllowed(allow: string): Response {
  const response = errorResponse(
    405,
    "METHOD_NOT_ALLOWED",
    "Method not allowed",
  );
  response.headers.set("Allow", allow);
  return response;
}
