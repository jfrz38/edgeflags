import { DeleteFlag } from "./application/delete-flag";
import { EvaluateFlag } from "./application/evaluate-flag";
import { GetFlag } from "./application/get-flag";
import { PutFlag } from "./application/put-flag";
import { createHttpHandler } from "./infrastructure/http/create-http-handler";
import { InMemoryFlagRepository } from "./infrastructure/persistence/in-memory-flag-repository";

const repository = new InMemoryFlagRepository();
const getFlag = new GetFlag(repository);
const handleRequest = createHttpHandler(
  getFlag,
  new PutFlag(repository),
  new DeleteFlag(repository),
  new EvaluateFlag(getFlag),
);

export default {
  fetch(request): Promise<Response> {
    return handleRequest(request);
  },
} satisfies ExportedHandler<Env>;
