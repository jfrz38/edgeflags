import { FlagService } from "./application/flag-service";
import { createHttpHandler } from "./infrastructure/http";
import { InMemoryFlagRepository } from "./infrastructure/in-memory-flag-repository";

const handleRequest = createHttpHandler(
  new FlagService(new InMemoryFlagRepository()),
);

export default {
  fetch(request): Promise<Response> {
    return handleRequest(request);
  },
} satisfies ExportedHandler<Env>;
