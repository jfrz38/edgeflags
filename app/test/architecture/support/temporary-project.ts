import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type TemporaryProject = {
  root: string;
  tsconfig: string;
  write(relativePath: string, content: string): Promise<void>;
  remove(): Promise<void>;
};

export async function createTemporaryProject(): Promise<TemporaryProject> {
  const root = await mkdtemp(join(tmpdir(), "edgeflags-architecture-"));
  const tsconfig = join(root, "tsconfig.json");

  await writeFile(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2023",
      },
      include: ["src/**/*.ts"],
    }),
  );

  return {
    root,
    tsconfig,
    async write(relativePath, content) {
      const filePath = join(root, relativePath);
      await mkdir(join(filePath, ".."), { recursive: true });
      await writeFile(filePath, content);
    },
    remove: () => rm(root, { recursive: true, force: true }),
  };
}
