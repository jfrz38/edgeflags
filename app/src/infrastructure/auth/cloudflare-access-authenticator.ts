import {
  isAccessScope,
  type AccessScope,
} from "../../application/access-scope";
import type {
  ClientAuthentication,
  ClientKind,
} from "../../application/client-authentication";

type AccessContext = Pick<CloudflareAccessContext, "getIdentity">;

type AccessAssertionVerifier = Readonly<{
  verify(
    assertion: string | null | undefined,
    audience: string,
  ): Promise<string | null>;
}>;

export class CloudflareAccessAuthenticator {
  private readonly scopesByPrincipal: ReadonlyMap<
    string,
    ReadonlySet<AccessScope>
  >;
  private readonly assertionVerifier?: AccessAssertionVerifier;

  constructor(
    serializedPolicy: string,
    assertionVerifier?: AccessAssertionVerifier,
  ) {
    this.scopesByPrincipal = parseAuthorizationPolicy(serializedPolicy);
    this.assertionVerifier = assertionVerifier;
  }

  async authenticate(
    access: (AccessContext & Pick<CloudflareAccessContext, "aud">) | undefined,
    assertion?: string | null,
  ): Promise<ClientAuthentication | null> {
    if (access === undefined) return null;

    const identity = await access.getIdentity();
    const identityPrincipals = resolveIdentityPrincipals(identity);
    if (identityPrincipals.length > 0) {
      const identityService = identityPrincipals.find(
        (principal) => principal.kind === "service",
      );
      if (identityService !== undefined && assertion) {
        const assertedClientId = await this.assertionVerifier?.verify(
          assertion,
          access.aud,
        );
        if (`service:${assertedClientId}` !== identityService.principalId) {
          return null;
        }
      }

      return this.authorizeFirst(identityPrincipals);
    }

    const assertedClientId = await this.assertionVerifier?.verify(
      assertion,
      access.aud,
    );
    return assertedClientId === null || assertedClientId === undefined
      ? null
      : this.authorizeFirst([
          { principalId: `service:${assertedClientId}`, kind: "service" },
        ]);
  }

  private authorizeFirst(
    principals: ReadonlyArray<{
      principalId: string;
      kind: ClientKind;
    }>,
  ): ClientAuthentication | null {
    for (const principal of principals) {
      const scopes = this.scopesByPrincipal.get(principal.principalId);
      if (scopes !== undefined) return { ...principal, scopes };
    }
    return null;
  }
}

function resolveIdentityPrincipals(
  identity: CloudflareAccessIdentity | undefined,
): Array<{ principalId: string; kind: ClientKind }> {
  const principals: Array<{ principalId: string; kind: ClientKind }> = [];
  const identityServiceTokenId = readNonEmptyString(identity?.service_token_id);
  if (identityServiceTokenId !== null) {
    return [
      {
        principalId: `service:${identityServiceTokenId}`,
        kind: "service",
      },
    ];
  }

  const userId = readNonEmptyString(identity?.user_uuid);
  if (userId !== null) {
    principals.push({ principalId: `user:${userId}`, kind: "user" });
  }

  const email = readNonEmptyString(identity?.email);
  if (email !== null) {
    principals.push({ principalId: `user:${email}`, kind: "user" });
  }

  return principals;
}

function parseAuthorizationPolicy(
  serializedPolicy: string,
): ReadonlyMap<string, ReadonlySet<AccessScope>> {
  let value: unknown;
  try {
    value = JSON.parse(serializedPolicy);
  } catch {
    throw new Error("Authorization policy must be valid JSON");
  }

  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new Error("Authorization policy must define at least one principal");
  }

  const entries = Object.entries(value).map(([principalId, scopes]) => {
    if (!isPrincipalId(principalId)) {
      throw new Error("Authorization policy contains an invalid principal");
    }
    if (
      !Array.isArray(scopes) ||
      scopes.length === 0 ||
      !scopes.every(isAccessScope) ||
      new Set(scopes).size !== scopes.length
    ) {
      throw new Error("Authorization policy contains invalid scopes");
    }

    return [principalId, new Set(scopes)] as const;
  });

  return new Map(entries);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrincipalId(value: string): boolean {
  return /^(user|service):[^\s:][^\s]*$/.test(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
