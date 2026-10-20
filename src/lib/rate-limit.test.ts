import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

function mockLimiter(t: TestContext, result: { data: boolean | null; error: { message: string } | null }) {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: { screeningRpc: async () => result },
  });
}

async function importLimiter(testCase: string) {
  return import(`./rate-limit.ts?case=${testCase}`) as Promise<typeof import("./rate-limit.ts")>;
}

test("checkRateLimitStatus reports allowed and limited decisions", async (t) => {
  mockLimiter(t, { data: true, error: null });
  const allowedModule = await importLimiter("allowed");
  assert.equal(await allowedModule.checkRateLimitStatus("apply:user:ip"), "allowed");

  t.mock.reset();
  mockLimiter(t, { data: false, error: null });
  const limitedModule = await importLimiter("limited");
  assert.equal(await limitedModule.checkRateLimitStatus("apply:user:ip"), "limited");
});

test("checkRateLimitStatus preserves limiter outages as unavailable", async (t) => {
  mockLimiter(t, { data: null, error: { message: "database unavailable" } });
  t.mock.method(console, "error", () => undefined);
  const { checkRateLimitStatus } = await importLimiter("unavailable");
  assert.equal(await checkRateLimitStatus("apply:user:ip"), "unavailable");
});

test("legacy boolean limiter wrapper retains explicit fail-open policy", async (t) => {
  mockLimiter(t, { data: null, error: { message: "database unavailable" } });
  t.mock.method(console, "error", () => undefined);
  const { checkRateLimit } = await importLimiter("compatibility");
  assert.equal(await checkRateLimit("contact:ip"), false);
  assert.equal(await checkRateLimit("login:ip", "allow"), true);
});

test("an empty limiter response is an outage rather than an exhausted bucket", async (t) => {
  mockLimiter(t, { data: null, error: null });
  t.mock.method(console, "error", () => undefined);
  const { checkRateLimitStatus } = await importLimiter("empty-response");
  assert.equal(await checkRateLimitStatus("apply:user:ip"), "unavailable");
});

test("a rejected limiter RPC preserves fail-closed and explicit fail-open policies", async (t) => {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({}) } });
  t.mock.module("@/lib/screening-rpc", {
    namedExports: { screeningRpc: async () => { throw new Error("transport rejected with private detail"); } },
  });
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  const { checkRateLimitStatus, checkRateLimit } = await importLimiter("rpc-rejected");
  assert.equal(await checkRateLimitStatus("apply:user:ip"), "unavailable");
  assert.equal(await checkRateLimit("contact:ip"), false);
  assert.equal(await checkRateLimit("login:ip", "allow"), true);
  assert.equal(JSON.stringify(logs).includes("private detail"), false);
  assert.equal(JSON.stringify(logs).includes("apply:user:ip"), false);
});

test("limiter client setup failures return unavailable", async (t) => {
  t.mock.module("@/lib/supabase/admin", {
    namedExports: { createAdminClient: () => { throw new Error("missing service role configuration"); } },
  });
  t.mock.method(console, "error", () => undefined);
  const { checkRateLimitStatus } = await importLimiter("client-setup-failed");
  assert.equal(await checkRateLimitStatus("apply:user:ip"), "unavailable");
});
