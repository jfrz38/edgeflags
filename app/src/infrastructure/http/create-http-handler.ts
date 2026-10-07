import type { DeleteFlag } from "../../application/delete-flag";
import type { EvaluateFlag } from "../../application/evaluate-flag";
import type { GetFlag } from "../../application/get-flag";
import type { PutFlag } from "../../application/put-flag";
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
) {
  return async (request: Request): Promise<Response> => {
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
          return await handleGetFlag(getFlag, flagRoute);
        }
        if (request.method === "PUT") {
          return await handlePutFlag(request, putFlag, flagRoute);
        }
        if (request.method === "DELETE") {
          return await handleDeleteFlag(deleteFlag, flagRoute);
        }

        return methodNotAllowed("GET, PUT, DELETE");
      }

      const evaluationRoute = matchKeyRoute(url.pathname, "/evaluate/");
      if (evaluationRoute !== null) {
        return request.method === "GET"
          ? await handleEvaluateFlag(evaluateFlag, evaluationRoute)
          : methodNotAllowed("GET");
      }

      return errorResponse(404, "ROUTE_NOT_FOUND", "Route not found");
    } catch {
      return errorResponse(500, "INTERNAL_ERROR", "An internal error occurred");
    }
  };
}
