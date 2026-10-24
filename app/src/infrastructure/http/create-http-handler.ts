import type { DeleteFlag } from "../../application/delete-flag";
import type { EvaluateFlag } from "../../application/evaluate-flag";
import type { GetFlag } from "../../application/get-flag";
import type { PutFlag } from "../../application/put-flag";
import type { AccessScope } from "../../application/access-scope";
import type { ClientAuthentication } from "../../application/client-authentication";
import { handleDeleteFlag } from "./delete-flag-handler";
import { errorResponse } from "./error-response";
import { handleEvaluateFlag } from "./evaluate-flag-handler";
import { handleGetFlag } from "./get-flag-handler";
import { handleGetServiceStatus } from "./get-service-status-handler";
import { matchKeyRoute } from "./match-key-route";
import { methodNotAllowed } from "./method-not-allowed";
import { handlePutFlag } from "./put-flag-handler";

export function createHttpHandler(
  getFlag: GetFlag,
  putFlag: PutFlag,
  deleteFlag: DeleteFlag,
  evaluateFlag: EvaluateFlag,
  authenticate: (
    access: CloudflareAccessContext | undefined,
  ) => Promise<ClientAuthentication | null>,
  securityEnabled = true,
) {
  return async (
    request: Request,
    access?: CloudflareAccessContext,
  ): Promise<Response> => {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/") {
        return request.method === "GET"
          ? handleGetServiceStatus()
          : methodNotAllowed("GET");
      }

      const flagRoute = matchKeyRoute(url.pathname, "/flags/");
      if (flagRoute !== null) {
        if (request.method === "GET") {
          const denial = await authorize(
            authenticate,
            access,
            "flags:read",
            securityEnabled,
          );
          if (denial !== null) return denial;
          return await handleGetFlag(getFlag, flagRoute);
        }
        if (request.method === "PUT") {
          const denial = await authorize(
            authenticate,
            access,
            "flags:write",
            securityEnabled,
          );
          if (denial !== null) return denial;
          return await handlePutFlag(request, putFlag, flagRoute);
        }
        if (request.method === "DELETE") {
          const denial = await authorize(
            authenticate,
            access,
            "flags:write",
            securityEnabled,
          );
          if (denial !== null) return denial;
          return await handleDeleteFlag(deleteFlag, flagRoute);
        }

        return methodNotAllowed("GET, PUT, DELETE");
      }

      const evaluationRoute = matchKeyRoute(url.pathname, "/evaluate/");
      if (evaluationRoute !== null) {
        if (request.method !== "GET") return methodNotAllowed("GET");

        const denial = await authorize(
          authenticate,
          access,
          "flags:evaluate",
          securityEnabled,
        );
        return (
          denial ?? (await handleEvaluateFlag(evaluateFlag, evaluationRoute))
        );
      }

      return errorResponse(404, "ROUTE_NOT_FOUND", "Route not found");
    } catch {
      return errorResponse(500, "INTERNAL_ERROR", "An internal error occurred");
    }
  };
}

async function authorize(
  authenticate: (
    access: CloudflareAccessContext | undefined,
  ) => Promise<ClientAuthentication | null>,
  access: CloudflareAccessContext | undefined,
  requiredScope: AccessScope,
  securityEnabled: boolean,
): Promise<Response | null> {
  if (!securityEnabled) return null;

  if (access === undefined) {
    return errorResponse(401, "UNAUTHENTICATED", "Authentication required");
  }

  const client = await authenticate(access);
  if (client === null || !client.scopes.has(requiredScope)) {
    return errorResponse(403, "FORBIDDEN", "Insufficient permission");
  }

  return null;
}
