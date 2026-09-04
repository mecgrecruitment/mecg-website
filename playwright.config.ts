import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
const clerkE2EEnabled = process.env.CLERK_E2E_ENABLED === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/clerk.setup.ts", "**/authenticated-clerk.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testIgnore: ["**/clerk.setup.ts", "**/authenticated-clerk.spec.ts"],
      use: { ...devices["Pixel 7"] },
    },
    ...(clerkE2EEnabled ? [
      { name: "clerk-setup", testMatch: /clerk\.setup\.ts/ },
      {
        name: "authenticated-clerk",
        testMatch: /authenticated-clerk\.spec\.ts/,
        dependencies: ["clerk-setup"],
        use: { ...devices["Desktop Chrome"] },
      },
    ] : []),
  ],
  webServer: {
    command: process.env.CI
      ? `npm start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/home`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // This server is plain http on 127.0.0.1. Kept in step with the build
      // flag below; the CSP is computed at build time, so the build is what
      // actually decides. Deployments never set it.
      E2E_LOCAL_HTTP: "1",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ci.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "ci-placeholder",
      ...((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY)
        ? { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY }
        : {}),
      ...(process.env.CLERK_SECRET_KEY ? { CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY } : {}),
      ...(process.env.CLERK_ISSUER ? { CLERK_ISSUER: process.env.CLERK_ISSUER } : {}),
    },
  },
});
