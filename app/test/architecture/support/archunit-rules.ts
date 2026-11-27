import { readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, resolve } from "node:path";
import { projectFiles, type Violation } from "archunit";
import { ImportType, init, parse } from "es-module-lexer";

type ImportPredicate = (specifier: string) => boolean;

export function infrastructureIsolationRule(
  tsconfig: string,
  source: string,
  forbiddenTargets: string[],
): Promise<Violation[]> {
  return Promise.all(
    forbiddenTargets.map((target) =>
      projectFiles(tsconfig)
        .inFolder(`src/infrastructure/${source}/**`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`src/infrastructure/${target}/**`)
        .check({ clearCache: true }),
    ),
  ).then((violations) => violations.flat());
}

export async function corePurityRule(
  tsconfig: string,
  isForbidden: ImportPredicate,
  message: string,
): Promise<Violation[]> {
  await init;

  const projectRoot = dirname(tsconfig);

  const violations = await Promise.all(
    ["domain", "application"].map((layer) =>
      projectFiles(tsconfig)
        .inFolder(`src/${layer}/**`)
        .should()
        .adhereTo(
          ({ path }) =>
            importedModules(
              readFileSync(resolve(projectRoot, path), "utf8"),
            ).every((specifier) => !isForbidden(specifier)),
          message,
        )
        .check({ clearCache: true }),
    ),
  );

  return violations.flat();
}

export function isCloudflareWorkersImport(specifier: string): boolean {
  return specifier === "cloudflare:workers";
}

export function isWranglerImport(specifier: string): boolean {
  return (
    specifier === "wrangler" ||
    specifier.startsWith("wrangler/") ||
    specifier === "@cloudflare/workers-types" ||
    specifier.startsWith("@cloudflare/workers-types/")
  );
}

export function isNodeImport(specifier: string): boolean {
  return isBuiltin(specifier);
}

function importedModules(content: string): string[] {
  return parse(content)[0]
    .filter(({ t }) => t === ImportType.Static)
    .flatMap(({ n }) => (n === undefined ? [] : [n]));
}
