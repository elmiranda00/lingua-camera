// Worker tests run in workerd (Miniflare)
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // Workers AI is remote-only; tests mock env.AI, so never log in to Cloudflare
      remoteBindings: false,
    }),
  ],
  test: { name: "worker" },
});
