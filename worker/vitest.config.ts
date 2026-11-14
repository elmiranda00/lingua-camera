// Worker tests run in workerd (Miniflare), with the D1 migrations applied
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        // Workers AI is remote-only; tests mock env.AI, so never log in to Cloudflare
        remoteBindings: false,
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: { name: "worker", setupFiles: ["./test/apply-migrations.ts"] },
  };
});
