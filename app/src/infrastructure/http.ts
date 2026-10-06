import {
  FlagNotFoundError,
  type FlagService,
} from "../application/flag-service";
import { FlagKey, InvalidFlagKeyError } from "../domain/feature-flag";

const serviceStatus = {
  service: "edgeflags",
  status: "ok",
};

interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export function createHttpHandler(flagService: FlagService) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      if (request.method === "GET") {
        return Response.json(serviceStatus);
      }

      return methodNotAllowed("GET");
    }

    const flagRoute = matchKeyRoute(url.pathname, "/flags/");
    if (flagRoute !== null) {
      if (request.method === "GET") {
        return getFlag(flagService, flagRoute);
      }
      if (request.method === "PUT") {
        return putFlag(request, flagService, flagRoute);
      }
      if (request.method === "DELETE") {
        return deleteFlag(flagService, flagRoute);
      }

      return methodNotAllowed("GET, PUT, DELETE");
    }

    const evaluationRoute = matchKeyRoute(url.pathname, "/evaluate/");
    if (evaluationRoute !== null) {
      if (request.method === "GET") {
        return evaluateFlag(flagService, evaluationRoute);
      }

      return methodNotAllowed("GET");
    }

    return errorResponse(404, "ROUTE_NOT_FOUND", "Route not found");
  };
}

async function getFlag(
  service: FlagService,
  rawKey: string,
): Promise<Response> {
  try {
    const flag = await service.get(parseKey(rawKey));
    return Response.json({ key: flag.key.value, enabled: flag.enabled });
  } catch (error) {
    return mapExpectedError(error);
  }
}

async function putFlag(
  request: Request,
  service: FlagService,
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
    const key = parseKey(rawKey);
    const result = await service.put(key, body.enabled);
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

async function deleteFlag(
  service: FlagService,
  rawKey: string,
): Promise<Response> {
  try {
    await service.delete(parseKey(rawKey));
    return new Response(null, { status: 204 });
  } catch (error) {
    return mapExpectedError(error);
  }
}

async function evaluateFlag(
  service: FlagService,
  rawKey: string,
): Promise<Response> {
  try {
    const key = parseKey(rawKey);
    const value = await service.evaluate(key);
    return Response.json({ key: key.value, value });
  } catch (error) {
    return mapExpectedError(error);
  }
}

function matchKeyRoute(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const rawKey = pathname.slice(prefix.length);
  return rawKey.length > 0 && !rawKey.includes("/") ? rawKey : null;
}

function parseKey(rawKey: string): FlagKey {
  try {
    return FlagKey.create(decodeURIComponent(rawKey));
  } catch (error) {
    if (error instanceof InvalidFlagKeyError) {
      throw error;
    }
    throw new InvalidFlagKeyError();
  }
}

function isPutFlagBody(body: unknown): body is { enabled: boolean } {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 1 &&
    "enabled" in body &&
    typeof body.enabled === "boolean"
  );
}

function mapExpectedError(error: unknown): Response {
  if (error instanceof InvalidFlagKeyError) {
    return errorResponse(400, "INVALID_FLAG_KEY", error.message);
  }
  if (error instanceof FlagNotFoundError) {
    return errorResponse(404, "FLAG_NOT_FOUND", error.message);
  }

  throw error;
}

function methodNotAllowed(allow: string): Response {
  const response = errorResponse(
    405,
    "METHOD_NOT_ALLOWED",
    "Method not allowed",
  );
  response.headers.set("Allow", allow);
  return response;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  const body: ErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}
