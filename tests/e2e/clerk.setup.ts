import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

setup.describe.configure({ mode: "serial" });

setup("initialize the Clerk development testing token", async () => {
  loadEnvConfig(process.cwd());
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!publishableKey?.startsWith("pk_test_") || !secretKey?.startsWith("sk_test_")) {
    throw new Error("Authenticated Clerk E2E requires development pk_test_ and sk_test_ keys");
  }
  await clerkSetup({ publishableKey, secretKey });
});
