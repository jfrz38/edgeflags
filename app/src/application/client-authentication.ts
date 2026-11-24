import type { AccessScope } from "./access-scope";
import type { ClientKind } from "./client-kind";

export type ClientAuthentication = Readonly<{
  principalId: string;
  kind: ClientKind;
  scopes: ReadonlySet<AccessScope>;
}>;
