import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { parseSync, type Program } from "oxc-parser";

type SourceFile = {
  path: string;
  program: Program;
  imports: string[];
};

const forbiddenCoreGlobals = new Set([
  "CloudflareAccessContext",
  "Env",
  "ExecutionContext",
  "ExportedHandler",
  "KVNamespace",
]);

export function useCaseViolations(root: string): string[] {
  return sourceFiles(root)
    .filter(({ path }) => path.startsWith("src/application/"))
    .flatMap((file) =>
      exportedDeclarations(file.program)
        .filter(
          (declaration) =>
            declaration.type === "ClassDeclaration" &&
            declaration.abstract === false &&
            !extendsError(declaration.superClass),
        )
        .flatMap((declaration) => {
          if (declaration.type !== "ClassDeclaration") return [];

          const publicMethods = declaration.body.body.filter(
            (member) =>
              member.type === "MethodDefinition" &&
              member.kind !== "constructor" &&
              member.accessibility !== "private" &&
              member.accessibility !== "protected",
          );
          const dispatchMethods = publicMethods.filter(
            (method) =>
              method.type === "MethodDefinition" &&
              method.key.type === "Identifier" &&
              method.key.name === "dispatch",
          );

          return publicMethods.length === 1 && dispatchMethods.length === 1
            ? []
            : [
                `${file.path}: application class ${declaration.id?.name ?? "<anonymous>"} must expose exactly one public method named dispatch`,
              ];
        }),
    );
}

export function publicConceptViolations(root: string): string[] {
  return sourceFiles(root).flatMap((file) => {
    const concepts = exportedDeclarations(file.program).filter((declaration) =>
      [
        "ClassDeclaration",
        "TSInterfaceDeclaration",
        "TSTypeAliasDeclaration",
      ].includes(declaration.type),
    );

    return concepts.length <= 1
      ? []
      : [`${file.path}: public reusable concepts must have separate files`];
  });
}

export function repositoryViolations(root: string): string[] {
  return sourceFiles(root).flatMap((file) => {
    const fileName = basename(file.path);
    const declarations = exportedDeclarations(file.program);
    const violations: string[] = [];

    if (
      file.path.startsWith("src/application/") &&
      fileName.endsWith("-repository.ts") &&
      (declarations.length === 0 ||
        declarations.some(
          (declaration) => declaration.type !== "TSInterfaceDeclaration",
        ))
    ) {
      violations.push(
        `${file.path}: application repository ports must be interfaces`,
      );
    }

    if (
      file.path.startsWith("src/infrastructure/persistence/") &&
      fileName.endsWith("-repository.ts")
    ) {
      const repositoryClasses = declarations.filter(
        (declaration) => declaration.type === "ClassDeclaration",
      );
      if (
        repositoryClasses.length === 0 ||
        repositoryClasses.some(
          (declaration) =>
            declaration.type === "ClassDeclaration" &&
            (declaration.implements?.length ?? 0) === 0,
        )
      ) {
        violations.push(
          `${file.path}: persistence repositories must implement an application port`,
        );
      }
    }

    return violations;
  });
}

export function coreRuntimeGlobalViolations(root: string): string[] {
  return sourceFiles(root)
    .filter(
      ({ path }) =>
        path.startsWith("src/domain/") || path.startsWith("src/application/"),
    )
    .flatMap((file) => {
      const usedGlobals = identifiers(file.program).filter((identifier) =>
        forbiddenCoreGlobals.has(identifier),
      );

      return [...new Set(usedGlobals)].map(
        (identifier) =>
          `${file.path}: core code must not reference runtime global ${identifier}`,
      );
    });
}

export function httpHandlerViolations(root: string): string[] {
  return sourceFiles(root)
    .filter(
      ({ path }) =>
        path.startsWith("src/infrastructure/http/") &&
        path.endsWith("-handler.ts") &&
        !path.endsWith("/create-http-handler.ts"),
    )
    .flatMap((file) => {
      const applicationImports = new Set(
        file.imports.filter((specifier) => specifier.includes("/application/")),
      );

      return applicationImports.size <= 1
        ? []
        : [
            `${file.path}: an operation handler may depend on at most one application module`,
          ];
    });
}

function sourceFiles(root: string): SourceFile[] {
  return listTypeScriptFiles(join(root, "src")).map((absolutePath) => {
    const source = readFileSync(absolutePath, "utf8");
    const result = parseSync(absolutePath, source);
    if (result.errors.length > 0) {
      throw new Error(
        `${normalize(relative(root, absolutePath))}: ${result.errors.map(({ message }) => message).join("; ")}`,
      );
    }

    return {
      path: normalize(relative(root, absolutePath)),
      program: result.program,
      imports: result.module.staticImports.map(
        ({ moduleRequest }) => moduleRequest.value,
      ),
    };
  });
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

function exportedDeclarations(program: Program) {
  return program.body.flatMap((statement) =>
    statement.type === "ExportNamedDeclaration" &&
    statement.declaration !== null
      ? [statement.declaration]
      : [],
  );
}

function extendsError(superClass: unknown): boolean {
  return (
    typeof superClass === "object" &&
    superClass !== null &&
    "type" in superClass &&
    superClass.type === "Identifier" &&
    "name" in superClass &&
    superClass.name === "Error"
  );
}

function identifiers(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(identifiers);
  if (typeof value !== "object" || value === null) return [];

  if (
    "type" in value &&
    value.type === "Identifier" &&
    "name" in value &&
    typeof value.name === "string"
  ) {
    return [value.name];
  }

  return Object.values(value).flatMap(identifiers);
}

function normalize(path: string): string {
  return path.split(sep).join("/");
}
