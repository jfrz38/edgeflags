import { DeleteFlag } from "./application/delete-flag";
import { EvaluateFlag } from "./application/evaluate-flag";
import { GetFlag } from "./application/get-flag";
import { PutFlag } from "./application/put-flag";
import { CloudflareAccessAssertionVerifier } from "./infrastructure/auth/cloudflare-access-assertion-verifier";
import { CloudflareAccessAuthenticator } from "./infrastructure/auth/cloudflare-access-authenticator";
import { createHttpHandler } from "./infrastructure/http/create-http-handler";
import { KvFlagRepository } from "./infrastructure/persistence/kv-flag-repository";

type RuntimeEnv = Env & {
  ACCESS_ENFORCEMENT_ENABLED?: string;
  ACCESS_ISSUER?: string;
  AUTHORIZATION_POLICY?: string;
};

export default {
  fetch(request, env, ctx): Promise<Response> {
    const repository = new KvFlagRepository(env.FLAGS_KV);
    const getFlag = new GetFlag(repository);
    const securityEnabled = env.ACCESS_ENFORCEMENT_ENABLED === "true";
    const handleRequest = createHttpHandler(
      getFlag,
      new PutFlag(repository),
      new DeleteFlag(repository),
      new EvaluateFlag(getFlag),
      async (access) => {
        if (!securityEnabled) return null;
        const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
        return new CloudflareAccessAuthenticator(
          env.AUTHORIZATION_POLICY ?? "",
          assertion === null
            ? undefined
            : new CloudflareAccessAssertionVerifier(env.ACCESS_ISSUER ?? ""),
        ).authenticate(access, assertion);
      },
      securityEnabled,
    );

    return handleRequest(request, ctx.access);
  },
} satisfies ExportedHandler<RuntimeEnv>;
