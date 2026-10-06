import type { PutFlagBody } from "./put-flag-body";

export function isPutFlagBody(body: unknown): body is PutFlagBody {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 1 &&
    "enabled" in body &&
    typeof body.enabled === "boolean"
  );
}
