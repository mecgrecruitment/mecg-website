import { defineConfig, devices } from "@playwright/test";

const liveBaseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const localBaseUrl = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: liveBaseUrl ?? localBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: liveBaseUrl
    ? undefined
    : {
        command: "npm run start -- -p 3100",
        url: localBaseUrl,
        reuseExistingServer: true,
        timeout: 30_000,
      },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
