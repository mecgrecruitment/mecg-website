import { resolve } from "node:path";
import { createClerkClient } from "@clerk/backend";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseEnv, requireServiceRoleKey } from "./lib/supabase-env.mjs";

const root = resolve(import.meta.dirname, "..");
const { url, serviceRoleKey } = loadSupabaseEnv(root);
const serviceKey = requireServiceRoleKey(serviceRoleKey);
const baseUrl = (process.argv[2] ?? process.env.AUTH_TEST_BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/u, "");
const secretKey = process.env.CLERK_SECRET_KEY?.trim();
const issuer = process.env.CLERK_ISSUER?.trim().replace(/\/+$/, "");
if (!secretKey || !issuer) throw new Error("CLERK_SECRET_KEY and CLERK_ISSUER are required");
const clerk = createClerkClient({ secretKey });
const admin = createClient(url, serviceKey, {
  db: { schema: "rush" },
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = crypto.randomUUID();
const password = `${crypto.randomUUID()}Aa1!`;
const cycleId = `auth-route-${suffix}`;
const cases = [
  { label: "new-applicant", destination: "/apply" },
  { label: "submitted-applicant", destination: "/applicant" },
  { label: "member", destination: "/member", role: "MEMBER" },
  { label: "board", destination: "/admin", role: "BOARD" },
  { label: "inactive", destination: "/access-denied", inactive: true },
];
const identities = [];
let browser;
let primaryError;

function assertNoError(error, operation) {
  if (error) throw new Error(`${operation}: ${error.message}`);
}
try {
  for (const testCase of cases) {
    const email = `auth-${testCase.label}-${suffix}@example.invalid`;
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email], password, firstName: "Auth", lastName: testCase.label,
    });
    const { data: appUserId, error } = await admin.rpc("ensure_external_identity", {
      identity_issuer: issuer, identity_subject: clerkUser.id,
      identity_email: email, identity_display_name: `Auth ${testCase.label}`,
    });
    assertNoError(error, `provision ${testCase.label}`);
    Object.assign(testCase, { email, appUserId });
    identities.push({ clerkUserId: clerkUser.id, appUserId });
  }

  assertNoError((await admin.from("rush_cycles").insert({ id: cycleId, name: `Auth routing ${suffix}`, status: "DRAFT" })).error, "create cycle");
  assertNoError((await admin.from("memberships").insert(cases.filter((item) => item.role).map((item) => ({
    user_id: item.appUserId, cycle_id: cycleId, role: item.role,
  })))).error, "create memberships");

  const submitted = cases.find((item) => item.label === "submitted-applicant");
  const pnmId = `auth-pnm-${suffix}`;
  const applicationId = `auth-app-${suffix}`;
  assertNoError((await admin.from("pnms").insert({
    id: pnmId, auth_user_id: submitted.appUserId, name: "Auth submitted applicant",
    contact: submitted.email, normalized_contact: submitted.email,
  })).error, "create applicant");
  assertNoError((await admin.from("applications").insert({
    id: applicationId, pnm_id: pnmId, cycle_id: cycleId, status: "SUBMITTED", submitted_at: new Date().toISOString(),
  })).error, "create application");
  const inactive = cases.find((item) => item.inactive);
  assertNoError((await admin.from("profiles").update({ active: false }).eq("id", inactive.appUserId)).error, "deactivate profile");

  browser = await chromium.launch({ headless: true });
  for (const testCase of cases) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel(/email/i).fill(testCase.email);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /continue|sign in/i }).click();
    await page.waitForURL((target) => target.pathname === testCase.destination, { timeout: 20_000 });
    const response = await page.goto(`${baseUrl}${testCase.destination}`);
    if (!response?.ok()) throw new Error(`${testCase.label} destination returned ${response?.status()}`);
    await context.close();
  }
  console.log(`Clerk authentication routing passed for ${cases.length} account states against ${baseUrl}.`);
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  await browser?.close();
  const cleanup = [
    admin.from("applications").delete().eq("id", `auth-app-${suffix}`),
    admin.from("pnms").delete().eq("id", `auth-pnm-${suffix}`),
  ];
  await Promise.allSettled(cleanup);
  await admin.from("rush_cycles").delete().eq("id", cycleId);
  const results = await Promise.allSettled(identities.flatMap((identity) => [
    clerk.users.deleteUser(identity.clerkUserId),
    admin.from("profiles").delete().eq("id", identity.appUserId),
  ]));
  const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (errors.length) {
    const cleanupError = new AggregateError(errors, "Could not clean up every Clerk routing identity");
    if (primaryError) console.error(cleanupError);
    else throw cleanupError;
  }
}
