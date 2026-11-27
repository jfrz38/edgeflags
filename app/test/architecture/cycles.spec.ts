import { resolve } from "node:path";
import { projectFiles } from "archunit";
import { describe, expect, it } from "vitest";
import { createTemporaryProject } from "./support/temporary-project";

const applicationTsconfig = resolve("tsconfig.json");

describe("dependency cycles", () => {
  it("keeps production source free of import cycles", async () => {
    await expect(cycleViolations(applicationTsconfig)).resolves.toEqual([]);
  });

  it("detects a cycle in a temporary project", async () => {
    const project = await createTemporaryProject();

    try {
      await project.write(
        "src/domain/first.ts",
        'import { second } from "./second";\nexport const first = second;\n',
      );
      await project.write(
        "src/domain/second.ts",
        'import { first } from "./first";\nexport const second = first;\n',
      );

      const violations = await cycleViolations(project.tsconfig);

      expect(violations.length).toBeGreaterThan(0);
    } finally {
      await project.remove();
    }
  });
});

function cycleViolations(tsconfig: string) {
  return projectFiles(tsconfig)
    .inFolder("src/**")
    .should()
    .haveNoCycles()
    .check({ clearCache: true });
}
