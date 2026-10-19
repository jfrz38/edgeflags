import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { CloudflareAccessAssertionVerifier } from "../../../src/infrastructure/auth/cloudflare-access-assertion-verifier";

const issuer = "https://edgeflags.cloudflareaccess.com";
const audience = "edgeflags-audience";
const keyId = "test-key";

let privateKey: CryptoKey;
let publicJwk: JWK;

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  publicJwk = {
    ...(await exportJWK(keyPair.publicKey)),
    alg: "RS256",
    kid: keyId,
  };
});

describe("CloudflareAccessAssertionVerifier", () => {
  it("returns the Service Token Client ID from a valid assertion", async () => {
    const verifier = verifierFor(publicJwk);

    await expect(verifier.verify(await assertion(), audience)).resolves.toBe(
      "service-client.access",
    );
  });

  it.each([
    [
      "unexpected issuer",
      { tokenIssuer: "https://other.cloudflareaccess.com" },
    ],
    ["unexpected audience", { tokenAudience: "other-audience" }],
    ["expired assertion", { expirationTime: "0s" }],
    ["not-yet-valid assertion", { notBefore: "5m" }],
    ["non-application token", { type: "org" }],
    ["non-empty service subject", { subject: "user-id" }],
    ["missing client ID", { commonName: null }],
  ] as const)("rejects an assertion with %s", async (_name, options) => {
    const verifier = verifierFor(publicJwk);

    await expect(
      verifier.verify(await assertion(options), audience),
    ).resolves.toBeNull();
  });

  it("rejects an assertion with an invalid signature", async () => {
    const otherKeyPair = await generateKeyPair("RS256");
    const verifier = verifierFor(publicJwk);

    await expect(
      verifier.verify(
        await assertion({ signingKey: otherKeyPair.privateKey }),
        audience,
      ),
    ).resolves.toBeNull();
  });

  it("rejects an unsupported signing algorithm", async () => {
    const verifier = verifierFor(publicJwk);
    const token = await new SignJWT({
      common_name: "service-client.access",
      sub: "",
      type: "app",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("a-secret-long-enough-for-testing"));

    await expect(verifier.verify(token, audience)).resolves.toBeNull();
  });

  it("rejects a missing or malformed assertion", async () => {
    const verifier = verifierFor(publicJwk);

    await expect(verifier.verify(null, audience)).resolves.toBeNull();
    await expect(verifier.verify("not-a-jwt", audience)).resolves.toBeNull();
  });

  it("surfaces key-provider failures", async () => {
    const verifier = new CloudflareAccessAssertionVerifier(issuer, async () => {
      throw new Error("key provider unavailable");
    });

    await expect(verifier.verify(await assertion(), audience)).rejects.toThrow(
      "key provider unavailable",
    );
  });

  it.each([
    "not-a-url",
    "http://edgeflags.cloudflareaccess.com",
    "https://example.com",
    "https://edgeflags.cloudflareaccess.com/path",
    "https://edgeflags.cloudflareaccess.com?query=true",
  ])("rejects invalid issuer %s", (invalidIssuer) => {
    expect(() => new CloudflareAccessAssertionVerifier(invalidIssuer)).toThrow(
      "Access issuer",
    );
  });
});

function verifierFor(jwk: JWK): CloudflareAccessAssertionVerifier {
  return new CloudflareAccessAssertionVerifier(
    issuer,
    createLocalJWKSet({ keys: [jwk] }),
  );
}

async function assertion({
  commonName = "service-client.access",
  expirationTime = "5m",
  notBefore,
  signingKey = privateKey,
  subject = "",
  tokenAudience = audience,
  tokenIssuer = issuer,
  type = "app",
}: {
  commonName?: string | null;
  expirationTime?: string;
  notBefore?: string;
  signingKey?: CryptoKey;
  subject?: string;
  tokenAudience?: string;
  tokenIssuer?: string;
  type?: string;
} = {}): Promise<string> {
  const token = new SignJWT({
    ...(commonName === null ? {} : { common_name: commonName }),
    sub: subject,
    type,
  })
    .setProtectedHeader({ alg: "RS256", kid: keyId })
    .setIssuer(tokenIssuer)
    .setAudience(tokenAudience)
    .setIssuedAt()
    .setExpirationTime(expirationTime);

  if (notBefore !== undefined) token.setNotBefore(notBefore);
  return token.sign(signingKey);
}
