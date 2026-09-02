import { chromium } from "@playwright/test";

const confirm = process.argv.includes("--confirm-create-users");
if (!confirm) throw new Error("This creates Clerk test users. Re-run with --confirm-create-users against a non-production Clerk instance.");
const baseUrl = process.env.CLERK_LOAD_TEST_BASE_URL?.trim();
const emailTemplate = process.env.CLERK_LOAD_TEST_EMAIL_TEMPLATE?.trim();
const password = process.env.CLERK_LOAD_TEST_PASSWORD;
const users = Number(process.env.CLERK_LOAD_TEST_USERS ?? 10);
const staggerMs = Number(process.env.CLERK_LOAD_TEST_STAGGER_MS ?? 0);
if (!baseUrl || !emailTemplate?.includes("{n}") || !password || !Number.isInteger(users) || users < 1 || users > 500) {
  throw new Error("Set CLERK_LOAD_TEST_BASE_URL, CLERK_LOAD_TEST_EMAIL_TEMPLATE containing {n}, CLERK_LOAD_TEST_PASSWORD, and 1-500 users");
}
if (/mecgmichigan\.com/i.test(baseUrl) || /pk_live/i.test(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "")) {
  throw new Error("The signup load test refuses to target production");
}

const browser = await chromium.launch({ headless: true });
const startedAt = Date.now();
const results = [];
try {
  await Promise.all(Array.from({ length: users }, async (_, index) => {
    if (staggerMs > 0) await new Promise((resolve) => setTimeout(resolve, staggerMs * index));
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = { index, status: "failed", retryNotices: 0, elapsedMs: 0 };
    const userStartedAt = Date.now();
    try {
      await page.goto(new URL("/apply", baseUrl).toString());
      await page.getByLabel("Full name").fill(`Clerk Load Test ${index + 1}`);
      await page.getByLabel("Email").fill(emailTemplate.replace("{n}", String(index + 1)));
      await page.getByLabel("Create a password").fill(password);
      await page.getByRole("button", { name: "Create applicant account" }).click();
      while (Date.now() - userStartedAt < 120_000) {
        if (await page.getByLabel("Verification code").isVisible().catch(() => false)) {
          result.status = "verification-sent";
          break;
        }
        const notice = page.getByText(/Retrying automatically/);
        if (await notice.isVisible().catch(() => false)) result.retryNotices += 1;
        const error = page.getByText(/temporarily unavailable|could not|invalid/i);
        if (await error.isVisible().catch(() => false)) break;
        await page.waitForTimeout(250);
      }
    } finally {
      result.elapsedMs = Date.now() - userStartedAt;
      results.push(result);
      await context.close();
    }
  }));
} finally {
  await browser.close();
}

const succeeded = results.filter((result) => result.status === "verification-sent").length;
const report = {
  users,
  succeeded,
  failed: users - succeeded,
  automaticRetryObservations: results.reduce((sum, result) => sum + result.retryNotices, 0),
  elapsedMs: Date.now() - startedAt,
};
console.log(JSON.stringify(report));
if (succeeded !== users) process.exitCode = 1;
