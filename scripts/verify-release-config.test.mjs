import assert from "node:assert/strict";
import test from "node:test";
import { releaseConfigurationIssues } from "./verify-release-config.mjs";

// Deliberately synthetic strings; this pure check never contacts a service.
const configured = {
  NEXT_PUBLIC_MECG_SUPABASE_URL: "https://chrxtsohxazngabdcpzb.supabase.co",
  NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY: "synthetic-public-value",
  MECG_SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-value",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic-value",
  CLERK_SECRET_KEY: "sk_live_synthetic-value", CLERK_ISSUER: "https://clerk.mecgmichigan.com",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_synthetic-value", RESEND_API_KEY: "re_synthetic-value",
  RESEND_FROM_EMAIL: "Recruitment <recruitment@mecgmichigan.com>", CONTACT_TO_EMAIL: "mecg-board@umich.edu", CRON_SECRET: "synthetic-cron-value",
};
test("release configuration distinguishes missing configuration without exposing supplied values", () => {
  const issues = releaseConfigurationIssues({ CLERK_SECRET_KEY: "sk_test_do-not-print-this-value" });
  assert.ok(issues.length > 0);
  assert.ok(!JSON.stringify(issues).includes("do-not-print-this-value"));
});
test("release configuration accepts the MECG-prefixed provider settings over unrelated defaults", () => {
  assert.deepEqual(releaseConfigurationIssues({ ...configured, NEXT_PUBLIC_SUPABASE_URL: "https://unrelated.supabase.co" }), []);
});
test("hosted builds reject both HTTP test mode and test harness exposure", () => {
  const issues = releaseConfigurationIssues({ ...configured, E2E_LOCAL_HTTP: "1", PLAYWRIGHT_APPLICATION_HARNESS: "1" });
  assert.equal(issues.length, 2);
});
test("production rejects an unrelated database and development Clerk keys while preview permits test providers", () => {
  const preview = { ...configured, NEXT_PUBLIC_MECG_SUPABASE_URL: "https://staging.supabase.co", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic" };
  assert.equal(releaseConfigurationIssues(preview).length, 3);
  assert.deepEqual(releaseConfigurationIssues(preview, { production: false }), []);
});
test("release provider URLs reject cleartext and embedded credentials", () => {
  assert.ok(releaseConfigurationIssues({ ...configured, CLERK_ISSUER: "http://clerk.mecgmichigan.com" }).some(issue => issue.includes("HTTPS")));
  assert.ok(releaseConfigurationIssues({ ...configured, CLERK_ISSUER: "https://user:pass@clerk.mecgmichigan.com" }).some(issue => issue.includes("HTTPS")));
});
