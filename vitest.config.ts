// Runs every workspace's tests with one `npm run test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["shared", "worker", "web"],
  },
});
