// Web unit tests (plain Node; a DOM environment comes with components in M1)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "web", environment: "node", include: ["test/**/*.test.ts"] },
});
