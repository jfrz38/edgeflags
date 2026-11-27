import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { infrastructureIsolationRule } from "./support/archunit-rules";
import { createTemporaryProject } from "./support/temporary-project";

const applicationTsconfig = resolve("tsconfig.json");
const infrastructureModules = ["auth", "http", "persistence"] as const;

describe("infrastructure module boundaries", () => {
  it.each(infrastructureModules)(
    "%s does not depend on sibling infrastructure modules",
    async (source) => {
      const forbiddenTargets = infrastructureModules.filter(
        (target) => target !== source,
      );

      await expect(
        infrastructureIsolationRule(
          applicationTsconfig,
          source,
          forbiddenTargets,
        ),
      ).resolves.toEqual([]);
    },
  );

  it.each([
    ["auth", "http"],
    ["http", "persistence"],
    ["persistence", "auth"],
  ])("detects a dependency from %s to %s", async (source, target) => {
    const project = await createTemporaryProject();

    try {
      await project.write(
        `src/infrastructure/${target}/target.ts`,
        "export const target = true;\n",
      );
      await project.write(
        `src/infrastructure/${source}/source.ts`,
        `import { target } from "../${target}/target";\nexport const source = target;\n`,
      );

      const violations = await infrastructureIsolationRule(
        project.tsconfig,
        source,
        [target],
      );

      expect(violations).toHaveLength(1);
    } finally {
      await project.remove();
    }
  });
});
