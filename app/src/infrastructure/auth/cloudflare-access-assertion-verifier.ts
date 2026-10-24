import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

const keySetsByIssuer = new Map<string, JWTVerifyGetKey>();

const invalidAssertionCodes = new Set([
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
]);

export class CloudflareAccessAssertionVerifier {
  private readonly issuer: string;
  private readonly keySet: JWTVerifyGetKey;

  constructor(issuer: string, keySet?: JWTVerifyGetKey) {
    this.issuer = normalizeAccessIssuer(issuer);
    this.keySet = keySet ?? getRemoteKeySet(this.issuer);
  }

  async verify(
    assertion: string | null | undefined,
    audience: string,
  ): Promise<string | null> {
    if (!assertion || !audience) return null;

    try {
      const { payload } = await jwtVerify(assertion, this.keySet, {
        algorithms: ["RS256"],
        audience,
        issuer: this.issuer,
      });

      if (payload.type !== "app" || payload.sub !== "") return null;
      return readNonEmptyString(payload.common_name);
    } catch (error) {
      if (
        error instanceof errors.JOSEError &&
        invalidAssertionCodes.has(error.code)
      ) {
        return null;
      }
      throw error;
    }
  }
}

function getRemoteKeySet(issuer: string): JWTVerifyGetKey {
  const cached = keySetsByIssuer.get(issuer);
  if (cached !== undefined) return cached;

  const keySet = createRemoteJWKSet(
    new URL("/cdn-cgi/access/certs", `${issuer}/`),
  );
  keySetsByIssuer.set(issuer, keySet);
  return keySet;
}

function normalizeAccessIssuer(value: string): string {
  let issuer: URL;
  try {
    issuer = new URL(value);
  } catch {
    throw new Error("Access issuer must be a valid URL");
  }

  if (
    issuer.protocol !== "https:" ||
    issuer.port !== "" ||
    issuer.username !== "" ||
    issuer.password !== "" ||
    !issuer.hostname.endsWith(".cloudflareaccess.com") ||
    issuer.pathname !== "/" ||
    issuer.search !== "" ||
    issuer.hash !== ""
  ) {
    throw new Error("Access issuer must be a Cloudflare Access HTTPS origin");
  }

  return issuer.origin;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
