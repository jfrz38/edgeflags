import { DeleteFlag } from "./application/delete-flag";
import { EvaluateFlag } from "./application/evaluate-flag";
import { GetFlag } from "./application/get-flag";
import { PutFlag } from "./application/put-flag";
import { createHttpHandler } from "./infrastructure/http/create-http-handler";
import { KvFlagRepository } from "./infrastructure/persistence/kv-flag-repository";

export default {
  fetch(request, env): Promise<Response> {
    const repository = new KvFlagRepository(env.FLAGS_KV);
    const getFlag = new GetFlag(repository);
    const handleRequest = createHttpHandler(
      getFlag,
      new PutFlag(repository),
      new DeleteFlag(repository),
      new EvaluateFlag(getFlag),
    );

    return handleRequest(request);
  },
} satisfies ExportedHandler<Env>;
