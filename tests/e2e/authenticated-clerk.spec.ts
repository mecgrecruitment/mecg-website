import { createClerkClient } from "@clerk/backend";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

test("an applicant can create and verify a Clerk account", async ({ page }) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith("sk_test_")) throw new Error("A Clerk development secret key is required");
  const clerk = createClerkClient({ secretKey });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `mecg.e2e+clerk_test_${suffix}@example.com`;

  try {
    await setupClerkTestingToken({ page });
    await page.goto("/apply");
    await page.getByLabel("Full name").fill("MECG E2E Applicant");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Create a password").fill("MecgTesting!2026");
    await page.getByRole("button", { name: "Create applicant account" }).click();

    await expect(page.getByLabel("Verification code")).toBeVisible();
    await page.getByLabel("Verification code").fill("424242");
    await page.getByRole("button", { name: "Verify email" }).click();

    await expect(page).toHaveURL(/\/apply(?:[?#].*)?$/);
    await expect.poll(() => page.evaluate(() => window.Clerk?.session?.status)).toBe("active");
  } finally {
    const users = await clerk.users.getUserList({ emailAddress: [email], limit: 10 });
    await Promise.all(users.data.map((user) => clerk.users.deleteUser(user.id)));
  }
});
