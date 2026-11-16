import { defineConfig, devices } from "@playwright/test";

// BASE_URL points at a deployed preview in CI. Without it, tests run against a local production build.
const baseURL = process.env.BASE_URL ?? "http://localhost:4173";
const isLocal = !process.env.BASE_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }], ["github"]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: isLocal
    ? [
        {
          // Stand-in for Telegram, GitHub and Anthropic so bot tests never reach real services.
          command: "node tests/bot/stub-server.mjs",
          url: "http://localhost:4199/__requests",
          reuseExistingServer: !process.env.CI,
        },
        {
          command:
            "node scripts/ensure-dev-vars.mjs && npm run db:migrate:local && npm run build && npx vite preview --port 4173 --strictPort",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ]
    : undefined,
});
