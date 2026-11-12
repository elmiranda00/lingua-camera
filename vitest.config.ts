// Runs every workspace's tests
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["shared", "worker", "web"],
  },
});
