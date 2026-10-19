import { DeleteFlag } from "./application/delete-flag";
import { EvaluateFlag } from "./application/evaluate-flag";
import { GetFlag } from "./application/get-flag";
import { PutFlag } from "./application/put-flag";
import { CloudflareAccessAuthenticator } from "./infrastructure/auth/cloudflare-access-authenticator";
import { createHttpHandler } from "./infrastructure/http/create-http-handler";
import { KvFlagRepository } from "./infrastructure/persistence/kv-flag-repository";

type RuntimeEnv = Env & {
  ACCESS_ENFORCEMENT_ENABLED?: string;
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
        return new CloudflareAccessAuthenticator(
          env.AUTHORIZATION_POLICY ?? "",
        ).authenticate(access, request.headers.get("CF-Access-Client-Id"));
      },
      securityEnabled,
    );

    return handleRequest(request, ctx.access);
  },
} satisfies ExportedHandler<RuntimeEnv>;
