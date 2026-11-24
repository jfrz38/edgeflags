import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coreRuntimeGlobalViolations,
  httpHandlerViolations,
  publicConceptViolations,
  repositoryViolations,
  useCaseViolations,
} from "./support/source-rules";
import { createTemporaryProject } from "./support/temporary-project";

const applicationRoot = resolve(".");

describe("source architecture conventions", () => {
  it.each([
    ["use cases", useCaseViolations],
    ["public concepts", publicConceptViolations],
    ["repository ports and adapters", repositoryViolations],
    ["core runtime independence", coreRuntimeGlobalViolations],
    ["HTTP operation handlers", httpHandlerViolations],
  ])("accepts the current %s", (_, rule) => {
    expect(rule(applicationRoot)).toEqual([]);
  });

  it("requires application classes to expose dispatch", async () => {
    await withProject(
      {
        "src/application/get-flag.ts":
          "export class GetFlag { execute(): void {} }\n",
      },
      (root) => expect(useCaseViolations(root)).toHaveLength(1),
    );
  });

  it("rejects a second public method on a use case", async () => {
    await withProject(
      {
        "src/application/get-flag.ts":
          "export class GetFlag { dispatch(): void {} inspect(): void {} }\n",
      },
      (root) => expect(useCaseViolations(root)).toHaveLength(1),
    );
  });

  it("requires public reusable concepts to have separate files", async () => {
    await withProject(
      {
        "src/domain/flags.ts":
          "export interface FeatureFlag {}\nexport type FlagValue = boolean;\n",
      },
      (root) => expect(publicConceptViolations(root)).toHaveLength(1),
    );
  });

  it("requires application repository ports to be interfaces", async () => {
    await withProject(
      {
        "src/application/flag-repository.ts":
          "export class FlagRepository {}\n",
      },
      (root) => expect(repositoryViolations(root)).toHaveLength(1),
    );
  });

  it("requires persistence repositories to implement a port", async () => {
    await withProject(
      {
        "src/infrastructure/persistence/kv-flag-repository.ts":
          "export class KvFlagRepository {}\n",
      },
      (root) => expect(repositoryViolations(root)).toHaveLength(1),
    );
  });

  it.each([
    "CloudflareAccessContext",
    "Env",
    "ExecutionContext",
    "ExportedHandler",
    "KVNamespace",
  ])("rejects runtime global %s in the core", async (runtimeType) => {
    await withProject(
      {
        "src/domain/leaking-domain.ts": `export type LeakingDomain = ${runtimeType};\n`,
      },
      (root) => expect(coreRuntimeGlobalViolations(root)).toHaveLength(1),
    );
  });

  it("limits an operation handler to one application module", async () => {
    await withProject(
      {
        "src/infrastructure/http/get-flag-handler.ts":
          'import type { GetFlag } from "../../application/get-flag";\nimport type { PutFlag } from "../../application/put-flag";\nexport function handle(get: GetFlag, put: PutFlag): void { void get; void put; }\n',
      },
      (root) => expect(httpHandlerViolations(root)).toHaveLength(1),
    );
  });
});

async function withProject(
  files: Record<string, string>,
  assertion: (root: string) => void,
): Promise<void> {
  const project = await createTemporaryProject();
  try {
    for (const [path, content] of Object.entries(files)) {
      await project.write(path, content);
    }
    assertion(project.root);
  } finally {
    await project.remove();
  }
}
