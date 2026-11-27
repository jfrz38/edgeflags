import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  corePurityRule,
  isCloudflareWorkersImport,
  isNodeImport,
  isWranglerImport,
} from "./support/archunit-rules";
import { createTemporaryProject } from "./support/temporary-project";

const applicationTsconfig = resolve("tsconfig.json");

const purityRules = [
  {
    name: "Cloudflare Workers runtime modules",
    importStatement: 'import { env } from "cloudflare:workers";',
    isForbidden: isCloudflareWorkersImport,
  },
  {
    name: "Wrangler modules and types",
    importStatement: 'import type { Config } from "wrangler";',
    isForbidden: isWranglerImport,
  },
  {
    name: "Node built-in modules",
    importStatement: 'import { readFile } from "node:fs";',
    isForbidden: isNodeImport,
  },
] as const;

describe("domain and application purity", () => {
  it.each(purityRules)("does not import $name", async (rule) => {
    await expect(
      corePurityRule(
        applicationTsconfig,
        rule.isForbidden,
        `Domain and application must not import ${rule.name}`,
      ),
    ).resolves.toEqual([]);
  });

  it.each(purityRules)("detects an import of $name", async (rule) => {
    const project = await createTemporaryProject();

    try {
      await project.write(
        "src/application/valid-application.ts",
        "export const valid = true;\n",
      );
      await project.write(
        "src/domain/violating-domain.ts",
        `${rule.importStatement}\nexport const value = true;\n`,
      );

      const violations = await corePurityRule(
        project.tsconfig,
        rule.isForbidden,
        `Domain and application must not import ${rule.name}`,
      );

      expect(violations).toHaveLength(1);
    } finally {
      await project.remove();
    }
  });
});
