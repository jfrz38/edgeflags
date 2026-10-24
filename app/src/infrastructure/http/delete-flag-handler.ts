import type { DeleteFlag } from "../../application/delete-flag";
import { mapExpectedError } from "./map-expected-error";
import { parseFlagKey } from "./parse-flag-key";

export async function handleDeleteFlag(
  deleteFlag: DeleteFlag,
  rawKey: string,
): Promise<Response> {
  try {
    await deleteFlag.dispatch(parseFlagKey(rawKey));
    return new Response(null, { status: 204 });
  } catch (error) {
    return mapExpectedError(error);
  }
}
