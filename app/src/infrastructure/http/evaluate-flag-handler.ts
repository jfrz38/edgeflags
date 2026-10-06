import type { EvaluateFlag } from "../../application/evaluate-flag";
import { mapExpectedError } from "./map-expected-error";
import { parseFlagKey } from "./parse-flag-key";

export async function handleEvaluateFlag(
  evaluateFlag: EvaluateFlag,
  rawKey: string,
): Promise<Response> {
  try {
    const key = parseFlagKey(rawKey);
    const value = await evaluateFlag.dispatch(key);
    return Response.json({ key: key.value, value });
  } catch (error) {
    return mapExpectedError(error);
  }
}
