export const accessScopes = [
  "flags:read",
  "flags:write",
  "flags:evaluate",
] as const;

export type AccessScope = (typeof accessScopes)[number];

export function isAccessScope(value: unknown): value is AccessScope {
  return accessScopes.includes(value as AccessScope);
}
