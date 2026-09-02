import assert from "node:assert/strict";
import test from "node:test";

const OWNER = {
  id: "owner-1",
  memberships: [{ active: true, role: "OWNER" }],
};

const BOARD = {
  id: "board-1",
  memberships: [{ active: true, role: "BOARD" }],
};

async function importRoute(label: string) {
  return import(`./route.ts?case=${label}`) as Promise<typeof import("./route.ts")>;
}

function mockHealthyDatabase(t: test.TestContext) {
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: () => ({ abortSignal: async () => ({ error: null }) }),
      }),
    },
  });
}

function mockConfiguredEnv(t: test.TestContext, serviceRole = true) {
  t.mock.module("@/lib/env", {
    namedExports: {
      getSupabasePublicEnv: () => ({ url: "https://example.supabase.co", anonKey: "public" }),
      getSupabaseServiceRoleKey: () => serviceRole ? "service" : undefined,
    },
  });
  const keys = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "CONTACT_TO_EMAIL", "CRON_SECRET", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "CLERK_ISSUER", "CLERK_WEBHOOK_SIGNING_SECRET"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.RESEND_API_KEY = "resend";
  process.env.RESEND_FROM_EMAIL = "MECG <mecg@example.com>";
  process.env.CONTACT_TO_EMAIL = "board@example.com";
  process.env.CRON_SECRET = "cron";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_example";
  process.env.CLERK_SECRET_KEY = "sk_test_example";
  process.env.CLERK_ISSUER = "https://example.clerk.accounts.dev";
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = "whsec_example";
  t.after(() => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("operations readiness rejects an anonymous request", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  mockHealthyDatabase(t);
  const { GET } = await importRoute("anonymous");
  assert.equal((await GET()).status, 401);
});

test("operations readiness is restricted to owners", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  mockHealthyDatabase(t);
  const { GET } = await importRoute("board");
  assert.equal((await GET()).status, 403);
});

test("operations readiness reports a healthy configuration without exposing values", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  mockConfiguredEnv(t);
  mockHealthyDatabase(t);
  const { GET } = await importRoute("healthy");
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ready, true);
  assert.deepEqual(body.configuration, {
    publicSupabase: true,
    serviceRole: true,
    clerk: true,
    resend: true,
    contactRecipient: true,
    cronSecret: true,
  });
  assert.equal(JSON.stringify(body).includes('"service"'), false);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("operations readiness returns 503 when required configuration is missing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  mockConfiguredEnv(t, false);
  mockHealthyDatabase(t);
  t.mock.method(console, "warn", () => {});
  const { GET } = await importRoute("degraded");
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.ready, false);
  assert.equal(body.configuration.serviceRole, false);
});
