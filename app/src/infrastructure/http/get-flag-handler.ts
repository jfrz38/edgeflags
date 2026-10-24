import type { GetFlag } from "../../application/get-flag";
import { mapExpectedError } from "./map-expected-error";
import { parseFlagKey } from "./parse-flag-key";

export async function handleGetFlag(
  getFlag: GetFlag,
  rawKey: string,
): Promise<Response> {
  try {
    const flag = await getFlag.dispatch(parseFlagKey(rawKey));
    return Response.json({ key: flag.key.value, enabled: flag.enabled });
  } catch (error) {
    return mapExpectedError(error);
  }
}
