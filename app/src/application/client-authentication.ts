import type { AccessScope } from "./access-scope";

export type ClientKind = "user" | "service";

export type ClientAuthentication = Readonly<{
  principalId: string;
  kind: ClientKind;
  scopes: ReadonlySet<AccessScope>;
}>;
