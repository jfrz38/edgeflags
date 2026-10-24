import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: process.env.EDGEFLAGS_WRANGLER_CONFIG ?? "./wrangler.toml",
        environment: process.env.EDGEFLAGS_WRANGLER_ENV,
      },
    }),
  ],
});
