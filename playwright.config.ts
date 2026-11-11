import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Run: `npm run e2e`. Needs local Supabase (`npx supabase start`) and Redis
 * (`docker compose up -d redis`); Playwright starts the web app and the worker (fast stub steps).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    ...(process.env.E2E_BASE_URL
      ? []
      : [
          {
            command: "npm run dev",
            url: "http://localhost:3000",
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]),
    {
      // A second worker next to one you already run is harmless: BullMQ consumers share the queue.
      command: "npm run worker:start",
      env: { STUB_STEP_MS: "150" },
      wait: { stdout: /worker started/ },
      timeout: 60_000,
      name: "worker",
    },
  ],
});
