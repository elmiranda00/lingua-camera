// Browser smoke test: the built app, served by the Worker's `smoke` environment (no AI binding)
import { defineConfig, devices } from "@playwright/test";

const PORT = 8788; // keep in sync with `dev:smoke` in worker/package.json

export default defineConfig({
  testDir: "web/test/e2e",
  testMatch: "*.spec.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    // 375 px wide: the width the app is designed for
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 } } },
  ],
  webServer: {
    command: "npm run dev:smoke -w @lingua-camera/worker",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
