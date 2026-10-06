import type { PutFlag } from "../../application/put-flag";
import { errorResponse } from "./error-response";
import { isPutFlagBody } from "./is-put-flag-body";
import { mapExpectedError } from "./map-expected-error";
import { parseFlagKey } from "./parse-flag-key";

export async function handlePutFlag(
  request: Request,
  putFlag: PutFlag,
  rawKey: string,
): Promise<Response> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0].trim() !==
    "application/json"
  ) {
    return errorResponse(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Request body must be valid JSON",
    );
  }

  if (!isPutFlagBody(body)) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Request body must contain only a boolean 'enabled' property",
    );
  }

  try {
    const result = await putFlag.dispatch(parseFlagKey(rawKey), body.enabled);
    const response = Response.json(
      { key: result.flag.key.value, enabled: result.flag.enabled },
      { status: result.created ? 201 : 200 },
    );

    if (result.created) {
      response.headers.set("Location", `/flags/${result.flag.key.value}`);
    }

    return response;
  } catch (error) {
    return mapExpectedError(error);
  }
}
