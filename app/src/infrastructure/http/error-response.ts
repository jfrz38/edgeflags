import type { ErrorBody } from "./error-body";

export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  const body: ErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}
